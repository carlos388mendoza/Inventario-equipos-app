/**
 * Constantes de negocio del sistema (estados, prioridades y roles).
 * Compartidas entre schema, validación e interfaz para no duplicar lógica.
 */

// ─── Roles ──────────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: "ADMIN",
  RESTAURANT_USER: "RESTAURANT_USER",
  IT_MANAGER: "IT_MANAGER",
  TECHNICIAN: "TECHNICIAN",
  HEAD_TECHNICIAN: "HEAD_TECHNICIAN",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  [ROLES.ADMIN]: "Administrador",
  [ROLES.RESTAURANT_USER]: "Usuario de restaurante",
  [ROLES.IT_MANAGER]: "IT Manager",
  [ROLES.TECHNICIAN]: "Técnico",
  [ROLES.HEAD_TECHNICIAN]: "Jefe de técnicos",
};

export const ALL_ROLES: UserRole[] = Object.values(ROLES);

/**
 * Roles técnicos: pueden registrar solicitudes en nombre de VARIOS
 * restaurantes que tengan asignados (tabla de asignaciones) y no dependen de
 * un único `user.restaurantId`. El jefe de técnicos añade la gestión de esas
 * asignaciones dentro de su alcance.
 */
export const TECHNICIAN_ROLES: UserRole[] = [
  ROLES.TECHNICIAN,
  ROLES.HEAD_TECHNICIAN,
];

/** Roles que gestionan solicitudes (crean y cambian estado) en todo el alcance. */
export const REQUEST_MANAGER_ROLES: UserRole[] = [
  ROLES.ADMIN,
  ROLES.IT_MANAGER,
];

export function isTechnicianRole(role: UserRole): boolean {
  return TECHNICIAN_ROLES.includes(role);
}

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

// ─── Área de destino del equipo (issue #14) ─────────────────────────────────
/**
 * Dónde se instalará el equipo dentro del restaurante. Es distinto del
 * restaurante de destino (`equipment_requests.restaurantId`) y de la ubicación
 * actual del equipo: identifica el área física (cocina, counter, etc.).
 *
 * Los cuatro valores iniciales provienen del issue. La lista se amplía aquí en
 * un solo sitio; el servidor valida contra ella, así que el cliente no puede
 * inventar áreas.
 */
export const DESTINATION_AREA = {
  COCINA: "COCINA",
  DESPACHO: "DESPACHO",
  DOMICILIO: "DOMICILIO",
  COUNTER: "COUNTER",
} as const;

export type DestinationArea =
  (typeof DESTINATION_AREA)[keyof typeof DESTINATION_AREA];

export const DESTINATION_AREA_LABELS: Record<DestinationArea, string> = {
  COCINA: "Cocina",
  DESPACHO: "Despacho",
  DOMICILIO: "Área de domicilio",
  COUNTER: "Counter",
};

export const ALL_DESTINATION_AREAS: DestinationArea[] =
  Object.values(DESTINATION_AREA);

export function isDestinationArea(value: unknown): value is DestinationArea {
  return (
    typeof value === "string" &&
    (ALL_DESTINATION_AREAS as string[]).includes(value)
  );
}

// ─── Seguimiento de instalación (issue #13) ─────────────────────────────────
/**
 * Estado de instalación de una solicitud aprobada. Es independiente del
 * `status` de la solicitud: una solicitud `APPROVED` NO significa que el equipo
 * se haya instalado ni incorporado al inventario. Solo la confirmación de la
 * unidad (o el rechazo) cambia este campo.
 */
export const REQUEST_INSTALLATION_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  NOT_INSTALLED: "NOT_INSTALLED",
} as const;

export type RequestInstallationStatus =
  (typeof REQUEST_INSTALLATION_STATUS)[keyof typeof REQUEST_INSTALLATION_STATUS];

export const REQUEST_INSTALLATION_STATUS_LABELS: Record<
  RequestInstallationStatus,
  string
> = {
  PENDING: "Instalación pendiente de confirmar",
  CONFIRMED: "Instalación confirmada",
  NOT_INSTALLED: "Aún no se ha instalado",
};

export const ALL_REQUEST_INSTALLATION_STATUS: RequestInstallationStatus[] =
  Object.values(REQUEST_INSTALLATION_STATUS);

// ─── Notificaciones de solicitud (outbox, issue #13) ────────────────────────
export const REQUEST_NOTIFICATION_TYPE = {
  REQUEST_CREATED: "REQUEST_CREATED",
  REQUEST_APPROVED: "REQUEST_APPROVED",
  REQUEST_REJECTED: "REQUEST_REJECTED",
  FOLLOW_UP: "FOLLOW_UP",
  INSTALLATION_CONFIRMED: "INSTALLATION_CONFIRMED",
  INSTALLATION_NOT_INSTALLED: "INSTALLATION_NOT_INSTALLED",
} as const;

export type RequestNotificationType =
  (typeof REQUEST_NOTIFICATION_TYPE)[keyof typeof REQUEST_NOTIFICATION_TYPE];

export const REQUEST_NOTIFICATION_TYPE_LABELS: Record<
  RequestNotificationType,
  string
> = {
  REQUEST_CREATED: "Solicitud registrada",
  REQUEST_APPROVED: "Solicitud aprobada",
  REQUEST_REJECTED: "Solicitud rechazada",
  FOLLOW_UP: "Seguimiento de instalación",
  INSTALLATION_CONFIRMED: "Instalación confirmada",
  INSTALLATION_NOT_INSTALLED: "Instalación aún no realizada",
};

export const REQUEST_NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
} as const;

export type RequestNotificationStatus =
  (typeof REQUEST_NOTIFICATION_STATUS)[keyof typeof REQUEST_NOTIFICATION_STATUS];

/** Tipos de notificación que se envían una sola vez por solicitud. */
export const ONE_SHOT_NOTIFICATION_TYPES: RequestNotificationType[] = [
  REQUEST_NOTIFICATION_TYPE.REQUEST_CREATED,
  REQUEST_NOTIFICATION_TYPE.REQUEST_APPROVED,
  REQUEST_NOTIFICATION_TYPE.REQUEST_REJECTED,
  REQUEST_NOTIFICATION_TYPE.FOLLOW_UP,
  REQUEST_NOTIFICATION_TYPE.INSTALLATION_CONFIRMED,
  REQUEST_NOTIFICATION_TYPE.INSTALLATION_NOT_INSTALLED,
];

/** Días de espera antes del correo de seguimiento de instalación. */
export const INSTALLATION_FOLLOW_UP_DAYS = 5;

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
