import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentRequests,
  equipmentTypes,
  restaurants,
} from "@/lib/db/schema";

/**
 * Restaurantes cuya solicitud corresponde a un reemplazo de equipo actual
 * (`currentEquipmentId` no nulo = reemplazo; NULL = equipo nuevo).
 * Orden descendente por número de solicitudes de reemplazo.
 */
export async function restaurantsByReplacementRequests(limit = 10) {
  return db
    .select({
      restaurantId: restaurants.id,
      restaurantName: restaurants.name,
      totalRequests: count(),
    })
    .from(equipmentRequests)
    .innerJoin(
      restaurants,
      eq(equipmentRequests.restaurantId, restaurants.id)
    )
    .where(isNotNull(equipmentRequests.currentEquipmentId))
    .groupBy(restaurants.id)
    .orderBy(desc(count()))
    .limit(limit);
}

/**
 * Tipo de equipo con menor vida útil (catálogo `equipment_types.useful_life_months`).
 * Orden ascendente: el primero es el de menor vida útil esperada, junto con
 * el número de equipos registrados de ese tipo.
 */
export async function equipmentTypeLifespan() {
  return db
    .select({
      typeId: equipmentTypes.id,
      typeName: equipmentTypes.name,
      usefulLifeMonths: equipmentTypes.usefulLifeMonths,
      equipmentCount: count(),
    })
    .from(equipmentTypes)
    .leftJoin(
      equipmentRequests,
      eq(equipmentRequests.equipmentTypeId, equipmentTypes.id)
    )
    .groupBy(equipmentTypes.id)
    .orderBy(asc(equipmentTypes.usefulLifeMonths));
}

/** Solicitudes por tipo de equipo en un rango de fechas [desde, hasta). */
export async function requestsByType(params: {
  from: Date;
  to: Date;
  typeId?: string;
  restaurantId?: string;
}) {
  const conditions = [
    gte(equipmentRequests.createdAt, params.from),
    lt(equipmentRequests.createdAt, params.to),
  ];
  if (params.typeId) {
    conditions.push(eq(equipmentRequests.equipmentTypeId, params.typeId));
  }
  if (params.restaurantId) {
    conditions.push(eq(equipmentRequests.restaurantId, params.restaurantId));
  }

  return db
    .select({
      typeId: equipmentTypes.id,
      typeName: equipmentTypes.name,
      totalRequests: count(),
    })
    .from(equipmentRequests)
    .innerJoin(
      equipmentTypes,
      eq(equipmentRequests.equipmentTypeId, equipmentTypes.id)
    )
    .where(and(...conditions))
    .groupBy(equipmentTypes.id)
    .orderBy(desc(count()));
}

/** Ranking de restaurantes por número total de solicitudes registradas. */
export async function requestsRankingByRestaurant() {
  return db
    .select({
      restaurantId: restaurants.id,
      restaurantName: restaurants.name,
      totalRequests: count(),
    })
    .from(equipmentRequests)
    .innerJoin(
      restaurants,
      eq(equipmentRequests.restaurantId, restaurants.id)
    )
    .groupBy(restaurants.id)
    .orderBy(desc(count()));
}

/**
 * Inventario completo con el tipo de equipo y su vida útil de catálogo.
 * La vida útil real se compara después con la antigüedad del equipo
 * (installationDate ?? purchaseDate) para detectar equipos vencidos.
 */
export async function equipmentWithType() {
  return db
    .select({
      equipment: equipment,
      typeId: equipmentTypes.id,
      typeName: equipmentTypes.name,
      usefulLifeMonths: equipmentTypes.usefulLifeMonths,
    })
    .from(equipment)
    .innerJoin(
      equipmentTypes,
      eq(equipment.equipmentTypeId, equipmentTypes.id)
    )
    .orderBy(asc(equipmentTypes.name), asc(equipment.assetCode));
}
