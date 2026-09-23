import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Conexión a la base de datos mediante Turso/libSQL.
 *
 *  - Desarrollo local: TURSO_DATABASE_URL=file:./data/local.db
 *                      (si no se define, se usa el fallback local).
 *  - Producción:       TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io y
 *                      TURSO_AUTH_TOKEN=<token> (obligatorios; nunca SQLite local).
 *
 * Los secretos se leen únicamente desde variables de entorno del servidor.
 * Nunca se exponen al cliente.
 */

export type DbClient = ReturnType<typeof createClient>;

const DEFAULT_URL = "file:./data/local.db";

/** Elimina el BOM (U+FEFF) y espacios sobrantes de un valor de entorno. */
function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/^\uFEFF/, "").trim();
  return cleaned || undefined;
}

export function resolveDbConfig(
  env: NodeJS.ProcessEnv = process.env
): { url: string; authToken: string | undefined } {
  const url = cleanEnvValue(env.TURSO_DATABASE_URL);
  const authToken = cleanEnvValue(env.TURSO_AUTH_TOKEN);

  // En producción/Vercel nunca se cae a SQLite local: se exige Turso remoto.
  if (env.NODE_ENV === "production") {
    if (!url) {
      throw new Error(
        "Falta TURSO_DATABASE_URL. En producción se requiere una URL remota de Turso (libsql://...)."
      );
    }
    if (!url.startsWith("libsql:")) {
      throw new Error(
        `TURSO_DATABASE_URL debe ser una URL remota de Turso (libsql://...) en producción. Valor inválido: ${url}`
      );
    }
    if (!authToken) {
      throw new Error(
        "Falta TURSO_AUTH_TOKEN. En producción se requiere el token de la base Turso."
      );
    }
    return { url, authToken };
  }

  // Desarrollo local: permite SQLite si no se define una base remota.
  return { url: url ?? DEFAULT_URL, authToken };
}

/** Asegura que el directorio padre exista para bases de datos locales. */
function ensureFileDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const raw = url.slice("file:".length).split("?")[0];
  const filePath = resolve(process.cwd(), raw);
  mkdirSync(dirname(filePath), { recursive: true });
}

export function createDbClient(): DbClient {
  const { url, authToken } = resolveDbConfig();
  ensureFileDirectory(url);
  return createClient({ url, authToken });
}