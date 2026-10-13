import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  restaurants,
  userRestaurantAssignments,
  userTable,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";

/**
 * Consultas de usuarios (solo admin). Devuelven el usuario con el nombre de su
 * restaurante (si tiene uno) y, para los técnicos, la lista de restaurantes
 * asignados (issues #11/#16).
 *
 * Excluyen las cuentas dadas de baja lógica (`deletedAt` no nulo): una cuenta
 * eliminada no se muestra en la gestión de usuarios ni en la de técnicos, y no
 * puede reactivarse desde el panel (baja irreversible desde la UI).
 */

export interface UserWithRestaurant {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  restaurantId: string | null;
  restaurantName: string | null;
  assignedRestaurantIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function listUsers(): Promise<UserWithRestaurant[]> {
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      active: userTable.active,
      restaurantId: userTable.restaurantId,
      restaurantName: restaurants.name,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
    })
    .from(userTable)
    .leftJoin(restaurants, eq(restaurants.id, userTable.restaurantId))
    .where(isNull(userTable.deletedAt))
    .orderBy(asc(userTable.name));

  const assignments = await db
    .select({
      userId: userRestaurantAssignments.userId,
      restaurantId: userRestaurantAssignments.restaurantId,
    })
    .from(userRestaurantAssignments);

  const byUser = new Map<string, string[]>();
  for (const a of assignments) {
    const list = byUser.get(a.userId);
    if (list) list.push(a.restaurantId);
    else byUser.set(a.userId, [a.restaurantId]);
  }

  return rows.map((row) => ({
    ...row,
    assignedRestaurantIds: byUser.get(row.id) ?? [],
  }));
}

/** Reemplaza por completo los restaurantes asignados a un usuario técnico. */
export async function setUserRestaurantAssignments(
  userId: string,
  restaurantIds: string[]
): Promise<void> {
  await db
    .delete(userRestaurantAssignments)
    .where(eq(userRestaurantAssignments.userId, userId));

  const unique = [...new Set(restaurantIds.filter(Boolean))];
  if (unique.length === 0) return;

  await db.insert(userRestaurantAssignments).values(
    unique.map((restaurantId) => ({
      id: crypto.randomUUID(),
      userId,
      restaurantId,
      createdAt: new Date(),
    }))
  );
}

/** Email en uso por OTRO usuario con el mismo id (null si nadie). */
export async function findEmailInUseByOther(
  email: string,
  skipId?: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  return !!row && row.id !== skipId;
}

/** Estado mínimo de una cuenta para aplicar las reglas de gestión. */
export interface UserAccountState {
  id: string;
  role: string;
  active: boolean;
  deletedAt: Date | null;
}

/** Lee el estado de una cuenta por id (incluye las dadas de baja). */
export async function getUserAccount(
  id: string
): Promise<UserAccountState | null> {
  const [row] = await db
    .select({
      id: userTable.id,
      role: userTable.role,
      active: userTable.active,
      deletedAt: userTable.deletedAt,
    })
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Ids de los administradores ACTIVOS y vigentes (no dados de baja). Se usa para
 * proteger al último administrador: nunca debe quedar el sistema sin un admin
 * activo.
 */
export async function listActiveAdminIds(): Promise<string[]> {
  const rows = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(
      and(
        eq(userTable.role, ROLES.ADMIN),
        eq(userTable.active, true),
        isNull(userTable.deletedAt)
      )
    );
  return rows.map((row) => row.id);
}
