import "server-only";

import { eq } from "drizzle-orm";
import { requireUser, canAccessGlobal } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { userRestaurantAssignments } from "@/lib/db/schema";
import {
  asUserRole,
  isTechnicianRole,
  type UserRole,
} from "@/lib/db/enums";

export interface AccessScope {
  user: SessionUser;
  role: UserRole;
  /** true para ADMIN / IT_MANAGER (ven todos los restaurantes). */
  isGlobal: boolean;
  /** Restaurante del usuario RESTAURANT_USER (null para roles globales/técnicos). */
  restaurantId: string | null;
  /**
   * Restaurantes que el usuario puede operar. Para un `RESTAURANT_USER` es su
   * único restaurante; para un técnico son los asignados. Vacío para alcance
   * global (que ya ve todo).
   */
  assignedRestaurantIds: string[];
}

/** Restaurantes asignados a un usuario técnico (tabla intermedia). */
export async function listAssignedRestaurantIds(
  userId: string
): Promise<string[]> {
  const rows = await db
    .select({ restaurantId: userRestaurantAssignments.restaurantId })
    .from(userRestaurantAssignments)
    .where(eq(userRestaurantAssignments.userId, userId));
  return rows.map((r) => r.restaurantId);
}

/**
 * Resuelve el ámbito de acceso del usuario actual.
 * - ADMIN / IT_MANAGER → alcance global.
 * - TECHNICIAN / HEAD_TECHNICIAN → los restaurantes que tenga asignados.
 * - RESTAURANT_USER → restringido a su restaurante.
 */
export async function resolveScope(): Promise<AccessScope> {
  const user = await requireUser();
  const role = asUserRole(user.role);
  const isGlobal = canAccessGlobal(user);

  if (isGlobal) {
    return {
      user,
      role,
      isGlobal: true,
      restaurantId: null,
      assignedRestaurantIds: [],
    };
  }

  if (isTechnicianRole(role)) {
    const assignedRestaurantIds = await listAssignedRestaurantIds(user.id);
    return {
      user,
      role,
      isGlobal: false,
      restaurantId: null,
      assignedRestaurantIds,
    };
  }

  const restaurantId = user.restaurantId ?? null;
  return {
    user,
    role,
    isGlobal: false,
    restaurantId,
    assignedRestaurantIds: restaurantId ? [restaurantId] : [],
  };
}

/**
 * Lista de restaurantes a los que limitar las consultas.
 * `null` significa "sin límite" (alcance global). Nunca devuelve una lista
 * vacía que se interprete como "todos": si el usuario no tiene ninguno, se
 * devuelve una lista vacía y las consultas deben devolver cero filas.
 */
export function scopeRestaurantIds(scope: AccessScope): string[] | null {
  if (scope.isGlobal) return null;
  return scope.assignedRestaurantIds;
}

/**
 * Comprueba si el usuario puede acceder a los datos de un restaurante.
 * Necesario para DATA-LEAK: nunca confiar en IDs enviados por el cliente.
 */
export function canAccessRestaurant(
  scope: Pick<
    AccessScope,
    "isGlobal" | "restaurantId" | "assignedRestaurantIds"
  >,
  restaurantId: string
): boolean {
  if (scope.isGlobal) return true;
  if (scope.restaurantId === restaurantId) return true;
  return scope.assignedRestaurantIds.includes(restaurantId);
}

/** Fuerza que un restaurante esté dentro del alcance o lanza. */
export function assertRestaurantAccess(
  scope: Pick<
    AccessScope,
    "isGlobal" | "restaurantId" | "assignedRestaurantIds"
  >,
  restaurantId: string
): void {
  if (!canAccessRestaurant(scope, restaurantId)) {
    throw new Error("No tienes permiso para acceder a este restaurante.");
  }
}
