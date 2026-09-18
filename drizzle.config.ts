import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dialect: "turso",
  envFile: ".env.local",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "file:./data/local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});