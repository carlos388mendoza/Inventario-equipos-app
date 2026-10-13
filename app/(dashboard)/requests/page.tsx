import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, equipmentTypes, restaurants } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { resolveScope, scopeRestaurantIds } from "@/lib/equipment/scope";
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
    ROLES.RESTAURANT_USER,
    ROLES.TECHNICIAN,
    ROLES.HEAD_TECHNICIAN
  );
  const scope = await resolveScope();
  const restaurantIds = scopeRestaurantIds(scope);
  const isManager = user.role === ROLES.ADMIN || user.role === ROLES.IT_MANAGER;

  const rows = await listRequests({
    restaurantIds: restaurantIds ?? undefined,
  });

  const typeRows = await db
    .select()
    .from(equipmentTypes)
    .where(eq(equipmentTypes.active, true))
    .orderBy(asc(equipmentTypes.name));

  const restaurantRows =
    restaurantIds === null
      ? await db
          .select()
          .from(restaurants)
          .where(eq(restaurants.active, true))
          .orderBy(asc(restaurants.name))
      : restaurantIds.length === 0
        ? []
        : await db
            .select()
            .from(restaurants)
            .where(inArray(restaurants.id, restaurantIds))
            .orderBy(asc(restaurants.name));

  const equipmentRows =
    restaurantIds === null
      ? await db.select().from(equipment).orderBy(asc(equipment.assetCode))
      : restaurantIds.length === 0
        ? []
        : await db
            .select()
            .from(equipment)
            .where(inArray(equipment.restaurantId, restaurantIds))
            .orderBy(asc(equipment.assetCode));

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
    destinationArea: r.destinationArea,
    reason: r.reason,
    description: r.description,
    priority: r.priority,
    status: r.status,
    installationStatus: r.installationStatus,
    followUpDueAt: r.followUpDueAt,
    followUpSentAt: r.followUpSentAt,
    installationConfirmedAt: r.installationConfirmedAt,
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

// El restaurante queda "bloqueado" solo cuando hay uno solo posible (usuario
// de restaurante o técnico asignado a una única unidad). El servidor también
// usa ese único restaurante por defecto si el cliente no lo envía.
const singleRestaurantId =
    restaurantIds && restaurantIds.length === 1 ? restaurantIds[0] : undefined;

  return (
    <main className="p-4 sm:p-6">
      <RequestManager
        requests={requests}
        isManager={isManager}
        currentRestaurantId={singleRestaurantId}
        restaurantOptions={restaurantOptions}
        typeOptions={typeOptions}
        equipmentOptions={equipmentOptions}
      />
    </main>
  );
}
