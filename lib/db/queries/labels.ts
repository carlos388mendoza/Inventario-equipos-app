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
  "select" | "insert" | "update"
>;

/**
 * Relación del equipo que falta para poder emitir su etiqueta. La etiqueta
 * física imprime solo QR + logo, pero el tipo viaja al QR y la página pública
 * `/e/[token]` lo muestra, así que ambos siguen siendo obligatorios: aquí se
 * distingue "no existe" de "existe pero le falta una relación" para no
 * confundir a quien genera la etiqueta (issue #34).
 */
export type LabelEquipmentIssue = "TYPE" | "RESTAURANT";

export type LabelEquipmentResolution =
  | { status: "ok"; row: LabelEquipmentRow }
  | { status: "not-found" }
  | { status: "incomplete"; assetCode: string; issues: LabelEquipmentIssue[] };

/**
 * Resuelve el equipo con la identidad de su restaurante. Usa JOIN exteriores
 * para poder decir EXACTAMENTE qué falta cuando la relación está rota, en vez
 * de devolver un genérico "no encontrado".
 */
export async function resolveLabelEquipment(
  db: LabelDb,
  equipmentId: string
): Promise<LabelEquipmentResolution> {
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
    .leftJoin(equipmentTypes, eq(equipment.equipmentTypeId, equipmentTypes.id))
    .leftJoin(restaurants, eq(equipment.restaurantId, restaurants.id))
    .where(eq(equipment.id, equipmentId))
    .limit(1);

  if (!row) return { status: "not-found" };

  const issues: LabelEquipmentIssue[] = [];
  if (row.typeName === null) issues.push("TYPE");
  if (row.restaurantName === null) issues.push("RESTAURANT");
  if (issues.length > 0) {
    return { status: "incomplete", assetCode: row.assetCode, issues };
  }

  return {
    status: "ok",
    row: {
      id: row.id,
      restaurantId: row.restaurantId,
      assetCode: row.assetCode,
      installationDate: row.installationDate,
      typeName: row.typeName as string,
      restaurantCode: row.restaurantCode as string,
      restaurantName: row.restaurantName as string,
      restaurantBrand: row.restaurantBrand,
      restaurantSector: row.restaurantSector,
      restaurantLogo: row.restaurantLogo,
    },
  };
}

/**
 * Devuelve el equipo con la identidad de su restaurante, o `undefined` si no
 * existe o si su tipo/restaurante no fueran válidos (la etiqueta no se emite
 * sin ellos a propósito).
 */
export async function getLabelEquipmentRow(
  db: LabelDb,
  equipmentId: string
): Promise<LabelEquipmentRow | undefined> {
  const resolution = await resolveLabelEquipment(db, equipmentId);
  return resolution.status === "ok" ? resolution.row : undefined;
}

/**
 * Guarda la etiqueta del equipo. Si ya tenía una, conserva la MISMA fila y solo
 * cambia el token: nunca se duplica una etiqueta por equipo, porque
 * `equipment_id` tiene índice único.
 *
 * Si ya existía una etiqueta (regeneración), se marca `regeneratedAt` con
 * la fecha/hora de regeneración. Si es la primera vez, `regeneratedAt` queda
 * en NULL.
 */
export async function upsertSecurityLabel(
  db: LabelDb,
  equipmentId: string,
  token: string,
  now: Date
): Promise<void> {
  const existing = await db
    .select({ id: securityLabels.id })
    .from(securityLabels)
    .where(eq(securityLabels.equipmentId, equipmentId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(securityLabels)
      .set({ token, regeneratedAt: now })
      .where(eq(securityLabels.equipmentId, equipmentId));
    return;
  }

  await db
    .insert(securityLabels)
    .values({
      id: crypto.randomUUID(),
      equipmentId,
      token,
      createdAt: now,
      regeneratedAt: null,
    })
    .onConflictDoUpdate({
      target: securityLabels.equipmentId,
      set: { token, regeneratedAt: now },
    });
}
