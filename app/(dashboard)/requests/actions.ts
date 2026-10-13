"use server";

import { desc, eq } from "drizzle-orm";
import { revalidateRequestViews } from "@/lib/revalidate";
import { requireRole, requireUser } from "@/lib/auth/session";
import { isNextRedirect } from "@/lib/auth/redirect";
import { resolveScope, canAccessRestaurant } from "@/lib/equipment/scope";
import type { AccessScope } from "@/lib/equipment/scope";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentRequests,
  equipmentTypes,
  requestHistory,
} from "@/lib/db/schema";
import {
  INSTALLATION_FOLLOW_UP_DAYS,
  REQUEST_INSTALLATION_STATUS,
  REQUEST_STATUS,
  ROLES,
  isTechnicianRole,
} from "@/lib/db/enums";
import {
  requestInputSchema,
  requestStatusChangeSchema,
} from "@/lib/validation/requests";
import {
  loadRequestContext,
  notifyRequestCreated,
  notifyRequestDecision,
} from "@/lib/requests/notifications";

export type RequestActionResult = { ok: true } | { ok: false; error: string };

/**
 * Resuelve el restaurante de destino de una solicitud aplicando el ámbito:
 * - global (ADMIN / IT_MANAGER): el que venga del formulario.
 * - técnico: el que venga (SOLO si está asignado) o, si no viene ninguno y
 *   solo tiene un restaurante asignado, ese único restaurante.
 * - usuario de restaurante: forzosamente el suyo.
 * Devuelve el id o un mensaje de error (nunca lanza por validación de ámbito).
 */
function resolveTargetRestaurant(
  scope: AccessScope,
  requested: string | undefined
): { restaurantId: string } | { error: string } {
  if (scope.isGlobal) {
    if (!requested) return { error: "Selecciona el restaurante." };
    return { restaurantId: requested };
  }

  if (isTechnicianRole(scope.role)) {
    // Técnico con un solo restaurante asignado: se usa ese por defecto (el
    // formulario también lo fija en el cliente como defensa en profundidad).
    const defaultRestaurantId =
      scope.assignedRestaurantIds.length === 1
        ? scope.assignedRestaurantIds[0]
        : undefined;
    const restaurantId = requested || defaultRestaurantId;
    if (!restaurantId) return { error: "Selecciona el restaurante." };
    if (!scope.assignedRestaurantIds.includes(restaurantId)) {
      return { error: "No tienes asignado ese restaurante." };
    }
    return { restaurantId };
  }

  if (!scope.restaurantId) {
    return { error: "Tu usuario no está asociado a un restaurante." };
  }
  return { restaurantId: scope.restaurantId };
}

/**
 * Crea una solicitud de equipo (estado inicial PENDING) e inserta la primera
 * fila en request_history.
 * - RESTAURANT_USER: solo para su propio restaurante.
 * - TECHNICIAN / HEAD_TECHNICIAN: para cualquiera de sus restaurantes asignados.
 * - ADMIN / IT_MANAGER: pueden indicar el restaurante, validado en servidor.
 */
export async function createRequest(
  input: unknown
): Promise<RequestActionResult> {
  const user = await requireUser();
  const scope = await resolveScope();
  try {
    const parsed = requestInputSchema.parse(input);

    const target = resolveTargetRestaurant(scope, parsed.restaurantId);
    if ("error" in target) {
      return { ok: false, error: target.error };
    }
    const restaurantId = target.restaurantId;

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

    let inheritedArea: string | null = null;
    if (currentEquipmentId) {
      const [row] = await db
        .select({ id: equipment.id, restaurantId: equipment.restaurantId })
        .from(equipment)
        .where(eq(equipment.id, currentEquipmentId))
        .limit(1);
      if (!row) {
        return { ok: false, error: "El equipo a reemplazar no existe." };
      }
      if (row.restaurantId !== restaurantId) {
        return {
          ok: false,
          error: "El equipo a reemplazar pertenece a otro restaurante.",
        };
      }
      if (!canAccessRestaurant(scope, row.restaurantId)) {
        return { ok: false, error: "No tienes acceso a ese restaurante." };
      }

      // #14: si no se indica área, se reutiliza la de la última solicitud de
      // reemplazo de ese mismo equipo.
      const [previous] = await db
        .select({ destinationArea: equipmentRequests.destinationArea })
        .from(equipmentRequests)
        .where(eq(equipmentRequests.currentEquipmentId, currentEquipmentId))
        .orderBy(desc(equipmentRequests.createdAt))
        .limit(1);
      inheritedArea = previous?.destinationArea ?? null;
    }

    const destinationArea =
      parsed.destinationArea || inheritedArea || null;

    const now = new Date();
    const requestId = crypto.randomUUID();

    await db.insert(equipmentRequests).values({
      id: requestId,
      restaurantId,
      requestedBy: user.id,
      equipmentTypeId: parsed.equipmentTypeId,
      currentEquipmentId,
      destinationArea,
      reason: parsed.reason,
      description: parsed.description || null,
      priority: parsed.priority,
      status: REQUEST_STATUS.PENDING,
      installationStatus: REQUEST_INSTALLATION_STATUS.PENDING,
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

    // La notificación es un efecto posterior a la solicitud ya creada: si
    // falla, no debe convertirse en un `{ ok: false }` que oculte el éxito.
    try {
      const context = await loadRequestContext(requestId);
      if (context) await notifyRequestCreated(context);
    } catch {
      // se ignora: la solicitud está insertada y en el outbox quedará FAILED.
    }

    revalidateRequestViews();
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}

/**
 * Cambia el estado de una solicitud (solo ADMIN / IT_MANAGER) e inserta la
 * transición en request_history con oldStatus, newStatus, userId y comentario.
 *
 * Issue #13: al APROBAR se agenda el seguimiento (aprobación + 5 días) y se
 * avisa; al RECHAZAR se avisa. Aprobar NO marca la instalación como hecha.
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
        installationStatus: equipmentRequests.installationStatus,
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
    const update: Partial<typeof equipmentRequests.$inferInsert> = {
      status: parsed.newStatus,
      updatedAt: now,
    };

    if (
      parsed.newStatus === REQUEST_STATUS.APPROVED &&
      // Reaprobar una solicitud ya confirmada (o con instalación NO realizada)
      // no debe reiniciar el seguimiento de 5 días ni reenviar el follow-up.
      row.installationStatus === REQUEST_INSTALLATION_STATUS.PENDING
    ) {
      update.followUpDueAt = new Date(
        now.getTime() + INSTALLATION_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000
      );
      update.followUpSentAt = null;
      update.installationStatus = REQUEST_INSTALLATION_STATUS.PENDING;
    }

    await db
      .update(equipmentRequests)
      .set(update)
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

    // Las notificaciones no pueden ocultar el resultado del cambio de estado ya
    // aplicado: un fallo aquí no convierte un `ok: true` en un error.
    try {
      const context = await loadRequestContext(row.id);
      if (context) {
        if (parsed.newStatus === REQUEST_STATUS.APPROVED) {
          await notifyRequestDecision(context, "APPROVED", parsed.comment);
        } else if (parsed.newStatus === REQUEST_STATUS.REJECTED) {
          await notifyRequestDecision(context, "REJECTED", parsed.comment);
        }
      }
    } catch {
      // se ignora: el estado está cambiado y el outbox guarda el fallo.
    }

    revalidateRequestViews();
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}
