import { and, count, eq, inArray, ne } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import {
  equipment,
  equipmentGroups,
  equipmentHistory,
  equipmentMovements,
  equipmentRequests,
  restaurants,
  securityLabels,
} from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";

/**
 * Cualquier cliente Drizzle sobre libSQL: sirve el `db` de la app y el de un
 * SQLite temporal en los tests. La función recibe el cliente en vez de importar
 * el singleton para que sea comprobable sin red ni variables de entorno.
 */
export type ConsolidatableDb = LibSQLDatabase<typeof schema>;

/**
 * El tipo que Drizzle pasa al callback de `transaction`. Comparte los métodos de
 * consulta con el cliente, pero no es asignable a `LibSQLDatabase` (le falta
 * `batch`), así que las funciones que solo LEEN aceptan cualquiera de los dos.
 * Las que ESCRIBEN usan el cliente completo, que sí expone `transaction`.
 */
export type ConsolidatableTx = Parameters<
  Parameters<ConsolidatableDb["transaction"]>[0]
>[0];

export type Queryable = ConsolidatableDb | ConsolidatableTx;

/** Error de validación previo a cualquier escritura. */
export class ConsolidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsolidationError";
  }
}

/** Qué arrastra una unidad consigo, para decidir con los números delante. */
export interface UnitRelations {
  /** Equipos con esta unidad como ubicación actual. */
  equipment: number;
  /** De esos, cuántos tienen etiqueta con token. */
  labelled: number;
  groups: number;
  requests: number;
  /** Historial de la unidad: auditoría que se conserva bajo la unidad retirada. */
  history: number;
  /** Movimientos que tocan la unidad como origen o destino. */
  movementsAsSource: number;
  movementsAsTarget: number;
  /** Equipos de otra unidad con esta unidad como propietaria (préstamos). */
  ownersElsewhere: number;
}

export interface ConsolidationPlan {
  source: { id: string; code: string; name: string; active: boolean };
  target: { id: string; code: string; name: string; active: boolean };
  relations: UnitRelations;
  /** Ids de los equipos a mover, ordenados por `asset_code`. */
  equipmentIds: string[];
  /**
   * `owner_restaurant_id` que apunta a la unidad origen. Debería ser 0: la regla de
   * préstamo es "propietario distinto de ubicación", así que un propietario en la
   * fuente sería un préstamo vivo que hay que decidir a mano, no de automatizar.
   */
  ownersPointingAtSource: number;
  /** `asset_code` que ya existen en el destino y harían fallar el índice único. */
  assetCodeCollisions: string[];
  /** Copias hechas en otras unidades a partir de un equipo de la fuente. */
  copiesFromElsewhere: number;
  /** Auditoría que deliberadamente se queda apuntando a la unidad retirada. */
  historyKeptUnderSource: number;
  movementsKeptUnderSource: number;
}

async function scalar(db: Queryable, rows: Promise<{ n: number }[]>): Promise<number> {
  return Number((await rows)[0]?.n ?? 0);
}

/** Inventario de dependencias de una unidad. Solo lectura. */
export async function unitRelations(
  db: Queryable,
  restaurantId: string
): Promise<UnitRelations> {
  const [equipCount, labelled, groups, requests, history, asSource, asTarget, ownersElsewhere] =
    await Promise.all([
      scalar(db, db.select({ n: count() }).from(equipment).where(eq(equipment.restaurantId, restaurantId))),
      scalar(
        db,
        db
          .select({ n: count() })
          .from(securityLabels)
          .innerJoin(equipment, eq(securityLabels.equipmentId, equipment.id))
          .where(eq(equipment.restaurantId, restaurantId))
      ),
      scalar(db, db.select({ n: count() }).from(equipmentGroups).where(eq(equipmentGroups.restaurantId, restaurantId))),
      scalar(
        db,
        db.select({ n: count() }).from(equipmentRequests).where(eq(equipmentRequests.restaurantId, restaurantId))
      ),
      scalar(
        db,
        db.select({ n: count() }).from(equipmentHistory).where(eq(equipmentHistory.restaurantId, restaurantId))
      ),
      scalar(
        db,
        db
          .select({ n: count() })
          .from(equipmentMovements)
          .where(eq(equipmentMovements.fromRestaurantId, restaurantId))
      ),
      scalar(
        db,
        db
          .select({ n: count() })
          .from(equipmentMovements)
          .where(eq(equipmentMovements.toRestaurantId, restaurantId))
      ),
      scalar(
        db,
        db.select({ n: count() }).from(equipment).where(eq(equipment.ownerRestaurantId, restaurantId))
      ),
    ]);

  return {
    equipment: equipCount,
    labelled,
    groups,
    requests,
    history,
    movementsAsSource: asSource,
    movementsAsTarget: asTarget,
    ownersElsewhere,
  };
}

/**
 * Equipos de OTRAS unidades que apuntan a un equipo de esta unidad como origen
 * de una copia o como equipo sustituido. No estorban (esas FK no se tocan), pero
 * conviene conocerlos: si en el futuro se retirara la unidad, el linaje quedaría
 * apuntando a una unidad sin nombre visible.
 *
 * Solo mira `origin_equipment_id`: es la única columna que se rellena al crear
 * una copia, y es la que sobrevive a la consolidación.
 */
async function countCopiesFromElsewhere(
  db: Queryable,
  restaurantId: string,
  sourceEquipmentIds: string[]
): Promise<number> {
  if (sourceEquipmentIds.length === 0) return 0;
  const rows = await db
    .select({ n: count() })
    .from(equipment)
    .where(
      and(
        inArray(equipment.originEquipmentId, sourceEquipmentIds),
        ne(equipment.restaurantId, restaurantId)
      )
    );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Reúne los datos de una consolidación sin escribir nada, para poder revisarla
 * antes de decidir. `apply` vuelve a leer este mismo plan dentro de la
 * transacción, así que un plan viejo nunca se aplica a ciegas.
 */
export async function planUnitConsolidation(
  db: Queryable,
  sourceCode: string,
  targetCode: string
): Promise<ConsolidationPlan> {
  if (sourceCode === targetCode) {
    throw new ConsolidationError("La unidad origen y la unidad destino son la misma.");
  }

  const [[source], [target]] = await Promise.all([
    db.select().from(restaurants).where(eq(restaurants.code, sourceCode)).limit(1),
    db.select().from(restaurants).where(eq(restaurants.code, targetCode)).limit(1),
  ]);

  if (!source) throw new ConsolidationError(`No existe la unidad ${sourceCode}.`);
  if (!target) throw new ConsolidationError(`No existe la unidad ${targetCode}.`);

  const relations = await unitRelations(db, source.id);

  const sourceRows = await db
    .select({ id: equipment.id, assetCode: equipment.assetCode })
    .from(equipment)
    .where(eq(equipment.restaurantId, source.id))
    .orderBy(equipment.assetCode);

  const owners = await db
    .select({ n: count() })
    .from(equipment)
    .where(eq(equipment.ownerRestaurantId, source.id));
  const ownersPointingAtSource = Number(owners[0]?.n ?? 0);

  // El índice único de `asset_code` haría fallar el UPDATE a mitad de la
  // transacción, así que la colisión se busca ANTES de mover nada.
  const targetRows = await db
    .select({ assetCode: equipment.assetCode })
    .from(equipment)
    .where(eq(equipment.restaurantId, target.id));
  const targetCodes = new Set(targetRows.map((r) => r.assetCode.toUpperCase()));
  const assetCodeCollisions = sourceRows
    .map((r) => r.assetCode)
    .filter((code) => targetCodes.has(code.toUpperCase()));

  const sourceIds = sourceRows.map((r) => r.id);
  const copiesFromElsewhere = await countCopiesFromElsewhere(db, source.id, sourceIds);

  return {
    source: { id: source.id, code: source.code, name: source.name, active: source.active },
    target: { id: target.id, code: target.code, name: target.name, active: target.active },
    relations,
    equipmentIds: sourceIds,
    ownersPointingAtSource,
    assetCodeCollisions,
    copiesFromElsewhere,
    historyKeptUnderSource: relations.history,
    movementsKeptUnderSource: relations.movementsAsSource + relations.movementsAsTarget,
  };
}

export interface ConsolidationResult {
  sourceCode: string;
  targetCode: string;
  movedEquipment: number;
  deactivatedSource: boolean;
  /** Ids efectivamente actualizados, para comprobar que no se perdió ninguno. */
  movedIds: string[];
}

export interface ConsolidateOptions {
  /** Deja la unidad origen visible. Por defecto se retira (`active = false`). */
  deactivateSource?: boolean;
  now?: Date;
}

/**
 * Ejecuta la consolidación dentro de UNA transacción.
 *
 * Escribe exactamente dos cosas: `equipment.restaurant_id` de los equipos de la
 * fuente y `restaurants.active` de la unidad que se retira.
 *
 * Deliberadamente NO escribe en otras columnas: ni `updated_at` de los equipos
 * (el traslado no es un cambio de estado del equipo, solo de su unidad, y tocar
 * esa fecha falsearía la antigüedad registrada), ni `owner_restaurant_id` (si
 * algún equipo tuviera como propietario la unidad que se retira, la operación se
 * aborta antes y exige una decisión explícita en lugar de inventarla).
 *
 * No hay ningún `DELETE`. La unidad retirada permanece para que el historial siga
 * teniendo un nombre que mostrar, y `equipment_history` / `equipment_movements`
 * conservan la referencia a la unidad origen a propósito: un movimiento pasado
 * dice "este equipo salió de PH01", y reescribirlo volvería falso un registro.
 *
 * Es idempotente: si la fuente ya no tiene equipos, no cambia nada y lo dice.
 */
export async function consolidateUnit(
  db: ConsolidatableDb,
  sourceCode: string,
  targetCode: string,
  options: ConsolidateOptions = {}
): Promise<ConsolidationResult> {
  const { deactivateSource = true, now = new Date() } = options;

  return db.transaction(async (tx) => {
    const plan = await planUnitConsolidation(tx, sourceCode, targetCode);

    if (plan.assetCodeCollisions.length > 0) {
      throw new ConsolidationError(
        `${plan.assetCodeCollisions.length} asset_code(s) ya existen en ${targetCode} ` +
          `(${plan.assetCodeCollisions.slice(0, 5).join(", ")}). No se movió nada.`
      );
    }
    if (plan.relations.groups > 0) {
      throw new ConsolidationError(
        `${sourceCode} tiene ${plan.relations.groups} grupo(s) de inventario. Revísalos antes de consolidar.`
      );
    }
    if (plan.relations.requests > 0) {
      throw new ConsolidationError(
        `${sourceCode} tiene ${plan.relations.requests} solicitud(es). Revísalas antes de consolidar.`
      );
    }
    if (plan.ownersPointingAtSource > 0) {
      throw new ConsolidationError(
        `${plan.ownersPointingAtSource} equipo(s) tienen como propietario ${sourceCode}. ` +
          "Un préstamo vivo necesita una decisión explícita; no se mueve solo."
      );
    }

    const movedIds: string[] = [];
    if (plan.equipmentIds.length > 0) {
      // Un solo UPDATE: el mismo registro, mismo id, misma fila. `.returning`
      // devuelve los ids realmente escritos, que es la prueba de que no se
      // perdió ninguno.
      const moved = await tx
        .update(equipment)
        .set({ restaurantId: plan.target.id })
        .where(eq(equipment.restaurantId, plan.source.id))
        .returning({ id: equipment.id });

      movedIds.push(...moved.map((r) => r.id));
    }

    if (deactivateSource) {
      await tx
        .update(restaurants)
        .set({ active: false, updatedAt: now })
        .where(eq(restaurants.id, plan.source.id));
    }

    return {
      sourceCode: plan.source.code,
      targetCode: plan.target.code,
      movedEquipment: movedIds.length,
      deactivatedSource: deactivateSource,
      movedIds,
    };
  });
}

/** Cuenta cuántos de los ids dados siguen asignados a una unidad concreta. */
export async function equipmentStillAssigned(
  db: Queryable,
  ids: string[],
  restaurantId: string
): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(inArray(equipment.id, ids), eq(equipment.restaurantId, restaurantId)));
  return rows.length;
}
