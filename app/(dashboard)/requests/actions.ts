"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth/session";
import { resolveScope } from "@/lib/equipment/scope";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentRequests,
  equipmentTypes,
  requestHistory,
} from "@/lib/db/schema";
import { REQUEST_STATUS, ROLES } from "@/lib/db/enums";
import {
  requestInputSchema,
  requestStatusChangeSchema,
} from "@/lib/validation/requests";

export type RequestActionResult = { ok: true } | { ok: false; error: string };

/**
 * Crea una solicitud de equipo (estado inicial PENDING) e inserta la primera
 * fila en request_history.
 * - RESTAURANT_USER: solo para su propio restaurante.
 * - ADMIN / IT_MANAGER: pueden indicar el restaurante, validado en servidor.
 */
export async function createRequest(
  input: unknown
): Promise<RequestActionResult> {
  const user = await requireUser();
  const scope = await resolveScope();
  try {
    const parsed = requestInputSchema.parse(input);

    let restaurantId = scope.restaurantId;
    if (scope.isGlobal) {
      if (!parsed.restaurantId) {
        return { ok: false, error: "Selecciona el restaurante." };
      }
      restaurantId = parsed.restaurantId;
    }
    if (!restaurantId) {
      return {
        ok: false,
        error: "Tu usuario no está asociado a un restaurante.",
      };
    }

    const [typeRow] = await db
      .select({ id: equipmentTypes.id })
      .from(equipmentTypes)
      .where(eq(equipmentTypes.id, parsed.equipmentTypeId))
      .limit(1);
    if (!typeRow) {
      return { ok: false, error: "El tipo de equipo seleccionado no existe." };
    }

    const currentEquipmentId =
      parsed.kind === "replacement" ? parsed.currentEquipmentId || null : null;

    if (currentEquipmentId) {
      const [row] = await db
        .select({ id: equipment.id, restaurantId: equipment.restaurantId })
        .from(equipment)
        .where(eq(equipment.id, currentEquipmentId))
        .limit(1);
      if (!row) {
        return {
          ok: false,
          error: "El equipo a reemplazar no existe.",
        };
      }
      if (row.restaurantId !== restaurantId) {
        return {
          ok: false,
          error: "El equipo a reemplazar pertenece a otro restaurante.",
        };
      }
    }

    const now = new Date();
    const requestId = crypto.randomUUID();

    await db.insert(equipmentRequests).values({
      id: requestId,
      restaurantId,
      requestedBy: user.id,
      equipmentTypeId: parsed.equipmentTypeId,
      currentEquipmentId,
      reason: parsed.reason,
      description: parsed.description || null,
      priority: parsed.priority,
      status: REQUEST_STATUS.PENDING,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(requestHistory).values({
      id: crypto.randomUUID(),
      requestId,
      userId: user.id,
      oldStatus: null,
      newStatus: REQUEST_STATUS.PENDING,
      comment: "Solicitud creada.",
      createdAt: now,
    });

    revalidatePath("/requests");
    revalidatePath("/my-requests");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

/**
 * Cambia el estado de una solicitud (solo ADMIN / IT_MANAGER) e inserta la
 * transición en request_history con oldStatus, newStatus, userId y comentario.
 */
export async function changeRequestStatus(
  input: unknown
): Promise<RequestActionResult> {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  try {
    const parsed = requestStatusChangeSchema.parse(input);

    const [row] = await db
      .select({
        id: equipmentRequests.id,
        status: equipmentRequests.status,
      })
      .from(equipmentRequests)
      .where(eq(equipmentRequests.id, parsed.id))
      .limit(1);

    if (!row) {
      return { ok: false, error: "Solicitud no encontrada." };
    }
    if (row.status === parsed.newStatus) {
      return { ok: false, error: "La solicitud ya tiene ese estado." };
    }

    const now = new Date();
    await db
      .update(equipmentRequests)
      .set({ status: parsed.newStatus, updatedAt: now })
      .where(eq(equipmentRequests.id, row.id));

    await db.insert(requestHistory).values({
      id: crypto.randomUUID(),
      requestId: row.id,
      userId: user.id,
      oldStatus: row.status,
      newStatus: parsed.newStatus,
      comment: parsed.comment || null,
      createdAt: now,
    });

    revalidatePath("/requests");
    revalidatePath("/my-requests");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}