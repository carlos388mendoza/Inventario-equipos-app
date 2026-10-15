import { and, count, desc, eq, inArray, isNotNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentRequests,
  equipmentTypes,
  requestHistory,
  restaurants,
  userTable,
} from "@/lib/db/schema";
import {
  type RequestInstallationStatus,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/db/enums";

export interface RequestWithNames {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantBrand: string | null;
  restaurantSector: string | null;
  restaurantLogo: string | null;
  requestedById: string;
  requestedByName: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  currentEquipmentId: string | null;
  currentEquipmentAssetCode: string | null;
  destinationArea: string | null;
  reason: string;
  description: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  installationStatus: RequestInstallationStatus;
  followUpDueAt: Date | null;
  followUpSentAt: Date | null;
  installationConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Consulta solicitudes con nombres desnormalizados (restaurante, tipo, usuario,
 * equipo actual).
 * - `restaurantId` filtra por una sola unidad.
 * - `restaurantIds` filtra por varias (técnicos con asignaciones múltiples).
 *   Una lista vacía devuelve cero filas: nunca se interpreta como "todas".
 */
export async function listRequests(params?: {
  restaurantId?: string;
  restaurantIds?: string[];
  status?: RequestStatus;
}): Promise<RequestWithNames[]> {
  const conditions = [];
  if (params?.restaurantIds !== undefined) {
    if (params.restaurantIds.length === 0) return [];
    conditions.push(
      inArray(equipmentRequests.restaurantId, params.restaurantIds)
    );
  }
  if (params?.restaurantId) {
    conditions.push(eq(equipmentRequests.restaurantId, params.restaurantId));
  }
  if (params?.status) {
    conditions.push(eq(equipmentRequests.status, params.status));
  }

  const rows = await db
    .select({
      request: equipmentRequests,
      restaurantName: restaurants.name,
      restaurantBrand: restaurants.brand,
      restaurantSector: restaurants.sector,
      restaurantLogo: restaurants.logo,
      requestedByName: userTable.name,
      equipmentTypeName: equipmentTypes.name,
      currentEquipmentAssetCode: equipment.assetCode,
    })
    .from(equipmentRequests)
    .innerJoin(restaurants, eq(equipmentRequests.restaurantId, restaurants.id))
    .innerJoin(userTable, eq(equipmentRequests.requestedBy, userTable.id))
    .innerJoin(
      equipmentTypes,
      eq(equipmentRequests.equipmentTypeId, equipmentTypes.id)
    )
    .leftJoin(
      equipment,
      eq(equipmentRequests.currentEquipmentId, equipment.id)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(equipmentRequests.createdAt));

  return rows.map(({ request, ...names }) => ({
    id: request.id,
    restaurantId: request.restaurantId,
    restaurantName: names.restaurantName,
    restaurantBrand: names.restaurantBrand ?? null,
    restaurantSector: names.restaurantSector ?? null,
    restaurantLogo: names.restaurantLogo ?? null,
    requestedById: request.requestedBy,
    requestedByName: names.requestedByName,
    equipmentTypeId: request.equipmentTypeId,
    equipmentTypeName: names.equipmentTypeName,
    currentEquipmentId: request.currentEquipmentId,
    currentEquipmentAssetCode: names.currentEquipmentAssetCode ?? null,
    destinationArea: request.destinationArea ?? null,
    reason: request.reason,
    description: request.description,
    priority: request.priority,
    status: request.status,
    installationStatus: request.installationStatus,
    followUpDueAt: request.followUpDueAt ?? null,
    followUpSentAt: request.followUpSentAt ?? null,
    installationConfirmedAt: request.installationConfirmedAt ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }));
}

export interface RequestHistoryWithNames {
  id: string;
  requestId: string;
  oldStatus: RequestStatus | null;
  newStatus: RequestStatus;
  comment: string | null;
  performedByName: string | null;
  createdAt: Date;
}

/** Historial de cambios de estado de una solicitud (más recientes primero). */
export async function listRequestHistory(
  requestId: string
): Promise<RequestHistoryWithNames[]> {
  return db
    .select({
      id: requestHistory.id,
      requestId: requestHistory.requestId,
      oldStatus: requestHistory.oldStatus,
      newStatus: requestHistory.newStatus,
      comment: requestHistory.comment,
      performedByName: userTable.name,
      createdAt: requestHistory.createdAt,
    })
    .from(requestHistory)
    .leftJoin(userTable, eq(requestHistory.userId, userTable.id))
    .where(eq(requestHistory.requestId, requestId))
    .orderBy(desc(requestHistory.createdAt));
}

export interface EquipmentAreaChange {
  destinationArea: string;
  total: number;
  lastChangeAt: Date;
}

/**
 * Cambios de área registrados para un equipo (issue #28).
 *
 * No existe una tabla de historial de áreas: el área vive en la solicitud de
 * reemplazo (`equipment_requests.destinationArea`). Por eso el conteo y el
 * desglose se derivan de las solicitudes cuyo `currentEquipmentId` es este
 * equipo, sin necesidad de migración. Se agrupa por área para ver cuántas veces
 * se ha movido a cada una y cuándo fue la última.
 */
export async function listEquipmentAreaChanges(
  equipmentId: string
): Promise<EquipmentAreaChange[]> {
  const rows = await db
    .select({
      destinationArea: equipmentRequests.destinationArea,
      total: count(),
      lastChangeAt: max(equipmentRequests.createdAt),
    })
    .from(equipmentRequests)
    .where(
      and(
        eq(equipmentRequests.currentEquipmentId, equipmentId),
        isNotNull(equipmentRequests.destinationArea)
      )
    )
    .groupBy(equipmentRequests.destinationArea)
    .orderBy(desc(count()));

  return rows
    .filter(
      (row): row is typeof row & { destinationArea: string } =>
        row.destinationArea !== null
    )
    .map((row) => ({
      destinationArea: row.destinationArea,
      total: row.total,
      lastChangeAt: row.lastChangeAt ?? new Date(0),
    }));
}

/**
 * Solicitante de la solicitud que originó el reemplazo de un equipo (issue #12).
 *
 * Se usa en la página pública del QR (`app/e/[token]`): el vínculo fiable es la
 * solicitud de REEMPLAZO cuyo `currentEquipmentId` es ese equipo. Se devuelve el
 * nombre de quien la creó, sea técnico o no (decisión del issue #12). La consulta
 * selecciona ÚNICAMENTE el nombre: nunca el correo, el rol ni el resto de la
 * solicitud. Si no hay ninguna solicitud de reemplazo enlazada, no se muestra
 * nada.
 */
export async function getEquipmentRequester(
  equipmentId: string
): Promise<{ name: string } | null> {
  const [row] = await db
    .select({ name: userTable.name })
    .from(equipmentRequests)
    .innerJoin(userTable, eq(equipmentRequests.requestedBy, userTable.id))
    .where(eq(equipmentRequests.currentEquipmentId, equipmentId))
    .orderBy(desc(equipmentRequests.createdAt))
    .limit(1);

  return row ? { name: row.name } : null;
}
