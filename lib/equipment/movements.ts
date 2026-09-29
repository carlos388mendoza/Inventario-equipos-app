/**
 * Lógica de negocio del módulo de Movimientos de Inventario.
 *
 * Este módulo es deliberadamente PURO: no importa Drizzle, ni `server-only`,
 * ni nada del DOM. Solo recibe datos planos y devuelve decisiones. Eso permite
 * ejercitar todas las reglas en `movements.test.ts` sin base de datos ni
 * servidor, y deja las server actions de `movements/actions.ts` reducidas a
 * autorizar, traducir a SQL y escribir.
 *
 * Modelo de dominio en una frase:
 *
 * - `restaurantId` de un equipo es DÓNDE está.
 * - `ownerRestaurantId` es DE QUIÉN es, y solo se separa de la ubicación
 *   mientras hay un préstamo vigente.
 *
 * De ahí sale la regla que gobierna el resto del módulo: un equipo está en
 * préstamo si y solo si tiene propietario y ese propietario no es su
 * ubicación actual. Ver `isOnLoan`.
 */

import {
  EQUIPMENT_MOVEMENT_TYPES,
  EQUIPMENT_MOVEMENT_TYPE_LABELS,
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentMovementType,
  type EquipmentStatus,
} from "../db/enums";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Datos mínimos de un equipo que necesita una regla de movimiento. */
export interface MovableEquipment {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  equipmentTypeId: string;
  /** Ubicación actual. */
  restaurantId: string;
  /** Propietario real; `null` significa que es la unidad donde está. */
  ownerRestaurantId: string | null;
  status: EquipmentStatus;
}

export interface MovementDestination {
  restaurantId: string;
  name: string;
  code: string;
}

export interface CopyInput {
  /** Código de activo de la copia. Obligatorio y único. */
  assetCode: string;
  /**
   * Serie física del equipo nuevo. Vacío significa que aún no se conoce.
   * Nunca puede coincidir con la del original: el número de serie es del
   * objeto físico, no de la fila.
   */
  serialNumber?: string | null;
}

export interface MovementReason {
  reason: string;
  notes?: string | null;
}

// ─── Préstamo ────────────────────────────────────────────────────────────────

/**
 * Un equipo está en préstamo cuando tiene un propietario distinto de su
 * ubicación actual. Es la única fuente de verdad: no hay una columna de estado
 * que pueda desincronizarse.
 */
export function isOnLoan(
  equipment: Pick<MovableEquipment, "restaurantId" | "ownerRestaurantId">
): boolean {
  return (
    equipment.ownerRestaurantId !== null &&
    equipment.ownerRestaurantId !== equipment.restaurantId
  );
}

/**
 * Propietario efectivo: el explícito si existe, si no la ubicación actual.
 * Devolver esto en vez de leer `ownerRestaurantId` a mano evita mostrar
 * "propietario desconocido" en los equipos que nunca se prestaron.
 */
export function effectiveOwnerRestaurantId(
  equipment: Pick<MovableEquipment, "restaurantId" | "ownerRestaurantId">
): string {
  return equipment.ownerRestaurantId ?? equipment.restaurantId;
}

/** Texto de la etiqueta de préstamo para la interfaz. */
export function loanStatusLabel(
  equipment: MovableEquipment,
  destinationName?: string
): string | null {
  if (!isOnLoan(equipment)) {
    return null;
  }
  return destinationName
    ? `En préstamo · reside en ${destinationName}`
    : "En préstamo";
}

// ─── Catálogo de movimientos ─────────────────────────────────────────────────

export interface MovementDefinition {
  type: EquipmentMovementType;
  label: string;
  description: string;
  /**
   * Si el movimiento crea un EQUIPO NUEVO. Solo las copias y las sustituciones
   * con equipo nuevo lo hacen; el resto reutiliza la identidad existente.
   */
  createsEquipment: boolean;
  /** Si `toRestaurantId` debe ser distinto de la ubicación actual. */
  requiresDifferentDestination: boolean;
  /** Si el propietario se separa de la ubicación (préstamo) o se reestablece. */
  changesOwnership: boolean;
  /** Si admite varios equipos en la misma operación. */
  supportsBatch: boolean;
  /** Estados en los que el equipo admite este movimiento. */
  allowedStatuses: EquipmentStatus[];
}

const ANY_STATUS: EquipmentStatus[] = Object.values(EQUIPMENT_STATUS);

/** Estados en los que el equipo ya no está en servicio. */
const OUT_OF_SERVICE: EquipmentStatus[] = [
  EQUIPMENT_STATUS.RETIRED,
  EQUIPMENT_STATUS.REPLACED,
];

export const MOVEMENT_DEFINITIONS: Record<
  EquipmentMovementType,
  MovementDefinition
> = {
  [EQUIPMENT_MOVEMENT_TYPES.TRANSFER]: {
    type: EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
    label: EQUIPMENT_MOVEMENT_TYPE_LABELS.TRANSFER,
    description:
      "El equipo pasa a ser de la unidad destino. Conserva su identidad, su número de serie, su etiqueta y todo su historial.",
    createsEquipment: false,
    requiresDifferentDestination: true,
    changesOwnership: true,
    supportsBatch: true,
    allowedStatuses: ANY_STATUS,
  },
  [EQUIPMENT_MOVEMENT_TYPES.PULL]: {
    type: EQUIPMENT_MOVEMENT_TYPES.PULL,
    label: EQUIPMENT_MOVEMENT_TYPE_LABELS.PULL,
    description:
      "El equipo vuelve a una unidad concreta. El efecto sobre la ubicación es un traslado; queda registrado aparte para poder distinguir \"lo traje de vuelta\" de \"lo mandé\". Si el equipo estaba en préstamo, la devolución la hace el propietario.",
    createsEquipment: false,
    requiresDifferentDestination: true,
    changesOwnership: true,
    supportsBatch: true,
    allowedStatuses: ANY_STATUS,
  },
  [EQUIPMENT_MOVEMENT_TYPES.COPY]: {
    type: EQUIPMENT_MOVEMENT_TYPES.COPY,
    label: EQUIPMENT_MOVEMENT_TYPE_LABELS.COPY,
    description:
      "Se crea un equipo nuevo con los mismos datos. El original no se mueve y conserva su serie y su etiqueta; la copia necesita código y serie propios.",
    createsEquipment: true,
    requiresDifferentDestination: true,
    changesOwnership: true,
    supportsBatch: false,
    allowedStatuses: ANY_STATUS,
  },
  [EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT]: {
    type: EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
    label: EQUIPMENT_MOVEMENT_TYPE_LABELS.LOAN_OUT,
    description:
      "El equipo sale temporalmente a otra unidad. No deja de pertenecer a su propietario, así que la devolución lo devuelve a casa.",
    createsEquipment: false,
    requiresDifferentDestination: true,
    changesOwnership: true,
    supportsBatch: true,
    allowedStatuses: [
      EQUIPMENT_STATUS.ACTIVE,
      EQUIPMENT_STATUS.DAMAGED,
      EQUIPMENT_STATUS.MAINTENANCE,
    ],
  },
  [EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN]: {
    type: EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN,
    label: EQUIPMENT_MOVEMENT_TYPE_LABELS.LOAN_RETURN,
    description:
      "El equipo vuelve a su unidad propietaria y queda disponible para volver a moverse.",
    createsEquipment: false,
    requiresDifferentDestination: true,
    changesOwnership: true,
    supportsBatch: true,
    allowedStatuses: ANY_STATUS,
  },
  [EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT]: {
    type: EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
    label: EQUIPMENT_MOVEMENT_TYPE_LABELS.REPLACEMENT,
    description:
      "Un equipo entra a sustituir a otro. El sustituido queda fuera de servicio y enlazado con su sustituto, y el nuevo hereda los datos del antiguo.",
    createsEquipment: true,
    requiresDifferentDestination: true,
    changesOwnership: true,
    supportsBatch: false,
    allowedStatuses: [
      EQUIPMENT_STATUS.ACTIVE,
      EQUIPMENT_STATUS.DAMAGED,
      EQUIPMENT_STATUS.MAINTENANCE,
    ],
  },
};

export function movementDefinition(
  type: EquipmentMovementType
): MovementDefinition {
  return MOVEMENT_DEFINITIONS[type];
}

/** Movimientos que la interfaz puede lanzar sobre UN equipo existente. */
export const SINGLE_EQUIPMENT_MOVEMENTS: EquipmentMovementType[] = [
  EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
  EQUIPMENT_MOVEMENT_TYPES.PULL,
  EQUIPMENT_MOVEMENT_TYPES.COPY,
  EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
  EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
];

/** Movimientos disponibles sobre una selección de varios equipos. */
export const BATCH_MOVEMENTS: EquipmentMovementType[] = [
  EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
  EQUIPMENT_MOVEMENT_TYPES.PULL,
  EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
];

// ─── Validación ──────────────────────────────────────────────────────────────

export interface MovementCheck {
  ok: boolean;
  /** Motivo en español, listo para mostrar. `null` si `ok`. */
  error: string | null;
}

const OK: MovementCheck = { ok: true, error: null };

function fail(error: string): MovementCheck {
  return { ok: false, error };
}

/**
 * Valida un traslado, jalado, préstamo o devolución contra un equipo concreto.
 *
 * `toRestaurantId` es obligatorio porque todas las operaciones que pasan por
 * aquí cambian de ubicación. Para una devolución, quien llama lo deduce del
 * propietario con `effectiveOwnerRestaurantId`, de modo que el usuario no
 * puede devolver un equipo a un sitio arbitrario.
 */
export function checkLocationChange(
  equipment: MovableEquipment,
  type: EquipmentMovementType,
  toRestaurantId: string | null | undefined
): MovementCheck {
  const definition = MOVEMENT_DEFINITIONS[type];

  if (!equipment) {
    return fail("Equipo no encontrado.");
  }
  if (!toRestaurantId) {
    return fail("Selecciona la unidad destino.");
  }

  const statusLabel =
    EQUIPMENT_STATUS_LABELS[equipment.status] ?? equipment.status;

  // 1. El estado del préstamo va PRIMERO, antes que el destino. Si a un equipo
  //    que no está prestado le pides una devolución, el motivo real no es que
  //    las unidades coincidan: es que no hay nada que devolver. Diagnosticar en
  //    orden inverso mandaría al usuario a cambiar de unidad en lugar de a
  //    usar la operación correcta.
  if (type === EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN && !isOnLoan(equipment)) {
    return fail("Este equipo no está en préstamo.");
  }
  if (type === EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT && isOnLoan(equipment)) {
    return fail("El equipo ya está en préstamo: devuélvelo antes de moverlo.");
  }
  if (
    (type === EQUIPMENT_MOVEMENT_TYPES.TRANSFER ||
      type === EQUIPMENT_MOVEMENT_TYPES.PULL) &&
    isOnLoan(equipment)
  ) {
    // Trasladar o jalar un equipo prestado lo devolvería implícitamente sin
    // dejar rastro de la devolución, y su propietario dejaría de coincidir con
    // la unidad donde está. Se obliga a usar la operación explícita.
    return fail(
      'El equipo está en préstamo: usa "Devolución" para que quede registrado.'
    );
  }

  // 2. El destino.
  if (
    definition.requiresDifferentDestination &&
    toRestaurantId === equipment.restaurantId
  ) {
    return fail("El equipo ya está en esa unidad.");
  }

  // 3. El estado operativo. El mensaje nombra el estado para que el usuario sepa
  //    qué tiene que corregir.
  if (!definition.allowedStatuses.includes(equipment.status)) {
    return fail(
      `Un equipo con estado "${statusLabel}" no admite "${definition.label}".`
    );
  }
  if (
    OUT_OF_SERVICE.includes(equipment.status) &&
    type !== EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN
  ) {
    return fail(`No se puede mover un equipo con estado "${statusLabel}".`);
  }

  // 4. Regla propia de la devolución: el equipo vuelve a casa, no a donde
  //    quiera quien lo tenga.
  if (
    type === EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN &&
    toRestaurantId !== equipment.ownerRestaurantId
  ) {
    return fail("La devolución solo puede hacerse a la unidad propietaria.");
  }

  return OK;
}

/**
 * Valida la creación de una copia.
 *
 * El número de serie identifica el objeto FÍSICO, así que la copia no puede
 * heredar el del original: se deja vacío hasta que se conozca. El código de
 * activo, en cambio, identifica la fila y hay que darle uno nuevo.
 */
export function checkCopyInput(
  original: MovableEquipment,
  input: CopyInput,
  takenAssetCodes: ReadonlySet<string>,
  takenSerialNumbers: ReadonlySet<string>
): MovementCheck {
  // Una copia se hace de algo que está en servicio. Copiar un equipo retirado o
  // ya sustituido significa inventarse vida útil para un objeto que ya no
  // existe físicamente, y el estado se heredaría al nuevo registro.
  if (OUT_OF_SERVICE.includes(original.status)) {
    return fail("No se puede copiar un equipo fuera de servicio.");
  }

  const assetCode = input.assetCode.trim().toUpperCase();
  if (!assetCode) {
    return fail("Indica el código de activo de la copia.");
  }
  if (assetCode === original.assetCode.toUpperCase()) {
    return fail("La copia necesita un código de activo distinto al original.");
  }
  if (takenAssetCodes.has(assetCode)) {
    return fail("Ya existe un equipo con ese código de activo.");
  }

  const serial = (input.serialNumber ?? "").trim();
  if (!serial) {
    return OK;
  }
  if (serial.toUpperCase() === (original.serialNumber ?? "").trim().toUpperCase()) {
    return fail(
      "La copia no puede llevar el mismo número de serie que el original."
    );
  }
  if (takenSerialNumbers.has(serial.toUpperCase())) {
    return fail("Ya existe un equipo con ese número de serie.");
  }
  return OK;
}

/**
 * Valida una sustitución. El equipo sustituido sale del servicio y el nuevo
 * entra en su lugar, así que ninguno de los dos puede estar ya reemplazado.
 */
export function checkReplacement(
  replaced: MovableEquipment,
  replacementAssetCode: string,
  takenAssetCodes: ReadonlySet<string>
): MovementCheck {
  if (OUT_OF_SERVICE.includes(replaced.status)) {
    return fail("Ese equipo ya está fuera de servicio.");
  }
  const code = replacementAssetCode.trim().toUpperCase();
  if (!code) {
    return fail("Indica el código de activo del equipo nuevo.");
  }
  if (code === replaced.assetCode.toUpperCase()) {
    return fail("El sustituto necesita un código de activo distinto.");
  }
  if (takenAssetCodes.has(code)) {
    return fail("Ya existe un equipo con ese código de activo.");
  }
  return OK;
}

// ─── Movimiento múltiple ─────────────────────────────────────────────────────

export interface BatchValidationItem {
  id: string;
  assetCode: string;
  check: MovementCheck;
}

export interface BatchValidation {
  /** Ítems válidos, en el orden recibido, sin duplicados por id. */
  valid: MovableEquipment[];
  /** Ítems rechazados, con su motivo. */
  rejected: BatchValidationItem[];
  /** `true` si no hay ni un solo rechazo: el lote puede aplicarse entero. */
  allOrNothing: boolean;
}

/**
 * Valida un movimiento múltiple como un TODO O NADA.
 *
 * Se recorren todos los equipos y se recogen los rechazos antes de tocar la
 * base de datos. Si hay un solo rechazo el lote no se aplica: mover 11 de 12
 * equipos dejaría la operación en un estado que nadie pidió y que el usuario no
 * ve, porque el error le llega después del commit parcial. Se prefiere un
 * "no" claro y accionable a un "sí" con letra pequeña.
 */
export function validateBatch(
  items: MovableEquipment[],
  type: EquipmentMovementType,
  toRestaurantId: string | null | undefined
): BatchValidation {
  const seen = new Set<string>();
  const unique: MovableEquipment[] = [];
  const rejected: BatchValidationItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    const check = checkLocationChange(item, type, toRestaurantId);
    if (check.ok) {
      unique.push(item);
    } else {
      rejected.push({ id: item.id, assetCode: item.assetCode, check });
    }
  }

  return { valid: unique, rejected, allOrNothing: rejected.length === 0 };
}

/** Resumen de un lote para el mensaje de éxito. */
export function summarizeBatch(
  count: number,
  type: EquipmentMovementType
): string {
  const label = MOVEMENT_DEFINITIONS[type]?.label ?? type;
  if (count === 1) {
    return `1 equipo movido (${label.toLowerCase()}).`;
  }
  return `${count} equipos movidos (${label.toLowerCase()}).`;
}

// ─── Sugerencias de código ───────────────────────────────────────────────────

/**
 * Sugiere un código de activo libre para una copia o un sustituto.
 *
 * Se deriva del original con un sufijo numérico y se comprueba contra los
 * códigos existentes. Devuelve el primer sufijo libre, de modo que la sugerencia
 * siempre es válida; la confirmación final la hace la restricción UNIQUE de la
 * base de datos dentro de la transacción.
 */
export function suggestAssetCode(
  originalAssetCode: string,
  takenAssetCodes: ReadonlySet<string>
): string {
  const base = `${originalAssetCode}-C`;
  if (!takenAssetCodes.has(base)) {
    return base;
  }
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}${n}`;
    if (!takenAssetCodes.has(candidate)) {
      return candidate;
    }
  }
  // 999 sufijos no es alcanzable, pero el tipo de retorno debe ser `string`.
  return `${base}${Date.now()}`;
}

// ─── Eliminación segura ──────────────────────────────────────────────────────

export interface DeletionBlocker {
  /** Clave estable para i18n y para el test. */
  key:
    | "label"
    | "history"
    | "movements"
    | "requests"
    | "origin"
    | "replacedBy";
  /** Cuántos registros lo bloquean. */
  count: number;
}

/**
 * Dice qué impide borrar un equipo, o `null` si nada lo impide.
 *
 * Se consulta ANTES de intentar el `DELETE`. El borrado físico se reserva a
 * filas que no dejaron rastro: un equipo recién creado por error y que nadie
 * etiquetó, prestó, movió ni solicitó. Cualquier otra cosa se archiva con
 * `RETIRED`, que conserva la auditoría y mantiene viva la URL pública del QR.
 */
export function describeDeletionBlockers(
  counts: Record<DeletionBlocker["key"], number>
): DeletionBlocker[] {
  const blockers: DeletionBlocker[] = [];
  if (counts.label > 0) {
    blockers.push({ key: "label", count: counts.label });
  }
  if (counts.history > 0) {
    blockers.push({ key: "history", count: counts.history });
  }
  if (counts.movements > 0) {
    blockers.push({ key: "movements", count: counts.movements });
  }
  if (counts.requests > 0) {
    blockers.push({ key: "requests", count: counts.requests });
  }
  if (counts.origin > 0) {
    blockers.push({ key: "origin", count: counts.origin });
  }
  if (counts.replacedBy > 0) {
    blockers.push({ key: "replacedBy", count: counts.replacedBy });
  }
  return blockers;
}

export const DELETION_BLOCKER_LABELS: Record<DeletionBlocker["key"], string> = {
  label: "etiqueta de seguridad emitida",
  history: "eventos de historial",
  movements: "movimientos registrados",
  requests: "solicitudes que lo referencian",
  origin: "equipos copiados de él",
  replacedBy: "equipos que lo sustituyen",
};

/** Mensaje completo de una eliminación bloqueada. */
export function deletionBlockedMessage(blockers: DeletionBlocker[]): string {
  const detail = blockers
    .map((b) => `${b.count} ${DELETION_BLOCKER_LABELS[b.key]}`)
    .join(", ");
  return `No se puede eliminar: el equipo tiene ${detail}. Archívalo como retirado para retirarlo del servicio sin perder la auditoría.`;
}

// ─── Resumen de una operación ────────────────────────────────────────────────

/** Construye la frase que va al `equipment_history.description`. */
export function movementDescription(params: {
  type: EquipmentMovementType;
  fromName?: string | null;
  toName?: string | null;
  counterpartCode?: string | null;
  reason?: string | null;
}): string {
  const label = MOVEMENT_DEFINITIONS[params.type]?.label ?? params.type;
  const parts: string[] = [label];

  if (params.fromName && params.toName) {
    parts.push(`${params.fromName} → ${params.toName}.`);
  } else if (params.toName) {
    parts.push(`Destino: ${params.toName}.`);
  } else if (params.fromName) {
    parts.push(`Origen: ${params.fromName}.`);
  }

  if (params.counterpartCode) {
    parts.push(`Equipo par: ${params.counterpartCode}.`);
  }
  if (params.reason) {
    parts.push(`Motivo: ${params.reason}.`);
  }
  return parts.join(" ");
}
