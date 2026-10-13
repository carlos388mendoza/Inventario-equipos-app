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
  deleteUserSchema,
  toggleUserActiveSchema,
  updateUserSchema,
} from "@/lib/validation/users";
import {
  getUserAccount,
  listActiveAdminIds,
  setUserRestaurantAssignments,
  type UserAccountState,
} from "@/lib/db/queries/users";

export type UserActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function authorize() {
  return requireRole(ROLES.ADMIN);
}

/** ¿La cuenta cuenta como administrador activo y vigente? */
function isActiveAdmin(
  state: Pick<UserAccountState, "role" | "active" | "deletedAt">
): boolean {
  return state.role === ROLES.ADMIN && state.active && !state.deletedAt;
}

/** ¿Existe algún OTRO administrador activo además del indicado? */
async function otherActiveAdminsExist(excludeId: string): Promise<boolean> {
  const ids = await listActiveAdminIds();
  return ids.some((id) => id !== excludeId);
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
  const current = await authorize();
  try {
    const parsed = updateUserSchema.parse(input);
    const technician = isTechnicianRole(parsed.role);

    const target = await getUserAccount(parsed.id);
    if (!target) return { ok: false, error: "Usuario no encontrado." };
    // Una cuenta dada de baja es inmutable desde el panel.
    if (target.deletedAt) {
      return {
        ok: false,
        error: "La cuenta está dada de baja y no puede editarse.",
      };
    }
    // Un administrador no puede quitarse a sí mismo el rol de administrador.
    if (parsed.id === current.id && parsed.role !== ROLES.ADMIN) {
      return {
        ok: false,
        error: "No puedes quitarte a ti mismo el rol de administrador.",
      };
    }
    // Nunca dejar el sistema sin administradores activos.
    if (isActiveAdmin(target) && parsed.role !== ROLES.ADMIN) {
      if (!(await otherActiveAdminsExist(target.id))) {
        return {
          ok: false,
          error:
            "No puedes quitar el rol de administrador al último administrador activo.",
        };
      }
    }

    await db
      .update(userTable)
      .set({
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
        restaurantId: technician ? null : parsed.restaurantId || null,
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

/**
 * Activa o desactiva una cuenta. Guardas de servidor:
 *  - Solo ADMIN (la puerta).
 *  - No se puede tocar una cuenta dada de baja (evita reactivaciones accidentales).
 *  - Un administrador no puede desactivar su propia cuenta.
 *  - No se puede desactivar al último administrador activo.
 * Al desactivar se conservan rol y restaurante, y se revocan las sesiones.
 */
export async function toggleUserActiveAction(
  input: unknown
): Promise<UserActionResult> {
  const current = await authorize();
  try {
    const parsed = toggleUserActiveSchema.parse(input);

    const target = await getUserAccount(parsed.id);
    if (!target) return { ok: false, error: "Usuario no encontrado." };
    if (target.deletedAt) {
      return {
        ok: false,
        error: "La cuenta está dada de baja y no puede reactivarse desde aquí.",
      };
    }
    if (parsed.id === current.id) {
      return {
        ok: false,
        error: "No puedes cambiar el estado de tu propia cuenta.",
      };
    }
    if (!parsed.active && isActiveAdmin(target)) {
      if (!(await otherActiveAdminsExist(target.id))) {
        return {
          ok: false,
          error: "No puedes desactivar al último administrador activo.",
        };
      }
    }

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

/**
 * Da de baja lógica una cuenta (soft delete): marca `deletedAt` y desactiva,
 * pero NO borra la fila, para conservar el historial de solicitudes, equipos y
 * movimientos que la referencian. Guardas de servidor:
 *  - Solo ADMIN (la puerta).
 *  - No se puede eliminar una cuenta ya dada de baja.
 *  - Un administrador no puede eliminar su propia cuenta.
 *  - No se puede eliminar al último administrador activo.
 * Conserva el rol y el restaurante asignado, y revoca las sesiones.
 */
export async function deleteUserAction(
  input: unknown
): Promise<UserActionResult> {
  const current = await authorize();
  try {
    const parsed = deleteUserSchema.parse(input);

    const target = await getUserAccount(parsed.id);
    if (!target) return { ok: false, error: "Usuario no encontrado." };
    if (target.deletedAt) {
      return { ok: false, error: "La cuenta ya está dada de baja." };
    }
    if (parsed.id === current.id) {
      return {
        ok: false,
        error: "No puedes eliminar tu propia cuenta.",
      };
    }
    if (isActiveAdmin(target)) {
      if (!(await otherActiveAdminsExist(target.id))) {
        return {
          ok: false,
          error: "No puedes eliminar al último administrador activo.",
        };
      }
    }

    const now = new Date();
    await db
      .update(userTable)
      .set({ deletedAt: now, active: false, updatedAt: now })
      .where(eq(userTable.id, parsed.id));

    await revokeUserSessions(parsed.id);

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
