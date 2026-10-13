import { and, desc, eq, inArray } from "drizzle-orm";
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
  asUserRole,
  isTechnicianRole,
  type DestinationArea,
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
  destinationArea: DestinationArea | null;
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

/**
 * Técnico que solicitó el reemplazo de un equipo (issue #12).
 *
 * Solo se devuelve cuando existe un vínculo DIRECTO y fiable: una solicitud de
 * reemplazo cuyo `currentEquipmentId` es ese equipo y cuyo solicitante tiene un
 * rol técnico. Se devuelve únicamente el nombre; nunca el correo ni datos de la
 * solicitud. Si el solicitante fuera un `RESTAURANT_USER`, no se expone nada.
 */
export async function getEquipmentRequesterTechnician(
  equipmentId: string
): Promise<{ name: string } | null> {
  const rows = await db
    .select({ name: userTable.name, role: userTable.role })
    .from(equipmentRequests)
    .innerJoin(userTable, eq(equipmentRequests.requestedBy, userTable.id))
    .where(eq(equipmentRequests.currentEquipmentId, equipmentId))
    .orderBy(desc(equipmentRequests.createdAt));

  for (const row of rows) {
    if (isTechnicianRole(asUserRole(row.role))) {
      return { name: row.name };
    }
  }
  return null;
}
