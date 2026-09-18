import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import {
  accountTable,
  sessionTable,
  userTable,
  verificationTable,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";

const secret =
  process.env.BETTER_AUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "dev-secret-inseguro-cambiar-en-produccion-1234567890"
    : null);

if (!secret) {
  throw new Error(
    "Falta BETTER_AUTH_SECRET. Genera uno con: npx @better-auth/cli secret"
  );
}

/**
 * Configuración central de Better Auth.
 *
 * - Correo/contraseña habilitado y registro público deshabilitado
 *   (los usuarios se crean desde el panel de administración).
 * - Campos adicionales del usuario (no editables desde el cliente):
 *   role, restaurantId y active.
 * - Adapter de Drizzle sobre Turso/libSQL.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: userTable,
      session: sessionTable,
      account: accountTable,
      verification: verificationTable,
    },
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: ROLES.RESTAURANT_USER,
      },
      restaurantId: {
        type: "string",
        input: false,
      },
      active: {
        type: "boolean",
        input: false,
        defaultValue: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // renueva cada 24h
  },
});

/**
 * Clave tipada de la sesión devuelta por Better Auth
 * (incluye los campos adicionales role/restaurantId/active).
 */
export type AuthSession = typeof auth.$Infer.Session;
export type SessionUser = AuthSession["user"];