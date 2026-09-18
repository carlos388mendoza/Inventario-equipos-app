import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Conexión a la base de datos mediante Turso/libSQL.
 *
 *  - Desarrollo local:  TURSO_DATABASE_URL=file:./data/local.db
 *  - Producción:        TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io
 *                       TURSO_AUTH_TOKEN=<token>
 *
 * Los secretos se leen únicamente desde variables de entorno del servidor.
 * Nunca se exponen al cliente.
 */

export type DbClient = ReturnType<typeof createClient>;

const DEFAULT_URL = "file:./data/local.db";

export function resolveDbConfig(
  env: NodeJS.ProcessEnv = process.env
): { url: string; authToken: string | undefined } {
  const url = env.TURSO_DATABASE_URL || DEFAULT_URL;
  const authToken = env.TURSO_AUTH_TOKEN || undefined;
  return { url, authToken };
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