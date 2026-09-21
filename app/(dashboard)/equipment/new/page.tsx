import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { equipmentTypes, restaurants } from "@/lib/db/schema";
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

export default async function NewEquipmentPage() {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);

  const [types, restaurantRows] = await Promise.all([
    db.select().from(equipmentTypes).orderBy(asc(equipmentTypes.name)),
    db.select().from(restaurants).orderBy(asc(restaurants.name)),
  ]);

  return (
    <main className="p-6">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Registrar equipo</CardTitle>
          <CardDescription>
            Registra un equipo físico nuevo en el inventario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentForm
            restaurantOptions={restaurantRows.map((r) => ({
              id: r.id,
              name: r.name,
              code: r.code,
            }))}
            typeOptions={types.map((t) => ({ id: t.id, name: t.name }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}