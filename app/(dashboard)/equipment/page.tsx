import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentTypes,
  restaurants,
  securityLabels,
} from "@/lib/db/schema";
import { resolveScope } from "@/lib/equipment/scope";
import { computeLifecycle } from "@/lib/equipment/lifecycle";
import { ROLES } from "@/lib/db/enums";
import { EquipmentManager } from "@/components/equipment/equipment-manager";
import type { EquipmentListItem } from "./types";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const user = await requireRole(
    ROLES.ADMIN,
    ROLES.IT_MANAGER,
    ROLES.RESTAURANT_USER
  );
  const scope = await resolveScope();
  const isManager = user.role === ROLES.ADMIN || user.role === ROLES.IT_MANAGER;

  const [types, restaurantRows, labels] = await Promise.all([
    db.select().from(equipmentTypes).orderBy(asc(equipmentTypes.name)),
    db.select().from(restaurants).orderBy(asc(restaurants.name)),
    scope.isGlobal
      ? db
          .select({ equipmentId: securityLabels.equipmentId })
          .from(securityLabels)
      : db
          .select({ equipmentId: securityLabels.equipmentId })
          .from(securityLabels)
          .innerJoin(equipment, eq(securityLabels.equipmentId, equipment.id))
          .where(eq(equipment.restaurantId, scope.restaurantId!)),
  ]);

  const rows = scope.isGlobal
    ? await db.select().from(equipment).orderBy(asc(equipment.assetCode))
    : await db
        .select()
        .from(equipment)
        .where(eq(equipment.restaurantId, scope.restaurantId!))
        .orderBy(asc(equipment.assetCode));

  const typeMap = new Map(types.map((t) => [t.id, t]));
  const restaurantMap = new Map(restaurantRows.map((r) => [r.id, r]));
  const labelSet = new Set(labels.map((l) => l.equipmentId));

  const list: EquipmentListItem[] = rows.map((e) => {
    const type = typeMap.get(e.equipmentTypeId);
    const restaurant = restaurantMap.get(e.restaurantId);
    return {
      id: e.id,
      assetCode: e.assetCode,
      serialNumber: e.serialNumber,
      equipmentTypeId: e.equipmentTypeId,
      restaurantId: e.restaurantId,
      brand: e.brand,
      model: e.model,
      purchaseDate: e.purchaseDate,
      installationDate: e.installationDate,
      status: e.status,
      notes: e.notes,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      equipmentTypeName: type?.name ?? "Tipo desconocido",
      restaurantName: restaurant?.name ?? "Desconocido",
      restaurantCode: restaurant?.code ?? "—",
      restaurantBrand: restaurant?.brand ?? null,
      restaurantSector: restaurant?.sector ?? null,
      restaurantLogo: restaurant?.logo ?? null,
      lifecycle: computeLifecycle(
        type?.usefulLifeMonths ?? 0,
        e.installationDate ?? e.purchaseDate
      ),
      hasLabel: labelSet.has(e.id),
    };
  });

  return (
    <main className="p-6">
      <EquipmentManager
        equipment={list}
        isManager={isManager}
        restaurantOptions={restaurantRows.map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code,
        }))}
        typeOptions={types.map((t) => ({ id: t.id, name: t.name }))}
      />
    </main>
  );
}