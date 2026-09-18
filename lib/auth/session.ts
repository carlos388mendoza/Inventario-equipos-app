import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, type SessionUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { userTable } from "@/lib/db/schema";
import { ROLES, asUserRole, type UserRole } from "@/lib/db/enums";

/**
 * Utilidades de sesión y autorización del lado del servidor.
 * Todo acceso a datos debe pasar por aquí; NO confiar en el frontend.
 */

export async function getSession() {
  const requestHeaders = await headers();
  return auth.api.getSession({ headers: requestHeaders });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/** Devuelve el usuario autenticado o redirige a /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Comprueba que el usuario tenga uno de los roles indicados.
 * Devuelve el usuario o redirige a /dashboard en caso de no tener permiso.
 */
export async function requireRole(
  ...roles: UserRole[]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(asUserRole(user.role))) redirect("/dashboard");
  return user;
}

/** Solo ADMIN e IT_MANAGER pueden consultar información global. */
export function canAccessGlobal(user: Pick<SessionUser, "role">): boolean {
  return user.role === ROLES.ADMIN || user.role === ROLES.IT_MANAGER;
}

/** Solo ADMIN puede administrar usuarios/restaurantes/tipos/configuración. */
export function isAdmin(user: Pick<SessionUser, "role">): boolean {
  return user.role === ROLES.ADMIN;
}

export function isItManager(user: Pick<SessionUser, "role">): boolean {
  return user.role === ROLES.IT_MANAGER;
}

/**
 * Comprueba en base de datos que la cuenta siga activa.
 * (Las cuentas desactivadas se cierran de sesión al ser desactivadas,
 * esta comprobación es una barrera adicional de defensa en profundidad.)
 */
export async function isAccountActive(userId: string): Promise<boolean> {
  const rows = await db
    .select({ active: userTable.active })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return rows[0]?.active ?? false;
}