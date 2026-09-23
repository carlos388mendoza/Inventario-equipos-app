import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { resolveScope } from "@/lib/equipment/scope";
import { listRequests } from "@/lib/db/queries/requests";
import { db } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { MyRequestsManager } from "@/components/requests/my-requests-manager";
import type { RequestDto } from "@/app/(dashboard)/requests/types";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const user = await requireUser();
  if (user.role !== ROLES.RESTAURANT_USER && !user.restaurantId) {
    redirect("/requests");
  }
  const scope = await resolveScope();

  const rows = await listRequests({
    restaurantId: scope.restaurantId ?? undefined,
  });

  const requests: RequestDto[] = rows.map((r) => ({
    id: r.id,
    restaurantId: r.restaurantId,
    restaurantName: r.restaurantName,
    restaurantBrand: r.restaurantBrand,
    restaurantSector: r.restaurantSector,
    restaurantLogo: r.restaurantLogo,
    requestedById: r.requestedById,
    requestedByName: r.requestedByName,
    equipmentTypeId: r.equipmentTypeId,
    equipmentTypeName: r.equipmentTypeName,
    currentEquipmentId: r.currentEquipmentId,
    currentEquipmentAssetCode: r.currentEquipmentAssetCode,
    reason: r.reason,
    description: r.description,
    priority: r.priority,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const [restaurantRows] = await Promise.all([
    scope.restaurantId
      ? db
          .select({
            id: restaurants.id,
            name: restaurants.name,
            code: restaurants.code,
            brand: restaurants.brand,
            sector: restaurants.sector,
            logo: restaurants.logo,
          })
          .from(restaurants)
          .where(eq(restaurants.id, scope.restaurantId))
          .limit(1)
      : [],
  ]);

  const restaurant = restaurantRows[0] ?? null;

  return (
    <main className="p-6">
      <MyRequestsManager requests={requests} restaurant={restaurant} />
    </main>
  );
}