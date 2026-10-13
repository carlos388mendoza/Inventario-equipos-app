import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { ROLES, asUserRole, isTechnicianRole } from "@/lib/db/enums";
import { listUsers } from "@/lib/db/queries/users";
import { TechnicianManager } from "@/components/technicians/technician-manager";
import type { RestaurantOptionDto, TechnicianDto } from "./types";

export const dynamic = "force-dynamic";

export default async function TechniciansPage() {
  const user = await requireRole(ROLES.ADMIN, ROLES.HEAD_TECHNICIAN);

  const rows = await listUsers();
  const technicians: TechnicianDto[] = rows
    .filter((u) => isTechnicianRole(asUserRole(u.role)))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      assignedRestaurantIds: u.assignedRestaurantIds,
    }));

  const restaurantRows = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.active, true))
    .orderBy(asc(restaurants.name));

  const restaurantOptions: RestaurantOptionDto[] = restaurantRows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
  }));

  return (
    <main className="p-4 sm:p-6">
      <TechnicianManager
        technicians={technicians}
        restaurants={restaurantOptions}
        currentUserId={user.id}
        canEditSelf={user.role === ROLES.ADMIN}
      />
    </main>
  );
}