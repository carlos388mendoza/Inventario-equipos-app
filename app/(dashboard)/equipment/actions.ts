"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { equipment, equipmentHistory } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { resolveScope, assertRestaurantAccess } from "@/lib/equipment/scope";
import { EQUIPMENT_ACTIONS } from "@/lib/equipment/lifecycle";
import {
  equipmentInputSchema,
  equipmentNoteSchema,
  equipmentStatusChangeSchema,
  equipmentUpdateSchema,
  parseDateInput,
} from "@/lib/validation/equipment";

export type EquipmentActionResult = { ok: true } | { ok: false; error: string };

async function authorizeManager() {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  return user;
}

async function logEvent(params: {
  equipmentId: string;
  restaurantId: string;
  action: string;
  description?: string | null;
  performedBy: string;
}) {
  await db.insert(equipmentHistory).values({
    id: crypto.randomUUID(),
    equipmentId: params.equipmentId,
    restaurantId: params.restaurantId,
    action: params.action,
    description: params.description ?? null,
    performedBy: params.performedBy,
    createdAt: new Date(),
  });
}

export async function createEquipment(
  input: unknown
): Promise<EquipmentActionResult> {
  const user = await authorizeManager();
  try {
    const parsed = equipmentInputSchema.parse(input);
    const scope = await resolveScope();
    assertRestaurantAccess(scope, parsed.restaurantId);

    const [existing] = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.assetCode, parsed.assetCode))
      .limit(1);

    if (existing) {
      return { ok: false, error: "Ya existe un equipo con ese código de activo." };
    }

    const now = new Date();
    const id = crypto.randomUUID();
    await db.insert(equipment).values({
      id,
      assetCode: parsed.assetCode,
      serialNumber: parsed.serialNumber || null,
      equipmentTypeId: parsed.equipmentTypeId,
      restaurantId: parsed.restaurantId,
      brand: parsed.brand || null,
      model: parsed.model || null,
      purchaseDate: parseDateInput(parsed.purchaseDate),
      installationDate: parseDateInput(parsed.installationDate),
      status: "ACTIVE",
      notes: parsed.notes || null,
      createdAt: now,
      updatedAt: now,
    });

    await logEvent({
      equipmentId: id,
      restaurantId: parsed.restaurantId,
      action: EQUIPMENT_ACTIONS.REGISTERED,
      description: `Equipo registrado como ${parsed.assetCode}.`,
      performedBy: user.id,
    });

    revalidatePath("/equipment");
    revalidatePath("/restaurants");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function updateEquipment(
  id: string,
  input: unknown
): Promise<EquipmentActionResult> {
  const user = await authorizeManager();
  try {
    const parsed = equipmentUpdateSchema.parse({ id, ...(input as object) });
    const scope = await resolveScope();
    assertRestaurantAccess(scope, parsed.restaurantId);

    const [existing] = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.assetCode, parsed.assetCode))
      .limit(1);

    if (existing && existing.id !== id) {
      return { ok: false, error: "Ya existe otro equipo con ese código de activo." };
    }

    const now = new Date();
    const changed = await db
      .update(equipment)
      .set({
        assetCode: parsed.assetCode,
        serialNumber: parsed.serialNumber || null,
        equipmentTypeId: parsed.equipmentTypeId,
        restaurantId: parsed.restaurantId,
        brand: parsed.brand || null,
        model: parsed.model || null,
        purchaseDate: parseDateInput(parsed.purchaseDate),
        installationDate: parseDateInput(parsed.installationDate),
        notes: parsed.notes || null,
        updatedAt: now,
      })
      .where(eq(equipment.id, id))
      .returning({ restaurantId: equipment.restaurantId });

    const restaurantId = changed[0]?.restaurantId ?? parsed.restaurantId;
    await logEvent({
      equipmentId: id,
      restaurantId,
      action: EQUIPMENT_ACTIONS.NOTE,
      description: "Datos del equipo actualizados.",
      performedBy: user.id,
    });

    revalidatePath("/equipment");
    revalidatePath(`/equipment/${id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function changeEquipmentStatus(
  input: unknown
): Promise<EquipmentActionResult> {
  const user = await authorizeManager();
  try {
    const parsed = equipmentStatusChangeSchema.parse(input);
    const scope = await resolveScope();

    const [row] = await db
      .select({
        id: equipment.id,
        restaurantId: equipment.restaurantId,
        status: equipment.status,
        assetCode: equipment.assetCode,
      })
      .from(equipment)
      .where(eq(equipment.id, parsed.id))
      .limit(1);

    if (!row) return { ok: false, error: "Equipo no encontrado." };
    assertRestaurantAccess(scope, row.restaurantId);

    if (row.status === parsed.newStatus) {
      return { ok: false, error: "El equipo ya tiene ese estado." };
    }

    const now = new Date();
    await db
      .update(equipment)
      .set({ status: parsed.newStatus, updatedAt: now })
      .where(eq(equipment.id, parsed.id));

    const comment = parsed.comment ? ` Detalle: ${parsed.comment}` : "";
    await logEvent({
      equipmentId: row.id,
      restaurantId: row.restaurantId,
      action: EQUIPMENT_ACTIONS.STATUS_CHANGED,
      description: `Estado de ${row.assetCode}: ${row.status} → ${parsed.newStatus}.${comment}`,
      performedBy: user.id,
    });

    revalidatePath("/equipment");
    revalidatePath(`/equipment/${row.id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function addEquipmentNote(
  input: unknown
): Promise<EquipmentActionResult> {
  const user = await authorizeManager();
  try {
    const parsed = equipmentNoteSchema.parse(input);
    const scope = await resolveScope();

    const [row] = await db
      .select({
        id: equipment.id,
        restaurantId: equipment.restaurantId,
        assetCode: equipment.assetCode,
      })
      .from(equipment)
      .where(eq(equipment.id, parsed.id))
      .limit(1);

    if (!row) return { ok: false, error: "Equipo no encontrado." };
    assertRestaurantAccess(scope, row.restaurantId);

    await logEvent({
      equipmentId: row.id,
      restaurantId: row.restaurantId,
      action: EQUIPMENT_ACTIONS.NOTE,
      description: `Nota sobre ${row.assetCode}: ${parsed.note}`,
      performedBy: user.id,
    });

    revalidatePath(`/equipment/${row.id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

/** Query pública para listas: equipos del alcance actual. */
export async function listEquipmentForScope(opts: {
  restaurantId?: string;
  equipmentTypeId?: string;
  status?: string;
  query?: string;
}) {
  const scope = await resolveScope();
  const conditions = [];

  if (!scope.isGlobal) {
    conditions.push(eq(equipment.restaurantId, scope.restaurantId!));
  } else if (opts.restaurantId) {
    assertRestaurantAccess(scope, opts.restaurantId);
    conditions.push(eq(equipment.restaurantId, opts.restaurantId));
  }
  if (opts.equipmentTypeId) {
    conditions.push(eq(equipment.equipmentTypeId, opts.equipmentTypeId));
  }
  if (opts.status && opts.status !== "ALL") {
    conditions.push(eq(equipment.status, opts.status as never));
  }

  const wineArbol = and(...conditions);
  const rows = wineArbol
    ? await db.select().from(equipment).where(wineArbol)
    : await db.select().from(equipment);

  const filtered = opts.query
    ? rows.filter((r) => {
        const q = opts.query!.toLowerCase();
        return [r.assetCode, r.serialNumber, r.brand, r.model, r.notes]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      })
    : rows;

  return filtered;
}