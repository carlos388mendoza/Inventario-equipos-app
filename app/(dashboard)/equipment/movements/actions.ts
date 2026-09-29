"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentHistory,
  equipmentMovements,
  restaurants,
} from "@/lib/db/schema";
import {
  EQUIPMENT_MOVEMENT_TYPES,
  EQUIPMENT_STATUS,
  ROLES,
  type EquipmentMovementType,
  type EquipmentStatus,
} from "@/lib/db/enums";
import { EQUIPMENT_ACTIONS } from "@/lib/equipment/lifecycle";
import {
  checkCopyInput,
  checkLocationChange,
  checkReplacement,
  effectiveOwnerRestaurantId,
  movementDescription,
  summarizeBatch,
  validateBatch,
  type MovableEquipment,
} from "@/lib/equipment/movements";
import { assertRestaurantAccess, resolveScope } from "@/lib/equipment/scope";
import { revalidateMovementViews } from "@/lib/revalidate";
import {
  archiveEquipmentSchema,
  bulkMoveEquipmentSchema,
  copyEquipmentSchema,
  moveEquipmentSchema,
  replaceEquipmentSchema,
} from "@/lib/validation/equipment-movements";

export type MovementActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Acciones del módulo de Movimientos.
 *
 * Todas comparten la misma forma, y esa forma es la garantía importante:
 *
 * 1. `requireRole(ADMIN, IT_MANAGER)`. Un usuario de restaurante no ejecuta
 *    movimientos, ni siquiera los de su propia unidad.
 * 2. `Zod` para la forma de la entrada.
 * 3. `assertRestaurantAccess` sobre el ORIGEN y sobre el DESTINO, cuando el
 *    alcance no es global.
 * 4. Releer el equipo dentro de la transacción y validar las reglas de
 *    `lib/equipment/movements.ts` contra los datos reales, no contra lo que
 *    envió el cliente.
 * 5. Escribir SIEMPRE tres cosas juntas: la mutación del equipo, su fila en
 *    `equipment_history` y su fila en `equipment_movements`. Sin excepción: un
 *    equipo movido sin asiento es indistinguible de uno que nunca se movió.
 *
 * Ninguna operación borra un equipo. Un equipo se archiva (`RETIRED`) con su
 * motivo escrito en el historial, y ni la etiqueta, ni el QR público, ni los
 * movimientos que lo mencionan se pierden nunca.
 */

/** Tipos que un usuario puede lanzar. Lo declarado en el enum, sin excepción. */
const ALLOWED_MOVEMENT_TYPES: EquipmentMovementType[] = [
  EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
  EQUIPMENT_MOVEMENT_TYPES.PULL,
  EQUIPMENT_MOVEMENT_TYPES.COPY,
  EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
  EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN,
  EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
];

function isAllowedType(type: string): type is EquipmentMovementType {
  return (ALLOWED_MOVEMENT_TYPES as string[]).includes(type);
}

function newId(): string {
  return crypto.randomUUID();
}

/** Traduce cualquier excepción a un mensaje que el cliente puede mostrar. */
function toMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Datos no válidos.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "No se pudo completar la operación.";
}

/** Envuelve un error inesperado sin filtrar detalles internos al cliente. */
function toResult(error: unknown): MovementActionResult {
  return { ok: false, error: toMessage(error) };
}

// ─── Lecturas de apoyo ───────────────────────────────────────────────────────

/** Proyección mínima para aplicar las reglas de `lib/equipment/movements.ts`. */
function toMovable(row: {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  equipmentTypeId: string;
  restaurantId: string;
  ownerRestaurantId: string | null;
  status: EquipmentStatus;
}): MovableEquipment {
  return {
    id: row.id,
    assetCode: row.assetCode,
    serialNumber: row.serialNumber,
    equipmentTypeId: row.equipmentTypeId,
    restaurantId: row.restaurantId,
    ownerRestaurantId: row.ownerRestaurantId,
    status: row.status,
  };
}

/**
 * Carga los equipos pedidos aplicando el alcance del usuario.
 *
 * Devuelve un `Map` porque las operaciones de lote consultan una vez y luego
 * leen muchos, y porque un `Set` de ids malicioso debe reducirse a los que el
 * usuario puede ver en lugar de fallar con un error opaco.
 */
async function loadEquipmentForScope(
  ids: string[],
  restaurantIds?: string[]
): Promise<Map<string, MovableEquipment>> {
  const scope = await resolveScope();
  const conditions = [inArray(equipment.id, ids)];

  if (!scope.isGlobal) {
    // Un usuario restringido solo puede tocar equipos de su unidad. El filtro
    // va en la consulta, no después: así no se filtra ni la existencia de ids
    // ajenos.
    conditions.push(eq(equipment.restaurantId, scope.restaurantId!));
  } else if (restaurantIds && restaurantIds.length > 0) {
    for (const restaurantId of restaurantIds) {
      assertRestaurantAccess(scope, restaurantId);
    }
  }

  const rows = await db
    .select()
    .from(equipment)
    .where(and(...conditions));

  return new Map(rows.map((row) => [row.id, toMovable(row)]));
}

/** Códigos de activo y series ya ocupados, para las reglas de unicidad. */
async function loadTakenIdentifiers(): Promise<{
  assetCodes: Set<string>;
  serialNumbers: Set<string>;
}> {
  const rows = await db
    .select({ assetCode: equipment.assetCode, serialNumber: equipment.serialNumber })
    .from(equipment);
  return {
    assetCodes: new Set(rows.map((r) => r.assetCode.toUpperCase())),
    serialNumbers: new Set(
      rows
        .map((r) => r.serialNumber?.trim().toUpperCase())
        .filter((v): v is string => Boolean(v))
    ),
  };
}

async function restaurantName(restaurantId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: restaurants.name })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);
  return row?.name ?? null;
}

/**
 * Comprueba que la unidad destino exista.
 *
 * La clave foránea ya lo impediría, pero su error es el de SQLite y no le dice
 * nada a quien está en la interfaz. Además, una fila `deactivated` sigue siendo
 * una unidad válida: por eso esto no filtra por activo, porque mudar equipo hacia
 * una unidad temporalmente inactiva es legítimo.
 */
async function assertDestinationExists(restaurantId: string): Promise<void> {
  const [row] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);
  if (!row) {
    throw new Error("La unidad destino no existe.");
  }
}

// ─── Traslado, jalado, préstamo y devolución ─────────────────────────────────

export async function moveEquipment(input: unknown): Promise<MovementActionResult> {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  try {
    const parsed = moveEquipmentSchema.parse(input);
    if (!isAllowedType(parsed.type)) {
      return { ok: false, error: "Tipo de movimiento no permitido." };
    }
    const scope = await resolveScope();

    // Un cambio de ubicación o de propiedad exige acceso a AMBAS unidades. Con
    // alcance global `assertRestaurantAccess` no hace nada, y con alcance
    // restringido es la línea que impide mover un equipo a otra unidad ajena.
    const map = await loadEquipmentForScope([parsed.equipmentId], [
      parsed.toRestaurantId,
    ]);
    const source = map.get(parsed.equipmentId);
    if (!source) {
      return { ok: false, error: "Equipo no encontrado o fuera de tu alcance." };
    }
    assertRestaurantAccess(scope, source.restaurantId);
    assertRestaurantAccess(scope, parsed.toRestaurantId);
    await assertDestinationExists(
      parsed.type === EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN
        ? effectiveOwnerRestaurantId(source)
        : parsed.toRestaurantId
    );

    // La devolución NO acepta destino libre: el destino lo dicta el
    // propietario, para que nadie devuelva un equipo a una tercera unidad.
    const toRestaurantId =
      parsed.type === EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN
        ? effectiveOwnerRestaurantId(source)
        : parsed.toRestaurantId;

    const check = checkLocationChange(source, parsed.type, toRestaurantId);
    if (!check.ok) {
      return { ok: false, error: check.error! };
    }

    const now = new Date();
    const batchId = newId();
    const [fromName, toName] = await Promise.all([
      restaurantName(source.restaurantId),
      restaurantName(toRestaurantId),
    ]);

    // El estado del préstamo no es una columna: se deriva de que propietario y
    // ubicación sean o no el mismo restaurante.
    const nextOwnerRestaurantId =
      parsed.type === EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT
        ? effectiveOwnerRestaurantId(source)
        : null;

    const historyAction =
      parsed.type === EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT
        ? EQUIPMENT_ACTIONS.LOANED
        : parsed.type === EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN
          ? EQUIPMENT_ACTIONS.RETURNED
          : parsed.type === EQUIPMENT_MOVEMENT_TYPES.PULL
            ? EQUIPMENT_ACTIONS.PULLED
            : EQUIPMENT_ACTIONS.MOVED;

    // Una transacción para las tres escrituras: o quedan las tres, o no queda
    // ninguna. Un equipo movido sin asiento en el libro sería indistinguible de
    // uno que nunca se movió.
    await db.transaction(async (tx) => {
      // Se relee DENTRO de la transacción y se vuelven a validar las reglas. La
      // lectura de arriba sirve para dar el error rápido y los nombres; sin esta
      // relectura, dos administradores que mueven el mismo equipo a la vez
      // validarían ambos contra el mismo estado viejo y el libro registraría dos
      // traslados para un solo hecho. La validación final manda sobre la primera.
      const [current] = await tx
        .select()
        .from(equipment)
        .where(eq(equipment.id, source.id))
        .limit(1);
      if (!current) {
        throw new Error("El equipo ya no existe.");
      }
      const recheck = checkLocationChange(
        toMovable(current),
        parsed.type,
        toRestaurantId
      );
      if (!recheck.ok) {
        throw new Error(recheck.error!);
      }
      if (current.restaurantId !== source.restaurantId) {
        throw new Error(
          "El equipo cambió de unidad mientras se preparaba el movimiento. Vuelve a intentarlo."
        );
      }

      await tx
        .update(equipment)
        .set({
          restaurantId: toRestaurantId,
          ownerRestaurantId: nextOwnerRestaurantId,
          updatedAt: now,
        })
        .where(eq(equipment.id, source.id));

      await tx.insert(equipmentHistory).values({
        id: newId(),
        equipmentId: source.id,
        // El asiento va a la unidad DESTINA: desde ahí en adelante el equipo
        // es de esa unidad, y es donde se consulta su historial.
        restaurantId: toRestaurantId,
        action: historyAction,
        description: movementDescription({
          type: parsed.type,
          fromName,
          toName,
          reason: parsed.reason || null,
        }),
        performedBy: user.id,
        createdAt: now,
      });

      await tx.insert(equipmentMovements).values({
        id: newId(),
        batchId,
        type: parsed.type,
        equipmentId: source.id,
        fromRestaurantId: source.restaurantId,
        toRestaurantId,
        assetCode: source.assetCode,
        equipmentTypeId: source.equipmentTypeId,
        reason: parsed.reason || null,
        notes: parsed.notes || null,
        performedBy: user.id,
        createdAt: now,
      });
    });

    revalidateMovementViews([source.id]);
    return {
      ok: true,
      message: summarizeBatch(1, parsed.type),
    };
  } catch (error) {
    return toResult(error);
  }
}

// ─── Movimiento múltiple ─────────────────────────────────────────────────────

export async function bulkMoveEquipment(
  input: unknown
): Promise<MovementActionResult> {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  try {
    const parsed = bulkMoveEquipmentSchema.parse(input);
    if (!isAllowedType(parsed.type)) {
      return { ok: false, error: "Tipo de movimiento no permitido." };
    }
    // Lote solo tiene sentido para los movimientos marcados como tales.
    const batchable: EquipmentMovementType[] = [
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      EQUIPMENT_MOVEMENT_TYPES.PULL,
      EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
    ];
    if (!batchable.includes(parsed.type)) {
      return { ok: false, error: "Ese movimiento no admite varios equipos." };
    }
    const scope = await resolveScope();
    assertRestaurantAccess(scope, parsed.toRestaurantId);
    await assertDestinationExists(parsed.toRestaurantId);

    const map = await loadEquipmentForScope(parsed.equipmentIds, [
      parsed.toRestaurantId,
    ]);

    // Un lote es "todo lo que seleccionaste" o no es nada. Si seselectionó un id
    // que no aparece, mover el resto en silencio dejaría al usuario creyendo que
    // se movió todo, así que se falla nombrando los ids concretos.
    const missing = parsed.equipmentIds.filter((id) => !map.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        error:
          missing.length === 1
            ? `El equipo ${missing[0]} ya no existe o está fuera de tu alcance. No se movió ninguno.`
            : `${missing.length} equipos ya no existen o están fuera de tu alcance (${missing.join(", ")}). No se movió ninguno.`,
      };
    }

    const requested = parsed.equipmentIds
      .map((id) => map.get(id))
      .filter((item): item is MovableEquipment => Boolean(item));

    if (requested.length === 0) {
      return { ok: false, error: "Ningún equipo seleccionado está en tu alcance." };
    }

    const validation = validateBatch(
      requested,
      parsed.type,
      parsed.toRestaurantId
    );

    // Todo o nada. Aplicar 11 de 12 dejaría un estado que el usuario no pidió y
    // que no vería hasta después del commit, así que se informa antes de
    // escribir nada, nombrando los equipos concretos que estorban.
    if (!validation.allOrNothing) {
      const detail = validation.rejected
        .map((item) => `${item.assetCode}: ${item.check.error}`)
        .join(" · ");
      return {
        ok: false,
        error: `No se movió ningún equipo. ${detail}`,
      };
    }

    const now = new Date();
    const batchId = newId();
    const toName = await restaurantName(parsed.toRestaurantId);
    const fromNames = new Map<string, string | null>();
    for (const item of validation.valid) {
      if (!fromNames.has(item.restaurantId)) {
        fromNames.set(item.restaurantId, await restaurantName(item.restaurantId));
      }
    }

    await db.transaction(async (tx) => {
      for (const item of validation.valid) {
        // Igual que en el movimiento individual: la validación final se hace
        // sobre el estado leído dentro de la transacción, no sobre el de antes de
        // abrirla. Si alguien movió este equipo en medio, el lote se cae entero.
        const [current] = await tx
          .select()
          .from(equipment)
          .where(eq(equipment.id, item.id))
          .limit(1);
        if (!current) {
          throw new Error(`${item.assetCode} ya no existe. No se movió ningún equipo.`);
        }
        const recheck = checkLocationChange(
          toMovable(current),
          parsed.type,
          parsed.toRestaurantId
        );
        if (!recheck.ok) {
          throw new Error(
            `${item.assetCode}: ${recheck.error} No se movió ningún equipo.`
          );
        }

        const fromName = fromNames.get(item.restaurantId) ?? null;
        const nextOwnerRestaurantId =
          parsed.type === EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT
            ? effectiveOwnerRestaurantId(item)
            : null;

        await tx
          .update(equipment)
          .set({
            restaurantId: parsed.toRestaurantId,
            ownerRestaurantId: nextOwnerRestaurantId,
            updatedAt: now,
          })
          .where(eq(equipment.id, item.id));

        await tx.insert(equipmentHistory).values({
          id: newId(),
          equipmentId: item.id,
          restaurantId: parsed.toRestaurantId,
          action:
            parsed.type === EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT
              ? EQUIPMENT_ACTIONS.LOANED
              : parsed.type === EQUIPMENT_MOVEMENT_TYPES.PULL
                ? EQUIPMENT_ACTIONS.PULLED
                : EQUIPMENT_ACTIONS.MOVED,
          description: movementDescription({
            type: parsed.type,
            fromName,
            toName,
            reason: parsed.reason || null,
          }),
          performedBy: user.id,
          createdAt: now,
        });

        await tx.insert(equipmentMovements).values({
          id: newId(),
          batchId,
          type: parsed.type,
          equipmentId: item.id,
          fromRestaurantId: item.restaurantId,
          toRestaurantId: parsed.toRestaurantId,
          assetCode: item.assetCode,
          equipmentTypeId: item.equipmentTypeId,
          reason: parsed.reason || null,
          notes: parsed.notes || null,
          performedBy: user.id,
          createdAt: now,
        });
      }
    });

    revalidateMovementViews(validation.valid.map((item) => item.id));
    return {
      ok: true,
      message: summarizeBatch(validation.valid.length, parsed.type),
    };
  } catch (error) {
    return toResult(error);
  }
}

// ─── Copia ───────────────────────────────────────────────────────────────────

export async function copyEquipment(input: unknown): Promise<MovementActionResult> {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  try {
    const parsed = copyEquipmentSchema.parse(input);
    const scope = await resolveScope();

    const map = await loadEquipmentForScope([parsed.equipmentId], [
      parsed.toRestaurantId,
    ]);
    const original = map.get(parsed.equipmentId);
    if (!original) {
      return { ok: false, error: "Equipo no encontrado o fuera de tu alcance." };
    }
    assertRestaurantAccess(scope, original.restaurantId);
    assertRestaurantAccess(scope, parsed.toRestaurantId);
    await assertDestinationExists(parsed.toRestaurantId);

    const taken = await loadTakenIdentifiers();
    const copyCheck = checkCopyInput(
      original,
      { assetCode: parsed.assetCode, serialNumber: parsed.serialNumber },
      taken.assetCodes,
      taken.serialNumbers
    );
    if (!copyCheck.ok) {
      return { ok: false, error: copyCheck.error! };
    }

    const now = new Date();
    const batchId = newId();
    const copyId = newId();
    const [fromName, toName] = await Promise.all([
      restaurantName(original.restaurantId),
      restaurantName(parsed.toRestaurantId),
    ]);

    // El original se relee completo para que la copia herede los datos tal
    // como están, incluidas las columnas `source_*` del documento de origen.
    const [fullOriginal] = await db
      .select()
      .from(equipment)
      .where(eq(equipment.id, original.id))
      .limit(1);

    await db.transaction(async (tx) => {
      await tx.insert(equipment).values({
        id: copyId,
        assetCode: parsed.assetCode.toUpperCase(),
        // El número de serie es del objeto físico: se copia el dato tal cual
        // venga, y el propio Zod lo rechaza si coincide con el del original.
        serialNumber: parsed.serialNumber || null,
        equipmentTypeId: fullOriginal?.equipmentTypeId ?? original.equipmentTypeId,
        restaurantId: parsed.toRestaurantId,
        // La copia de un equipo prestado es del propietario, no de quien lo
        // tiene: el préstamo no transfiere propiedad.
        ownerRestaurantId:
          fullOriginal?.ownerRestaurantId ?? original.ownerRestaurantId,
        originEquipmentId: original.id,
        brand: fullOriginal?.brand ?? null,
        model: fullOriginal?.model ?? null,
        purchaseDate: fullOriginal?.purchaseDate ?? null,
        installationDate: fullOriginal?.installationDate ?? null,
        status: EQUIPMENT_STATUS.ACTIVE,
        notes: parsed.notes || null,
        // Las columnas de trazabilidad se heredan: la copia viene del mismo
        // documento, aunque su código y su serie sean propios.
        sourceDocument: fullOriginal?.sourceDocument ?? null,
        sourceShortCode: fullOriginal?.sourceShortCode ?? null,
        sourceDescription: fullOriginal?.sourceDescription ?? null,
        sourceQrCode: fullOriginal?.sourceQrCode ?? null,
        sourceTechnician: fullOriginal?.sourceTechnician ?? null,
        sourceDateText: fullOriginal?.sourceDateText ?? null,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(equipmentHistory).values({
        id: newId(),
        equipmentId: original.id,
        restaurantId: original.restaurantId,
        action: EQUIPMENT_ACTIONS.COPIED,
        description: movementDescription({
          type: EQUIPMENT_MOVEMENT_TYPES.COPY,
          fromName,
          toName,
          counterpartCode: parsed.assetCode.toUpperCase(),
          reason: parsed.reason || null,
        }),
        performedBy: user.id,
        createdAt: now,
      });

      await tx.insert(equipmentHistory).values({
        id: newId(),
        equipmentId: copyId,
        restaurantId: parsed.toRestaurantId,
        action: EQUIPMENT_ACTIONS.REGISTERED,
        description: movementDescription({
          type: EQUIPMENT_MOVEMENT_TYPES.COPY,
          fromName,
          toName,
          counterpartCode: original.assetCode,
          reason: parsed.reason || null,
        }),
        performedBy: user.id,
        createdAt: now,
      });

      // El libro asienta la COPIA como el equipo movido, con el original como
      // equipo par. Así el ledger se lee en la dirección del movimiento.
      await tx.insert(equipmentMovements).values({
        id: newId(),
        batchId,
        type: EQUIPMENT_MOVEMENT_TYPES.COPY,
        equipmentId: copyId,
        counterpartEquipmentId: original.id,
        fromRestaurantId: original.restaurantId,
        toRestaurantId: parsed.toRestaurantId,
        assetCode: parsed.assetCode.toUpperCase(),
        equipmentTypeId: fullOriginal?.equipmentTypeId ?? original.equipmentTypeId,
        reason: parsed.reason || null,
        notes: parsed.notes || null,
        performedBy: user.id,
        createdAt: now,
      });
    });

    revalidateMovementViews([original.id, copyId]);
    return {
      ok: true,
      message: `Copia ${parsed.assetCode.toUpperCase()} creada en ${toName ?? "la unidad destino"}.`,
    };
  } catch (error) {
    return toResult(error);
  }
}

// ─── Sustitución ─────────────────────────────────────────────────────────────

export async function replaceEquipment(
  input: unknown
): Promise<MovementActionResult> {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  try {
    const parsed = replaceEquipmentSchema.parse(input);
    const scope = await resolveScope();

    const map = await loadEquipmentForScope([parsed.equipmentId], [
      parsed.toRestaurantId,
    ]);
    const replaced = map.get(parsed.equipmentId);
    if (!replaced) {
      return { ok: false, error: "Equipo no encontrado o fuera de tu alcance." };
    }
    assertRestaurantAccess(scope, replaced.restaurantId);
    assertRestaurantAccess(scope, parsed.toRestaurantId);
    await assertDestinationExists(parsed.toRestaurantId);

    const taken = await loadTakenIdentifiers();
    const replacementCheck = checkReplacement(
      replaced,
      parsed.assetCode,
      taken.assetCodes
    );
    if (!replacementCheck.ok) {
      return { ok: false, error: replacementCheck.error! };
    }
    if (
      parsed.serialNumber &&
      taken.serialNumbers.has(parsed.serialNumber.trim().toUpperCase())
    ) {
      return { ok: false, error: "Ya existe un equipo con ese número de serie." };
    }

    const now = new Date();
    const batchId = newId();
    const replacementId = newId();
    const [fromName, toName] = await Promise.all([
      restaurantName(replaced.restaurantId),
      restaurantName(parsed.toRestaurantId),
    ]);

    const [fullReplaced] = await db
      .select()
      .from(equipment)
      .where(eq(equipment.id, replaced.id))
      .limit(1);

    await db.transaction(async (tx) => {
      // El sustituto entra en la unidad destino heredando los datos del
      // antiguo. No se copia el `status` RETIRED/REPLACED: el equipo nuevo está
      // activo por definición.
      await tx.insert(equipment).values({
        id: replacementId,
        assetCode: parsed.assetCode.toUpperCase(),
        serialNumber: parsed.serialNumber || null,
        equipmentTypeId:
          fullReplaced?.equipmentTypeId ?? replaced.equipmentTypeId,
        restaurantId: parsed.toRestaurantId,
        ownerRestaurantId:
          fullReplaced?.ownerRestaurantId ?? replaced.ownerRestaurantId,
        originEquipmentId: replaced.id,
        brand: fullReplaced?.brand ?? null,
        model: fullReplaced?.model ?? null,
        purchaseDate: fullReplaced?.purchaseDate ?? null,
        installationDate: fullReplaced?.installationDate ?? null,
        status: EQUIPMENT_STATUS.ACTIVE,
        notes: parsed.notes || null,
        sourceDocument: fullReplaced?.sourceDocument ?? null,
        sourceShortCode: fullReplaced?.sourceShortCode ?? null,
        sourceDescription: fullReplaced?.sourceDescription ?? null,
        sourceQrCode: fullReplaced?.sourceQrCode ?? null,
        sourceTechnician: fullReplaced?.sourceTechnician ?? null,
        sourceDateText: fullReplaced?.sourceDateText ?? null,
        createdAt: now,
        updatedAt: now,
      });

      // El sustituido sale del servicio y queda enlazado con su sustituto. La
      // flecha inversa ("a qué sustituyó este") sale de esta columna; la
      // dirección "a qué equipo sustituyó el nuevo" se lee en el libro.
      await tx
        .update(equipment)
        .set({
          status: EQUIPMENT_STATUS.REPLACED,
          replacedByEquipmentId: replacementId,
          updatedAt: now,
        })
        .where(eq(equipment.id, replaced.id));

      await tx.insert(equipmentHistory).values({
        id: newId(),
        equipmentId: replaced.id,
        restaurantId: replaced.restaurantId,
        action: EQUIPMENT_ACTIONS.REPLACED_BY,
        description: movementDescription({
          type: EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
          fromName,
          toName,
          counterpartCode: parsed.assetCode.toUpperCase(),
          reason: parsed.reason || null,
        }),
        performedBy: user.id,
        createdAt: now,
      });

      await tx.insert(equipmentHistory).values({
        id: newId(),
        equipmentId: replacementId,
        restaurantId: parsed.toRestaurantId,
        action: EQUIPMENT_ACTIONS.REGISTERED,
        description: movementDescription({
          type: EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
          fromName,
          toName,
          counterpartCode: replaced.assetCode,
          reason: parsed.reason || null,
        }),
        performedBy: user.id,
        createdAt: now,
      });

      await tx.insert(equipmentMovements).values({
        id: newId(),
        batchId,
        type: EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
        equipmentId: replacementId,
        counterpartEquipmentId: replaced.id,
        fromRestaurantId: replaced.restaurantId,
        toRestaurantId: parsed.toRestaurantId,
        assetCode: parsed.assetCode.toUpperCase(),
        equipmentTypeId:
          fullReplaced?.equipmentTypeId ?? replaced.equipmentTypeId,
        reason: parsed.reason || null,
        notes: parsed.notes || null,
        performedBy: user.id,
        createdAt: now,
      });
    });

    revalidateMovementViews([replaced.id, replacementId]);
    return {
      ok: true,
      message: `${replaced.assetCode} fue sustituido por ${parsed.assetCode.toUpperCase()}.`,
    };
  } catch (error) {
    return toResult(error);
  }
}

// ─── Archivo y eliminación ───────────────────────────────────────────────────

/**
 * Archiva un equipo: pasa a `RETIRED` y deja de entrar en los movimientos.
 *
 * Es la alternativa honesta a "borrar": conserva el QR público, el historial y
 * el libro de movimientos, y lo único que cambia es que el equipo deja de estar
 * disponible.
 */
export async function archiveEquipment(
  input: unknown
): Promise<MovementActionResult> {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  try {
    const parsed = archiveEquipmentSchema.parse(input);
    const map = await loadEquipmentForScope([parsed.equipmentId]);
    const row = map.get(parsed.equipmentId);
    if (!row) {
      return { ok: false, error: "Equipo no encontrado o fuera de tu alcance." };
    }
    if (row.status === EQUIPMENT_STATUS.RETIRED) {
      return { ok: false, error: "El equipo ya está retirado." };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(equipment)
        .set({ status: EQUIPMENT_STATUS.RETIRED, updatedAt: now })
        .where(eq(equipment.id, row.id));
      await tx.insert(equipmentHistory).values({
        id: newId(),
        equipmentId: row.id,
        restaurantId: row.restaurantId,
        action: EQUIPMENT_ACTIONS.STATUS_CHANGED,
        description: `Equipo archivado como retirado. Motivo: ${parsed.reason}`,
        performedBy: user.id,
        createdAt: now,
      });
    });

    revalidateMovementViews([row.id]);
    return { ok: true, message: `${row.assetCode} quedó archivado.` };
  } catch (error) {
    return toResult(error);
  }
}
