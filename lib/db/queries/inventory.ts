import { asc, and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, equipmentGroups, equipmentTypes, restaurants } from "@/lib/db/schema";
import { INVENTORY_FORMAT, type InventoryFormat } from "@/lib/db/enums";
import type { AccessScope } from "@/lib/equipment/scope";

/** Fila de un documento con un equipo por unidad (formato PH01). */
export interface InventoryAssetRow {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  typeName: string;
  model: string | null;
  restaurantCode: string;
  restaurantName: string;
  restaurantBrand: string | null;
  sourceDocument: string | null;
  sourceShortCode: string | null;
  sourceDescription: string | null;
  sourceQrCode: string | null;
  sourceTechnician: string | null;
  sourceDateText: string | null;
  sourceFormat: InventoryFormat;
}

/** Fila de un documento agregado por rubro (formato DNS19). */
export interface InventoryGroupRow {
  id: string;
  name: string;
  quantity: number;
  totalValue: number | null;
  currency: string | null;
  sourceDocument: string | null;
  restaurantCode: string;
  restaurantName: string;
  restaurantBrand: string | null;
  sourceFormat: InventoryFormat;
}

export interface InventoryData {
  assets: InventoryAssetRow[];
  groups: InventoryGroupRow[];
}

/**
 * Inventario representado tal como viene en los documentos.
 *
 * Los dos formatos se leen y se devuelven por separado, nunca mezclados en una
 * sola lista: un equipo individual y un rubro con cantidad no son la misma
 * cosa, y mostrar "3 x TOMA PEDIDO" junto a un equipo con número de serie en la
 * misma tabla haría creer que son registros equivalentes.
 *
 * Se respeta el scope del usuario en el servidor: un usuario de restaurante
 * solo ve sus propias filas, y `equipmentGroups` se filtra por la misma regla.
 */
export async function getInventory(scope: AccessScope): Promise<InventoryData> {
  const types = await db
    .select({ id: equipmentTypes.id, name: equipmentTypes.name })
    .from(equipmentTypes);
  const typeMap = new Map(types.map((t) => [t.id, t.name]));

  const restaurantRows = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      code: restaurants.code,
      brand: restaurants.brand,
    })
    .from(restaurants);
  const restaurantMap = new Map(restaurantRows.map((r) => [r.id, r]));

  const assetRows = scope.isGlobal
    ? await db.select().from(equipment).orderBy(asc(equipment.assetCode))
    : await db
        .select()
        .from(equipment)
        .where(eq(equipment.restaurantId, scope.restaurantId!))
        .orderBy(asc(equipment.assetCode));

  const groupRows = scope.isGlobal
    ? await db
        .select()
        .from(equipmentGroups)
        .orderBy(asc(equipmentGroups.sourceDocument), asc(equipmentGroups.name))
    : await db
        .select()
        .from(equipmentGroups)
        .where(eq(equipmentGroups.restaurantId, scope.restaurantId!))
        .orderBy(asc(equipmentGroups.sourceDocument), asc(equipmentGroups.name));

  const assets: InventoryAssetRow[] = assetRows.map((e) => {
    const restaurant = restaurantMap.get(e.restaurantId);
    return {
      id: e.id,
      assetCode: e.assetCode,
      serialNumber: e.serialNumber,
      typeName: typeMap.get(e.equipmentTypeId) ?? "—",
      model: e.model,
      restaurantCode: restaurant?.code ?? "—",
      restaurantName: restaurant?.name ?? "—",
      restaurantBrand: restaurant?.brand ?? null,
      sourceDocument: e.sourceDocument,
      sourceShortCode: e.sourceShortCode,
      sourceDescription: e.sourceDescription,
      sourceQrCode: e.sourceQrCode,
      sourceTechnician: e.sourceTechnician,
      sourceDateText: e.sourceDateText,
      // Una fila de `equipment` siempre describe un equipo individual; el
      // formato agregado vive en `equipment_groups`.
      sourceFormat: INVENTORY_FORMAT.PER_ASSET,
    };
  });

  const groups: InventoryGroupRow[] = groupRows.map((g) => {
    const restaurant = restaurantMap.get(g.restaurantId);
    return {
      id: g.id,
      name: g.name,
      quantity: g.quantity,
      totalValue: g.totalValue,
      currency: g.currency,
      sourceDocument: g.sourceDocument,
      restaurantCode: restaurant?.code ?? "—",
      restaurantName: restaurant?.name ?? "—",
      restaurantBrand: restaurant?.brand ?? null,
      sourceFormat: g.sourceFormat,
    };
  });

  return { assets, groups };
}

/** Documentos presentes en el inventario, para los filtros de la vista. */
export async function getInventoryDocuments(
  scope: AccessScope
): Promise<Array<{ document: string; format: InventoryFormat }>> {
  const rows = await getInventory(scope);
  const seen = new Map<string, InventoryFormat>();
  for (const row of rows.groups) {
    if (row.sourceDocument) seen.set(row.sourceDocument, row.sourceFormat);
  }
  for (const row of rows.assets) {
    if (row.sourceDocument) seen.set(row.sourceDocument, INVENTORY_FORMAT.PER_ASSET);
  }
  return [...seen.entries()]
    .map(([document, format]) => ({ document, format }))
    .sort((a, b) => a.document.localeCompare(b.document, "es"));
}

/** Cuenta equipos con documento de origen, para el resumen de la cabecera. */
export async function countDocumentedEquipment(scope: AccessScope): Promise<number> {
  const documented = isNotNull(equipment.sourceDocument);
  const rows = scope.isGlobal
    ? await db.select({ id: equipment.id }).from(equipment).where(documented)
    : await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(and(eq(equipment.restaurantId, scope.restaurantId!), documented));
  return rows.length;
}
