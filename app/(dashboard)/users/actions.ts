"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createUser, revokeUserSessions } from "@/lib/auth/users";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userTable } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import {
  createUserSchema,
  toggleUserActiveSchema,
  updateUserSchema,
} from "@/lib/validation/users";

export type UserActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function authorize() {
  await requireRole(ROLES.ADMIN);
}

export async function createUserAction(
  input: unknown
): Promise<UserActionResult> {
  await authorize();
  try {
    const parsed = createUserSchema.parse(input0products);

    await createUser({
      name: parsed.name,
      email: parsed.email,
      password: parsed.password,
      role: parsed.role,
      restaurantId: parsed.restaurantId || null,
    });

    revalidatePath("/users");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function updateUserAction(
  input: unknown
): Promise<UserActionResult> {
  await authorize();
  try {
    const parsed = updateUserSchema.parse(input);

    await db
      .update(userTable)
      .set({
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
        restaurantId: parsed.restaurantId || null,
        active: parsed.active,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, parsed.id));

    revalidatePath("/users");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export async function toggleUserActiveAction(
  input: unknown
): Promise<UserActionResult> {
  await authorize();
  try {
    const parsed = toggleUserActiveSchema.parse(input);

    await db
      .update(userTable)
      .set({ active: parsed.active, updatedAt: new Date() })
      .where(eq(userTable.id, parsed.id));

    if (!parsed.active) {
      await revokeUserSessions(parsed.id);
    }

    revalidatePath("/users");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}
