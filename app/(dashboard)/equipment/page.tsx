import { asc, eq, inArray } from "drizzle-orm";
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

  // El origen/copia y el sustituto son EQUIPOS reales y se resuelven en una sola
  // pasada con `inArray` para no disparar una consulta por fila.
  //
  // `ownerRestaurantId` queda deliberadamente fuera: es un id de RESTAURANTE, no
  // de equipo, y ya se resuelve con `restaurantMap` más abajo. Mezclarlo aquí lo
  // buscaría contra `equipment.id` y devolvería filas de otra cosa.
  const relatedIds = new Set<string>();
  for (const row of rows) {
    if (row.originEquipmentId) relatedIds.add(row.originEquipmentId);
    if (row.replacedByEquipmentId) relatedIds.add(row.replacedByEquipmentId);
  }
  const relatedEquipment =
    relatedIds.size > 0
      ? await db
          .select({
            id: equipment.id,
            assetCode: equipment.assetCode,
            restaurantId: equipment.restaurantId,
          })
          .from(equipment)
          .where(inArray(equipment.id, [...relatedIds]))
      : [];
  const relatedMap = new Map(relatedEquipment.map((r) => [r.id, r]));

  const typeMap = new Map(types.map((t) => [t.id, t]));
  const restaurantMap = new Map(restaurantRows.map((r) => [r.id, r]));
  const labelSet = new Set(labels.map((l) => l.equipmentId));

  const list: EquipmentListItem[] = rows.map((e) => {
    const type = typeMap.get(e.equipmentTypeId);
    const restaurant = restaurantMap.get(e.restaurantId);
    const owner = e.ownerRestaurantId
      ? restaurantMap.get(e.ownerRestaurantId)
      : undefined;
    const onLoan =
      e.ownerRestaurantId !== null && e.ownerRestaurantId !== e.restaurantId;
    return {
      id: e.id,
      assetCode: e.assetCode,
      serialNumber: e.serialNumber,
      equipmentTypeId: e.equipmentTypeId,
      restaurantId: e.restaurantId,
      ownerRestaurantId: e.ownerRestaurantId,
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
      ownerRestaurantName: onLoan ? (owner?.name ?? null) : null,
      ownerRestaurantCode: onLoan ? (owner?.code ?? null) : null,
      isOnLoan: onLoan,
      originAssetCode: e.originEquipmentId
        ? (relatedMap.get(e.originEquipmentId)?.assetCode ?? null)
        : null,
      replacedByAssetCode: e.replacedByEquipmentId
        ? (relatedMap.get(e.replacedByEquipmentId)?.assetCode ?? null)
        : null,
      lifecycle: computeLifecycle(
        type?.usefulLifeMonths ?? 0,
        e.installationDate ?? e.purchaseDate
      ),
      hasLabel: labelSet.has(e.id),
    };
  });

  return (
    <main className="p-4 sm:p-6">
      <EquipmentManager
        equipment={list}
        isManager={isManager}
        restaurantOptions={restaurantRows
          // El selector de unidades solo ofrece las activas: una unidad retirada
          // no se elige, pero `restaurantMap` (más arriba) sí la conserva para
          // que los equipos históricos sigan mostrando su nombre.
          .filter((r) => r.active)
          .map((r) => ({
            id: r.id,
            name: r.name,
            code: r.code,
          }))}
        typeOptions={types.map((t) => ({ id: t.id, name: t.name }))}
      />
    </main>
  );
}