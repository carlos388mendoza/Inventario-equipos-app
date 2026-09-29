import { asc, desc, eq, inArray } from "drizzle-orm";

import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentMovements,
  equipmentTypes,
  restaurants,
  userTable,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { resolveScope } from "@/lib/equipment/scope";
import { MovementsView } from "@/components/movements/movements-view";
import type {
  MovableEquipmentOption,
  MovementRow,
  RestaurantOption,
} from "./types";

export const dynamic = "force-dynamic";

/**
 * Libro y operaciones de movimientos de inventario.
 *
 * Server Component que trae el libro ya acotado al alcance del usuario y delega
 * los filtros y los diálogos en un client component. Es el mismo reparto que
 * `/inventory`, para que las dos vistas tengan la misma forma.
 *
 * El libro se lee con los identificadores crudos (`from_restaurant_id`,
 * `to_restaurant_id`, `performed_by`, `counterpart_equipment_id`) y los nombres
 * se resuelven por id en una segunda pasada. Se evita así encadenar joins sobre
 * la misma tabla `restaurants` con dos roles distintos, que es donde un join
 * doble se vuelve fácil de leer mal.
 */
export default async function MovementsPage() {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  const scope = await resolveScope();

  const [restaurantRows, typeRows, movementRows] = await Promise.all([
    db
      .select({
      id: restaurants.id,
      name: restaurants.name,
      code: restaurants.code,
      active: restaurants.active,
      logo: restaurants.logo,
      })
      .from(restaurants)
      .orderBy(asc(restaurants.name)),
    db.select({ id: equipmentTypes.id, name: equipmentTypes.name }).from(equipmentTypes),
    db.select().from(equipmentMovements).orderBy(desc(equipmentMovements.createdAt)),
  ]);

  const restaurantMap = new Map(restaurantRows.map((r) => [r.id, r]));
  const typeMap = new Map(typeRows.map((t) => [t.id, t.name]));

  // Un ADMIN o IT ve el libro completo. Un usuario restringido solo ve los
  // movimientos que tocan su unidad, por cualquiera de los dos lados. El filtro
  // se aplica AQUÍ, en el servidor: filtrar en el cliente expondría en el HTML
  // los movimientos de otras unidades.
  const visible = scope.isGlobal
    ? movementRows
    : movementRows.filter(
        (m) =>
          m.fromRestaurantId === scope.restaurantId ||
          m.toRestaurantId === scope.restaurantId
      );

  // Referencias a resolver en lote: nombres de usuarios y códigos de equipos
  // par. Con `inArray` se evita una consulta por fila.
  const performerIds = [
    ...new Set(
      visible.map((m) => m.performedBy).filter((id): id is string => Boolean(id))
    ),
  ];
  const counterpartIds = [
    ...new Set(
      visible
        .map((m) => m.counterpartEquipmentId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [performerRows, counterpartRows] = await Promise.all([
    performerIds.length > 0
      ? db
          .select({ id: userTable.id, name: userTable.name })
          .from(userTable)
          .where(inArray(userTable.id, performerIds))
      : Promise.resolve([]),
    counterpartIds.length > 0
      ? db
          .select({ id: equipment.id, assetCode: equipment.assetCode })
          .from(equipment)
          .where(inArray(equipment.id, counterpartIds))
      : Promise.resolve([]),
  ]);

  const performerMap = new Map(performerRows.map((p) => [p.id, p.name]));
  const counterpartMap = new Map(counterpartRows.map((c) => [c.id, c.assetCode]));

  const movements: MovementRow[] = visible.map((m) => {
    const from = m.fromRestaurantId
      ? restaurantMap.get(m.fromRestaurantId)
      : undefined;
    const to = m.toRestaurantId ? restaurantMap.get(m.toRestaurantId) : undefined;
    return {
      id: m.id,
      batchId: m.batchId,
      type: m.type,
      assetCode: m.assetCode,
      equipmentTypeName: m.equipmentTypeId
        ? (typeMap.get(m.equipmentTypeId) ?? "—")
        : "—",
      fromName: from?.name ?? null,
      fromCode: from?.code ?? null,
      fromLogo: from?.logo ?? null,
      toName: to?.name ?? null,
      toCode: to?.code ?? null,
      toLogo: to?.logo ?? null,
      counterpartAssetCode: m.counterpartEquipmentId
        ? (counterpartMap.get(m.counterpartEquipmentId) ?? null)
        : null,
      reason: m.reason,
      notes: m.notes,
      performedByName: m.performedBy
        ? (performerMap.get(m.performedBy) ?? null)
        : null,
      createdAt: m.createdAt,
    };
  });

  // Equipos que se pueden mover. Un usuario restringido solo ve los de su
  // unidad, que son los únicos sobre los que el servidor aceptaría una orden.
  const movableRows = await db
    .select({
      id: equipment.id,
      assetCode: equipment.assetCode,
      serialNumber: equipment.serialNumber,
      equipmentTypeId: equipment.equipmentTypeId,
      restaurantId: equipment.restaurantId,
      ownerRestaurantId: equipment.ownerRestaurantId,
      status: equipment.status,
    })
    .from(equipment)
    .where(
      scope.isGlobal
        ? undefined
        : eq(equipment.restaurantId, scope.restaurantId!)
    )
    .orderBy(asc(equipment.assetCode));

  const equipmentOptions: MovableEquipmentOption[] = movableRows.map((row) => {
    const onLoan =
      row.ownerRestaurantId !== null &&
      row.ownerRestaurantId !== row.restaurantId;
    return {
      id: row.id,
      assetCode: row.assetCode,
      serialNumber: row.serialNumber,
      typeName: typeMap.get(row.equipmentTypeId) ?? "Tipo desconocido",
      restaurantId: row.restaurantId,
      restaurantName: restaurantMap.get(row.restaurantId)?.name ?? "—",
      restaurantCode: restaurantMap.get(row.restaurantId)?.code ?? "—",
      restaurantLogo: restaurantMap.get(row.restaurantId)?.logo ?? null,
      ownerRestaurantId: row.ownerRestaurantId,
      ownerRestaurantName:
        onLoan && row.ownerRestaurantId
          ? (restaurantMap.get(row.ownerRestaurantId)?.name ?? null)
          : null,
      ownerRestaurantLogo:
        onLoan && row.ownerRestaurantId
          ? (restaurantMap.get(row.ownerRestaurantId)?.logo ?? null)
          : null,
      status: row.status,
      isOnLoan: onLoan,
    };
  });

  // `restaurantMap` (arriba) necesita TODAS las unidades para que un movimiento
  // antiguo siga mostrando el nombre de un destino que hoy está retirado. El
  // selector de destinos, en cambio, solo ofrece las activas: mover un equipo
  // hacia una unidad retirada no debe ser una opción.
  const restaurantOptions: RestaurantOption[] = restaurantRows
    .filter((r) => r.active)
    .map((r) => ({ id: r.id, name: r.name, code: r.code, logo: r.logo }));

  return (
    <main className="p-4 sm:p-6">
      <MovementsView
        movements={movements}
        equipment={equipmentOptions}
        restaurants={restaurantOptions}
      />
    </main>
  );
}
