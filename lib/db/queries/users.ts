import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { restaurants, userTable } from "@/lib/db/schema";

/**
 * Consultas de usuarios (solo admin). Devuelven el usuario con el nombre de su
 * restaurante (si tiene uno) para mostrarlo en la tabla de administración.
 */

export interface UserWithRestaurant {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  restaurantId: string | null;
  restaurantName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listUsers(): Promise<UserWithRestaurant[]> {
  return db
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
    .orderBy(asc(userTable.name));
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
