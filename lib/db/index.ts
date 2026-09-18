import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { createDbClient } from "@/lib/db/client";

/**
 * Instancia global de Drizzle conectada a Turso/libSQL.
 * Se crea una única vez por proceso (incluido Vercel Serverless).
 */

const client = createDbClient();

export const db = drizzle(client, { schema });

export type Db = typeof db;

export * from "@/lib/db/schema";
export { client as dbClient }; // import { dbClient } from "@/lib/db"