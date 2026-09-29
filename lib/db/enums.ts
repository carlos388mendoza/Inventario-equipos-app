/**
 * Constantes de negocio del sistema (estados, prioridades y roles).
 * Compartidas entre schema, validación e interfaz para no duplicar lógica.
 */

// ─── Roles ──────────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: "ADMIN",
  RESTAURANT_USER: "RESTAURANT_USER",
  IT_MANAGER: "IT_MANAGER",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  [ROLES.ADMIN]: "Administrador",
  [ROLES.RESTAURANT_USER]: "Usuario de restaurante",
  [ROLES.IT_MANAGER]: "IT Manager",
};

export const ALL_ROLES: UserRole[] = Object.values(ROLES);

/** Valida en runtime que un valor sea un rol conocido (los valores vienen de DB/Better Auth como string). */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && (ALL_ROLES as string[]).includes(value)
  );
}

/** Normaliza un valor a UserRole, con respaldo seguro. */
export function asUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : ROLES.RESTAURANT_USER;
}

// ─── Estados de equipo ──────────────────────────────────────────────────────
export const EQUIPMENT_STATUS = {
  ACTIVE: "ACTIVE",
  DAMAGED: "DAMAGED",
  MAINTENANCE: "MAINTENANCE",
  REPLACED: "REPLACED",
  RETIRED: "RETIRED",
} as const;

export type EquipmentStatus =
  (typeof EQUIPMENT_STATUS)[keyof typeof EQUIPMENT_STATUS];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: "Activo",
  DAMAGED: "Dañado",
  MAINTENANCE: "Mantenimiento",
  REPLACED: "Reemplazado",
  RETIRED: "Retirado",
};

export const ALL_EQUIPMENT_STATUS: EquipmentStatus[] =
  Object.values(EQUIPMENT_STATUS);

// ─── Movimientos de inventario ──────────────────────────────────────────────
/**
 * Tipos de movimiento de un equipo entre unidades.
 *
 * `TRANSFER` es permanente (el equipo pasa a ser de la unidad destino).
 * `PULL` también es permanente: la diferencia es de intención, "jalar" significa
 * traer el equipo de vuelta a una unidad en lugar de enviarlo.
 * `LOAN_OUT` y `LOAN_RETURN` son el préstamo y su devolución: el propietario no
 * cambia, solo la ubicación, y por eso el equipo mantiene `ownerRestaurantId`.
 */
export const EQUIPMENT_MOVEMENT_TYPES = {
  TRANSFER: "TRANSFER",
  COPY: "COPY",
  PULL: "PULL",
  LOAN_OUT: "LOAN_OUT",
  LOAN_RETURN: "LOAN_RETURN",
  REPLACEMENT: "REPLACEMENT",
} as const;

export type EquipmentMovementType =
  (typeof EQUIPMENT_MOVEMENT_TYPES)[keyof typeof EQUIPMENT_MOVEMENT_TYPES];

export const ALL_EQUIPMENT_MOVEMENT_TYPES: EquipmentMovementType[] =
  Object.values(EQUIPMENT_MOVEMENT_TYPES);

export const EQUIPMENT_MOVEMENT_TYPE_LABELS: Record<
  EquipmentMovementType,
  string
> = {
  TRANSFER: "Traslado",
  COPY: "Copia",
  PULL: "Jalado",
  LOAN_OUT: "Préstamo",
  LOAN_RETURN: "Devolución",
  REPLACEMENT: "Sustitución",
};

/** Etiquetas cortas para chips y tablas densas. */
export const EQUIPMENT_MOVEMENT_TYPE_SHORT_LABELS: Record<
  EquipmentMovementType,
  string
> = {
  TRANSFER: "Traslado",
  COPY: "Copia",
  PULL: "Jalado",
  LOAN_OUT: "Préstamo",
  LOAN_RETURN: "Devolución",
  REPLACEMENT: "Sustitución",
};

/** Valida en runtime un tipo de movimiento vindo del cliente o de la DB. */
export function isEquipmentMovementType(
  value: unknown
): value is EquipmentMovementType {
  return (
    typeof value === "string" &&
    (ALL_EQUIPMENT_MOVEMENT_TYPES as string[]).includes(value)
  );
}

// ─── Estados de solicitud ───────────────────────────────────────────────────
export const REQUEST_STATUS = {
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type RequestStatus =
  (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "Pendiente",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const ALL_REQUEST_STATUS: RequestStatus[] = Object.values(REQUEST_STATUS);

/** Solicitudes consideradas "activas" para los dashboards. */
export const ACTIVE_REQUEST_STATUS: RequestStatus[] = [
  REQUEST_STATUS.PENDING,
  REQUEST_STATUS.IN_REVIEW,
  REQUEST_STATUS.APPROVED,
];

/** Solicitudes consideradas "históricas" (finalizadas). */
export const CLOSED_REQUEST_STATUS: RequestStatus[] = [
  REQUEST_STATUS.REJECTED,
  REQUEST_STATUS.COMPLETED,
  REQUEST_STATUS.CANCELLED,
];

// ─── Prioridades de solicitud ───────────────────────────────────────────────
export const REQUEST_PRIORITY = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export type RequestPriority =
  (typeof REQUEST_PRIORITY)[keyof typeof REQUEST_PRIORITY];

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const ALL_REQUEST_PRIORITY: RequestPriority[] =
  Object.values(REQUEST_PRIORITY);

// ─── Formatos de inventario ─────────────────────────────────────────────────

/**
 * Los documentos de inventario entregados no comparten estructura, así que el
 * sistema representa los dos formatos por separado en vez de forzar uno solo.
 */
export const INVENTORY_FORMAT = {
  /**
   * Una fila por equipo físico, con identidad propia (activo, serie, técnico
   * de apertura). Es el formato de INVENTARIO PH01.xlsx y se guarda en la tabla
   * `equipment`, de modo que cada equipo puede tener etiqueta, QR y solicitudes.
   */
  PER_ASSET: "PER_ASSET",
  /**
   * Una fila por rubro, con cantidad y valor total de la línea, sin identidad
   * por unidad. Es el formato de DENNYS 19 - EQUIPO SISTEMAS (DNS19.xlsx) y se
   * guarda en `equipment_groups`: un agregado no es un equipo individual, por
   * lo que no puede vivir en `equipment` sin perder información.
   */
  AGGREGATE: "AGGREGATE",
} as const;

export type InventoryFormat =
  (typeof INVENTORY_FORMAT)[keyof typeof INVENTORY_FORMAT];

export const INVENTORY_FORMAT_LABELS: Record<InventoryFormat, string> = {
  [INVENTORY_FORMAT.PER_ASSET]: "Por equipo",
  [INVENTORY_FORMAT.AGGREGATE]: "Agregado por rubro",
};

export const ALL_INVENTORY_FORMATS: InventoryFormat[] =
  Object.values(INVENTORY_FORMAT);

/**
 * Marcas cuyo inventario se describe con el formato agregado por rubro
 * (DNS19.xlsx). Se conservan separadas del formato por activo de INVENTARIO
 * PH01.xlsx: Denny's nunca se mezcla con Pizza Hut / KFC / China Wok.
 */
export const AGGREGATE_INVENTORY_BRANDS = ["Denny's"] as const;
