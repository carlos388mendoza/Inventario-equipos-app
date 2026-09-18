import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { RestaurantManager } from "@/components/restaurants/restaurant-manager";
import type { RestaurantDto } from "./types";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  await requireRole(ROLES.ADMIN);

  const rows = await db
    .select()
    .from(restaurants)
    .orderBy(asc(restaurants.name));

  const list: RestaurantDto[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    address: r.address,
    active: r.active,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return (
    <main className="p-6">
      <RestaurantManager restaurants={list} />
    </main>
  );
}