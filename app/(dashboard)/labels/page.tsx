import { asc, desc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentTypes,
  restaurants,
  securityLabels,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { LabelsManager } from "@/components/labels/labels-manager";
import { appBaseUrl } from "@/lib/utils";
import type { LabelDto } from "./types";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);

  const [labelRows, restaurantRows, equipmentRows] = await Promise.all([
    db
      .select({
        label: securityLabels,
        assetCode: equipment.assetCode,
        installationDate: equipment.installationDate,
        typeName: equipmentTypes.name,
        restaurantName: restaurants.name,
        restaurantBrand: restaurants.brand,
        restaurantSector: restaurants.sector,
        restaurantLogo: restaurants.logo,
      })
      .from(securityLabels)
      .innerJoin(equipment, eq(securityLabels.equipmentId, equipment.id))
      .innerJoin(
        equipmentTypes,
        eq(equipment.equipmentTypeId, equipmentTypes.id)
      )
      .innerJoin(restaurants, eq(equipment.restaurantId, restaurants.id))
      .orderBy(desc(securityLabels.createdAt)),
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
        installationDate: r.installationDate,
      };
    })
  );

  return (
    <main className="p-6">
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
      />
    </main>
  );
}