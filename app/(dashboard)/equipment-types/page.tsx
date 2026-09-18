import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { equipmentTypes } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { EquipmentTypeManager } from "@/components/equipment-types/equipment-type-manager";
import type { EquipmentTypeDto } from "./types";

export const dynamic = "force-dynamic";

export default async function EquipmentTypesPage() {
  await requireRole(ROLES.ADMIN);

  const rows = await db
    .select()
    .from(equipmentTypes)
    .orderBy(asc(equipmentTypes.name));

  const list: EquipmentTypeDto[] = rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    usefulLifeMonths: t.usefulLifeMonths,
    active: t.active,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return (
    <main className="p-6">
      <EquipmentTypeManager equipmentTypes={list} />
    </main>
  );
}