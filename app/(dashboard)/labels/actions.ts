"use server";

import { revalidateLabelViews } from "@/lib/revalidate";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth/session";
import { resolveScope, assertRestaurantAccess } from "@/lib/equipment/scope";
import { db } from "@/lib/db";
import { getLabelEquipmentRow, upsertSecurityLabel } from "@/lib/db/queries/labels";
import { ROLES } from "@/lib/db/enums";
import { generateLabelSchema } from "@/lib/validation/labels";
import { appBaseUrl } from "@/lib/utils";

export type GenerateLabelResult =
  | {
      ok: true;
      token: string;
      url: string;
      qrDataUrl: string;
      assetCode: string;
      typeName: string;
      restaurantName: string;
      restaurantBrand: string | null;
      restaurantSector: string | null;
      restaurantLogo: string | null;
      installationDate: Date | null;
      createdAt: Date;
    }
  | { ok: false; error: string };

/**
 * Genera (o regenera) la etiqueta de seguridad de un equipo.
 * El token es un identificador opaco único que protege la URL pública:
 * el QR nunca expone información sensible.
 *
 * Funciona con cualquier restaurante: la identidad se lee del restaurante al que
 * pertenece el equipo (ver `getLabelEquipmentRow`), así que no hay ninguna
 * condición que lo limite a una unidad concreta.
 */
export async function generateSecurityLabel(
  input: unknown
): Promise<GenerateLabelResult> {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  const scope = await resolveScope();

  try {
    const parsed = generateLabelSchema.parse(input);

    const row = await getLabelEquipmentRow(db, parsed.equipmentId);
    if (!row) {
      return { ok: false, error: "Equipo no encontrado." };
    }
    assertRestaurantAccess(scope, row.restaurantId);

    const token = crypto.randomUUID().replaceAll("-", "");
    const now = new Date();

    await upsertSecurityLabel(db, row.id, token, now);

    const url = `${appBaseUrl()}/e/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url);

    revalidateLabelViews();
    return {
      ok: true,
      token,
      url,
      qrDataUrl,
      assetCode: row.assetCode,
      typeName: row.typeName,
      restaurantName: row.restaurantName,
      restaurantBrand: row.restaurantBrand,
      restaurantSector: row.restaurantSector,
      restaurantLogo: row.restaurantLogo,
      installationDate: row.installationDate,
      createdAt: now,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo generar la etiqueta." };
  }
}