import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { resolveScope } from "@/lib/equipment/scope";
import { listRequests } from "@/lib/db/queries/requests";
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

  return (
    <main className="p-6">
      <MyRequestsManager requests={requests} />
    </main>
  );
}