"use server";

import { eq } from "drizzle-orm";
import { resolveScope } from "@/lib/equipment/scope";
import { db } from "@/lib/db";
import { equipmentRequests } from "@/lib/db/schema";
import { listRequestHistory, type RequestHistoryWithNames } from "@/lib/db/queries/requests";

export type MyRequestsHistoryResult =
  | { ok: true; history: RequestHistoryWithNames[] }
  | { ok: false; error: string };

/**
 * Historial de una solicitud, solo si pertenece al restaurante del usuario.
 * (Defensa en profundidad: RESTAURANT_USER nunca lee datos de otros restaurantes.)
 */
export async function getMyRequestHistory(
  requestId: string
): Promise<MyRequestsHistoryResult> {
  const scope = await resolveScope();
  try {
    const [row] = await db
      .select({ id: equipmentRequests.id, restaurantId: equipmentRequests.restaurantId })
      .from(equipmentRequests)
      .where(eq(equipmentRequests.id, requestId))
      .limit(1);

    if (!row) return { ok: false, error: "Solicitud no encontrada." };
    const canRead =
      scope.isGlobal || scope.restaurantId === row.restaurantId;
    if (!canRead) {
      return { ok: false, error: "No tienes permiso para ver esta solicitud." };
    }

    const history = await listRequestHistory(requestId);
    return { ok: true, history };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo consultar el historial." };
  }
}