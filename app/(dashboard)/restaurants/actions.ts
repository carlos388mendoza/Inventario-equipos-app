"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import {
  restaurantInputSchema,
  restaurantToggleSchema,
  restaurantUpdateSchema,
} from "@/lib/validation/restaurants";

export type RestaurantActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function authorize() {
  await requireRole(ROLES.ADMIN);
}

export async function createRestaurant(
  input: unknown
): Promise<RestaurantActionResult> {
  await authorize();
  try {
    const parsed = restaurantInputSchema.parse(input);

    const [existing] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(
        or(
          eq(restaurants.code, parsed.code),
          eq(restaurants.name, parsed.name)
        )
      )
      .limit(1);

    if (existing) {
      return {
        ok: false,
        error: "Ya existe un restaurante con ese código o nombre.",
      };
    }

    const now = new Date();
    await db.insert(restaurants).values({
      id: crypto.randomUUID(),
      name: parsed.name,
      code: parsed.code,
      address: parsed.address || null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/restaurants");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function updateRestaurant(
  id: string,
  input: unknown
): Promise<RestaurantActionResult> {
  await authorize();
  try {
    const parsed = restaurantUpdateSchema.parse({ id, ...(input as object) });

    const [existing] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(
        or(
          eq(restaurants.code, parsed.code),
          eq(restaurants.name, parsed.name)
        )
      )
      .limit(1);

    if (existing && existing.id !== id) {
      return {
        ok: false,
        error: "Ya existe otro restaurante con ese código o nombre.",
      };
    }

    await db
      .update(restaurants)
      .set({
        name: parsed.name,
        code: parsed.code,
        address: parsed.address || null,
        updatedAt: new Date(),
      })
      .where(eq(restaurants.id, id));

    revalidatePath("/restaurants");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function toggleRestaurantActive(
  input: unknown
): Promise<RestaurantActionResult> {
  await authorize();
  try {
    const parsed = restaurantToggleSchema.parse(input);

    await db
      .update(restaurants)
      .set({ active: parsed.active, updatedAt: new Date() })
      .where(eq(restaurants.id, parsed.id));

    revalidatePath("/restaurants");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}