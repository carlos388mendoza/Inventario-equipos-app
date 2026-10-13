"use server";

import { eq } from "drizzle-orm";
import { revalidateUserViews } from "@/lib/revalidate";
import { createUser, revokeUserSessions } from "@/lib/auth/users";
import { requireRole } from "@/lib/auth/session";
import { isNextRedirect } from "@/lib/auth/redirect";
import { db } from "@/lib/db";
import { userTable } from "@/lib/db/schema";
import { ROLES, isTechnicianRole, asUserRole } from "@/lib/db/enums";
import {
  createUserSchema,
  toggleUserActiveSchema,
  updateUserSchema,
} from "@/lib/validation/users";
import { setUserRestaurantAssignments } from "@/lib/db/queries/users";

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
    const parsed = createUserSchema.parse(input);
    const technician = isTechnicianRole(parsed.role);

    const userId = await createUser({
      name: parsed.name,
      email: parsed.email,
      password: parsed.password,
      role: parsed.role,
      restaurantId: technician ? null : parsed.restaurantId || null,
    });

    if (technician) {
      await setUserRestaurantAssignments(userId, parsed.restaurantIds ?? []);
    }

    revalidateUserViews();
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}

export async function updateUserAction(
  input: unknown
): Promise<UserActionResult> {
  await authorize();
  try {
    const parsed = updateUserSchema.parse(input);
    const technician = isTechnicianRole(parsed.role);

    await db
      .update(userTable)
      .set({
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
        restaurantId: technician ? null : parsed.restaurantId || null,
        active: parsed.active,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, parsed.id));

    await setUserRestaurantAssignments(
      parsed.id,
      technician ? parsed.restaurantIds ?? [] : []
    );

    revalidateUserViews();
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}

/**
 * Actualiza solo las asignaciones de un técnico. La usan el jefe de técnicos y
 * el administrador desde su pantalla (issue #16); por eso autoriza a ambos.
 */
export async function setTechnicianAssignmentsAction(input: {
  userId: string;
  restaurantIds: string[];
}): Promise<UserActionResult> {
  const current = await requireRole(
    ROLES.ADMIN,
    ROLES.HEAD_TECHNICIAN
  );
  try {
    const [target] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, input.userId));
    if (!target) return { ok: false, error: "Usuario no encontrado." };
    if (!isTechnicianRole(asUserRole(target.role))) {
      return { ok: false, error: "El usuario no es un técnico." };
    }
    // Un jefe de técnicos no puede reasignarse a sí mismo fuera del sistema.
    if (
      asUserRole(current.role) === ROLES.HEAD_TECHNICIAN &&
      input.userId === current.id
    ) {
      return {
        ok: false,
        error: "No puedes cambiar tus propias asignaciones.",
      };
    }

    await setUserRestaurantAssignments(input.userId, input.restaurantIds);
    revalidateUserViews();
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    };
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

    revalidateUserViews();
    return { ok: true };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}
