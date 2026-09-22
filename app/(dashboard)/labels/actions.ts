"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth/session";
import { resolveScope, assertRestaurantAccess } from "@/lib/equipment/scope";
import { db } from "@/lib/db";
import { equipment, securityLabels } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { generateLabelSchema } from "@/lib/validation/labels";
import { appBaseUrl } from "@/lib/utils";

export type GenerateLabelResult =
  | { ok: true; token: string; url: string; qrDataUrl: string }
  | { ok: false; error: string };

/**
 * Genera (o regenera) la etiqueta de seguridad de un equipo.
 * El token es un identificador opaco único que protege la URL pública:
 * el QR nunca expone información sensible.
 */
export async function generateSecurityLabel(
  input: unknown
): Promise<GenerateLabelResult> {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  const scope = await resolveScope();

  try {
    const parsed = generateLabelSchema.parse(input);

    const [row] = await db
      .select({ id: equipment.id, restaurantId: equipment.restaurantId })
      .from(equipment)
      .where(eq(equipment.id, parsed.equipmentId))
      .limit(1);

    if (!row) {
      return { ok: false, error: "Equipo no encontrado." };
    }
    assertRestaurantAccess(scope, row.restaurantId);

    const token = crypto.randomUUID().replaceAll("-", "");
    const now = new Date();

    await db
      .insert(securityLabels)
      .values({
        id: crypto.randomUUID(),
        equipmentId: row.id,
        token,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: securityLabels.equipmentId,
        set: { token },
      });

    const url = `${appBaseUrl()}/e/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url);

    revalidatePath("/labels");
    revalidatePath("/equipment");
    return { ok: true, token, url, qrDataUrl };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo generar la etiqueta." };
  }
}