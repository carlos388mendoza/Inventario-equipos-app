import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentTypes,
  restaurants,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { resolveScope } from "@/lib/equipment/scope";
import { listRequests } from "@/lib/db/queries/requests";
import { ROLES } from "@/lib/db/enums";
import { RequestManager } from "@/components/requests/request-manager";
import type {
  EquipmentSelectOption,
  RequestDto,
  RestaurantSelectOption,
} from "./types";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const user = await requireRole(
    ROLES.ADMIN,
    ROLES.IT_MANAGER,
    ROLES.RESTAURANT_USER
  );
  const scope = await resolveScope();
  const isManager = user.role === ROLES.ADMIN || user.role === ROLES.IT_MANAGER;

  const rows = await listRequests({
    restaurantId: scope.isGlobal ? undefined : (scope.restaurantId ?? undefined),
  });

  const [typeRows, restaurantRows, equipmentRows] = await Promise.all([
    db
      .select()
      .from(equipmentTypes)
      .where(eq(equipmentTypes.active, true))
      .orderBy(asc(equipmentTypes.name)),
    db
      .select()
      .from(restaurants)
      .where(eq(restaurants.active, true))
      .orderBy(asc(restaurants.name)),
    scope.isGlobal
      ? db.select().from(equipment).orderBy(asc(equipment.assetCode))
      : db
          .select()
          .from(equipment)
          .where(eq(equipment.restaurantId, scope.restaurantId!))
          .orderBy(asc(equipment.assetCode)),
  ]);

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

  const restaurantOptions: RestaurantSelectOption[] = restaurantRows.map(
    (r) => ({ id: r.id, name: r.name, code: r.code })
  );

  const typeOptions = typeRows.map((t) => ({ id: t.id, name: t.name }));

  const equipmentOptions: EquipmentSelectOption[] = equipmentRows.map((e) => ({
    id: e.id,
    assetCode: e.assetCode,
    restaurantId: e.restaurantId,
    equipmentTypeId: e.equipmentTypeId,
  }));

  return (
    <main className="p-6">
      <RequestManager
        requests={requests}
        isManager={isManager}
        currentRestaurantId={scope.isGlobal ? undefined : (scope.restaurantId ?? undefined)}
        restaurantOptions={restaurantOptions}
        typeOptions={typeOptions}
        equipmentOptions={equipmentOptions}
      />
    </main>
  );
}