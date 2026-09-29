import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "@/lib/db/schema";
import { equipment, equipmentTypes, restaurants, securityLabels } from "@/lib/db/schema";

/**
 * Datos de etiqueta de un equipo. La identidad visual (nombre, marca, sector y
 * logo) sale del restaurante al que el equipo PERTENECE, nunca de una constante:
 * por eso sirve igual para Pizza Hut, KFC, Denny's o China Wok, y para cualquier
 * unidad que se añada después.
 *
 * Nota de diseño: la etiqueta no se guarda el `restaurantId`. `security_labels`
 * solo referencia `equipment_id`, así que la identidad se resuelve en el momento
 * de leer, y un equipo que cambia de unidad imprime con la marca que le toque
 * sin tener que regenerar su token.
 */
export interface LabelEquipmentRow {
  id: string;
  restaurantId: string;
  assetCode: string;
  installationDate: Date | null;
  typeName: string;
  restaurantCode: string;
  restaurantName: string;
  restaurantBrand: string | null;
  restaurantSector: string | null;
  restaurantLogo: string | null;
}

type LabelDb = Pick<
  LibSQLDatabase<typeof schema>,
  "select" | "insert"
>;

/**
 * Devuelve el equipo con la identidad de su restaurante, o `undefined` si no
 * existe o si su tipo/restaurante no fueran válidos (los JOIN son interiores a
 * propósito: no queremos una etiqueta sin marca que imprimir).
 */
export async function getLabelEquipmentRow(
  db: LabelDb,
  equipmentId: string
): Promise<LabelEquipmentRow | undefined> {
  const [row] = await db
    .select({
      id: equipment.id,
      restaurantId: equipment.restaurantId,
      assetCode: equipment.assetCode,
      installationDate: equipment.installationDate,
      typeName: equipmentTypes.name,
      restaurantCode: restaurants.code,
      restaurantName: restaurants.name,
      restaurantBrand: restaurants.brand,
      restaurantSector: restaurants.sector,
      restaurantLogo: restaurants.logo,
    })
    .from(equipment)
    .innerJoin(equipmentTypes, eq(equipment.equipmentTypeId, equipmentTypes.id))
    .innerJoin(restaurants, eq(equipment.restaurantId, restaurants.id))
    .where(eq(equipment.id, equipmentId))
    .limit(1);

  return row;
}

/**
 * Guarda la etiqueta del equipo. Si ya tenía una, conserva la MISMA fila y solo
 * cambia el token: nunca se duplica una etiqueta por equipo, porque
 * `equipment_id` tiene índice único.
 */
export async function upsertSecurityLabel(
  db: LabelDb,
  equipmentId: string,
  token: string,
  now: Date
): Promise<void> {
  await db
    .insert(securityLabels)
    .values({ id: crypto.randomUUID(), equipmentId, token, createdAt: now })
    .onConflictDoUpdate({ target: securityLabels.equipmentId, set: { token } });
}
