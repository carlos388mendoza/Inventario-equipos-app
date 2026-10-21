import { asc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { equipment, restaurants } from "@/lib/db/schema";
import { listSecurityLabelRows } from "@/lib/db/queries/labels";
import { ROLES } from "@/lib/db/enums";
import { LabelsManager } from "@/components/labels/labels-manager";
import { appBaseUrl } from "@/lib/utils";
import type { LabelDto } from "./types";

export const dynamic = "force-dynamic";

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ equipment?: string }>;
}) {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  // Al registrar un equipo, el toast de éxito enlaza aquí con su id para
  // preseleccionarlo y no tener que buscarlo en la lista.
  const { equipment: suggestedEquipmentId } = await searchParams;

  const [labelRows, restaurantRows, equipmentRows] = await Promise.all([
    listSecurityLabelRows(db),
    db
      .select()
      .from(restaurants)
      .where(eq(restaurants.active, true))
      .orderBy(asc(restaurants.name)),
    db.select().from(equipment).orderBy(asc(equipment.assetCode)),
  ]);

  const labels: LabelDto[] = await Promise.all(
    labelRows.map(async (r) => {
      const url = `${appBaseUrl()}/e/${r.label.token}`;
      return {
        id: r.label.id,
        equipmentId: r.label.equipmentId,
        assetCode: r.assetCode,
        typeName: r.typeName,
        restaurantName: r.restaurantName,
        restaurantBrand: r.restaurantBrand,
        restaurantSector: r.restaurantSector,
        restaurantLogo: r.restaurantLogo,
        token: r.label.token,
        url,
        qrDataUrl: await QRCode.toDataURL(url),
        createdAt: r.label.createdAt,
        regeneratedAt: r.label.regeneratedAt ?? null,
        installationDate: r.installationDate,
      };
    })
  );

  return (
    <main className="p-4 sm:p-6">
      <LabelsManager
        labels={labels}
        restaurantOptions={restaurantRows.map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code,
        }))}
        equipmentOptions={equipmentRows.map((e) => ({
          id: e.id,
          assetCode: e.assetCode,
          restaurantId: e.restaurantId,
        }))}
        initialEquipmentId={suggestedEquipmentId}
      />
    </main>
  );
}