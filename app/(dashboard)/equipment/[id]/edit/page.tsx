import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, equipmentTypes, restaurants } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { resolveScope, assertRestaurantAccess } from "@/lib/equipment/scope";
import { ROLES } from "@/lib/db/enums";
import { EquipmentForm } from "@/components/equipment/equipment-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  const scope = await resolveScope();

  const [types, restaurantRows, equipmentRows] = await Promise.all([
    db.select().from(equipmentTypes).orderBy(asc(equipmentTypes.name)),
    db.select().from(restaurants).orderBy(asc(restaurants.name)),
    db.select().from(equipment).where(eq(equipment.id, id)).limit(1),
  ]);

  if (equipmentRows.length === 0) notFound();
  const item = equipmentRows[0];
  assertRestaurantAccess(scope, item.restaurantId);

  return (
    <main className="p-6">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Editar equipo</CardTitle>
          <CardDescription>
            Modifica los datos del equipo {item.assetCode}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentForm
            equipmentId={id}
            restaurantOptions={restaurantRows.map((r) => ({
              id: r.id,
              name: r.name,
              code: r.code,
            }))}
            typeOptions={types.map((t) => ({ id: t.id, name: t.name }))}
            initial={{
              assetCode: item.assetCode,
              serialNumber: item.serialNumber,
              equipmentTypeId: item.equipmentTypeId,
              restaurantId: item.restaurantId,
              brand: item.brand,
              model: item.model,
              purchaseDate: item.purchaseDate,
              installationDate: item.installationDate,
              notes: item.notes,
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}