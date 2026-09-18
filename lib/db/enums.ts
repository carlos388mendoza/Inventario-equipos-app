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