import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentRequests,
  equipmentTypes,
  requestHistory,
  restaurants,
  userTable,
} from "@/lib/db/schema";
import type { RequestPriority, RequestStatus } from "@/lib/db/enums";

export interface RequestWithNames {
  id: string;
  restaurantId: string;
  restaurantName: string;
  requestedById: string;
  requestedByName: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  currentEquipmentId: string | null;
  currentEquipmentAssetCode: string | null;
  reason: string;
  description: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Consulta solicitudes con nombres desnormalizados (restaurante, tipo, usuario, equipo actual). */
export async function listRequests(params?: {
  restaurantId?: string;
  status?: RequestStatus;
}): Promise<RequestWithNames[]> {
  const conditions = [];
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
    requestedById: request.requestedBy,
    requestedByName: names.requestedByName,
    equipmentTypeId: request.equipmentTypeId,
    equipmentTypeName: names.equipmentTypeName,
    currentEquipmentId: request.currentEquipmentId,
    currentEquipmentAssetCode: names.currentEquipmentAssetCode ?? null,
    reason: request.reason,
    description: request.description,
    priority: request.priority,
    status: request.status,
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