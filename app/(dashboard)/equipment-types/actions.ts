"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { equipmentTypes } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import {
  equipmentTypeInputSchema,
  equipmentTypeToggleSchema,
  equipmentTypeUpdateSchema,
} from "@/lib/validation/equipment-types";

export type EquipmentTypeActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function authorize() {
  await requireRole(ROLES.ADMIN);
}

export async function createEquipmentType(
  input: unknown
): Promise<EquipmentTypeActionResult> {
  await authorize();
  try {
    const parsed = equipmentTypeInputSchema.parse(input);

    const [existing] = await db
      .select({ id: equipmentTypes.id })
      .from(equipmentTypes)
      .where(eq(equipmentTypes.name, parsed.name))
      .limit(1);

    if (existing) {
      return { ok: false, error: "Ya existe un tipo de equipo con ese nombre." };
    }

    const now = new Date();
    await db.insert(equipmentTypes).values({
      id: crypto.randomUUID(),
      name: parsed.name,
      description: parsed.description || null,
      usefulLifeMonths: parsed.usefulLifeMonths,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/equipment-types");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function updateEquipmentType(
  id: string,
  input: unknown
): Promise<EquipmentTypeActionResult> {
  await authorize();
  try {
    const parsed = equipmentTypeUpdateSchema.parse({ id, ...(input as object) });

    const [existing] = await db
      .select({ id: equipmentTypes.id })
      .from(equipmentTypes)
      .where(eq(equipmentTypes.name, parsed.name))
      .limit(1);

    if (existing && existing.id !== id) {
      return { ok: false, error: "Ya existe otro tipo de equipo con ese nombre." };
    }

    await db
      .update(equipmentTypes)
      .set({
        name: parsed.name,
        description: parsed.description || null,
        usefulLifeMonths: parsed.usefulLifeMonths,
        updatedAt: new Date(),
      })
      .where(eq(equipmentTypes.id, id));

    revalidatePath("/equipment-types");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function toggleEquipmentTypeActive(
  input: unknown
): Promise<EquipmentTypeActionResult> {
  await authorize();
  try {
    const parsed = equipmentTypeToggleSchema.parse(input);

    await db
      .update(equipmentTypes)
      .set({ active: parsed.active, updatedAt: new Date() })
      .where(eq(equipmentTypes.id, parsed.id));

    revalidatePath("/equipment-types");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}