import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentTypes,
  restaurants,
  securityLabels,
} from "@/lib/db/schema";
import { EQUIPMENT_STATUS_LABELS } from "@/lib/db/enums";
import { Badge } from "@/components/ui/badge";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

/**
 * Página pública de una etiqueta de seguridad (QR).
 * ÚNICA ruta sin autenticación. Muestra únicamente: tipo, marca/modelo,
 * restaurante, fecha de instalación y estado. Nunca serial, notas ni
 * datos de usuarios. Busca por token opaco, jamás por id.
 */
export const metadata: Metadata = {
  title: "Equipo",
  robots: { index: false, follow: false },
};

export default async function PublicEquipmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const rows = await db
    .select({
      assetCode: equipment.assetCode,
      status: equipment.status,
      brand: equipment.brand,
      model: equipment.model,
      installationDate: equipment.installationDate,
      typeName: equipmentTypes.name,
      restaurantName: restaurants.name,
      restaurantCode: restaurants.code,
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
    .where(eq(securityLabels.token, token))
    .limit(1);

  if (rows.length === 0) notFound();
  const row = rows[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Equipo registrado</CardTitle>
          <CardDescription className="font-mono text-sm">
            {row.assetCode}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-primary/5 p-4 text-center">
            <p className="text-lg font-semibold">{row.typeName}</p>
            {[row.brand, row.model].filter(Boolean).length > 0 && (
              <p className="text-muted-foreground">
                {[row.brand, row.model].filter(Boolean).join(" ")}
              </p>
            )}
          </div>
          <div className="flex justify-center rounded-md bg-primary/5 p-4">
            <RestaurantIdentity
              restaurant={{
                name: row.restaurantName,
                brand: row.restaurantBrand,
                sector: row.restaurantSector,
                logo: row.restaurantLogo,
              }}
              size="lg"
              className="justify-center"
            />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Restaurante asignado</dt>
              <dd>
                {row.restaurantName} ({row.restaurantCode})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fecha de instalación</dt>
              <dd>{formatDate(row.installationDate)}</dd>
            </div>
          </dl>
          <div className="flex justify-center">
            <Badge variant="secondary">
              {EQUIPMENT_STATUS_LABELS[row.status] ?? row.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}