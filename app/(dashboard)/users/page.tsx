import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { restaurants, userTable } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { listUsers } from "@/lib/db/queries/users";
import { UserManager } from "@/components/users/user-manager";
import type { RestaurantOption, UserDto } from "./types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole(ROLES.ADMIN);

  const rows = await listUsers();

  const restaurantRows = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.active, true))
    .orderBy(asc(restaurants.name));

  const users: UserDto[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    restaurantId: u.restaurantId ?? null,
    restaurantName: u.restaurantName ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  const restaurantOptions: RestaurantOption[] = restaurantRows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    active: r.active,
  }));

  return (
    <main className="p-6">
      <UserManager users={users} restaurants={restaurantOptions} />
    </main>
  );
}
