import "server-only";

import { requireUser, canAccessGlobal } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/server";
import { asUserRole, type UserRole } from "@/lib/db/enums";

export interface AccessScope {
  user: SessionUser;
  role: UserRole;
  /** true para ADMIN / IT_MANAGER (ven todos los restaurantes). */
  isGlobal: boolean;
  /** Restaurante del usuario RESTAURANT_USER (null para roles globales). */
  restaurantId: string | null;
}

/**
 * Resuelve el ámbito de acceso del usuario actual.
 * - ADMIN / IT_MANAGER → alcance global.
 * - RESTAURANT_USER → restringido a su restaurante.
 */
export async function resolveScope(): Promise<AccessScope> {
  const user = await requireUser();
  const isGlobal = canAccessGlobal(user);
  return {
    user,
    role: asUserRole(user.role),
    isGlobal,
    restaurantId: isGlobal ? null : user.restaurantId ?? null,
  };
}

/**
 * Comprueba si el usuario puede acceder a los datos de un restaurante.
 * Necesario para DATA-LEAK: nunca confiar en IDs enviados por el cliente.
 */
export function canAccessRestaurant(
  scope: Pick<AccessScope, "isGlobal" | "restaurantId">,
  restaurantId: string
): boolean {
  return scope.isGlobal || scope.restaurantId === restaurantId;
}

/** Fuerza que un restaurante esté dentro del alcance o lanza. */
export function assertRestaurantAccess(
  scope: Pick<AccessScope, "isGlobal" | "restaurantId">,
  restaurantId: string
): void {
  if (!canAccessRestaurant(scope, restaurantId)) {
    throw new Error("No tienes permiso para acceder a este restaurante.");
  }
}