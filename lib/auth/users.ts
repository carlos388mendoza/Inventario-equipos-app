import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { accountTable, sessionTable, userTable } from "@/lib/db/schema";
import type { UserRole } from "@/lib/db/enums";

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  restaurantId?: string | null;
}

/**
 * Crea un usuario directamente en la base de datos (mismo formato que
 * Better Auth): fila en `user` + fila en `account` con provider "credential"
 * y el hash de la contraseña.
 *
 * Solo debe invocarse desde el servidor (administración de usuarios y seed).
 */
export async function createUser(input: CreateUserInput): Promise<string> {
  const now = new Date();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);

  await db.insert(userTable).values({
    id: userId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
    role: input.role,
    restaurantId: input.restaurantId ?? null,
    active: true,
  });

  await db.insert(accountTable).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: "credential",
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  return userId;
}

/** Remueve todas las sesiones de un usuario (cierre de sesión forzado). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
}