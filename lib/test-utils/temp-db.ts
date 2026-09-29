import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/lib/db/schema";

/**
 * Base de datos SQLite en memoria con el ESQUEMA REAL (las migraciones del
 * proyecto), para probar consultas y operaciones de mantenimiento de verdad en
 * lugar de contra un doble que siempre dice que sí.
 *
 * Cada llamada devuelve una base aislada y nueva, así que un test no puede
 * contaminar a otro. Va en memoria y no en un archivo: no toca Turso, no deja
 * restos en el disco y evita el bloqueo de fichero que da Windows cuando el
 * driver aún no ha soltado el handle.
 */
export interface TempDb {
  db: LibSQLDatabase<typeof schema>;
  client: Client;
  close(): void;
}

export async function createTempDb(): Promise<TempDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "lib/db/migrations" });

  return {
    db,
    client,
    close() {
      client.close();
    },
  };
}

/** Un id estable y legible, sin `crypto`, para construir datos de prueba. */
export function testId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
