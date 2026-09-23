import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

type DemoRow = {
  name: string;
  code: string;
  brand: string;
  sector: string;
  logo: string;
  address: string;
};

const DEMO: DemoRow[] = [
  { name: "Pizza Hut", code: "PZ01", brand: "Pizza Hut", sector: "Restaurantes", logo: "/brands/pizza-hut.svg", address: "Av. Principal 101" },
  { name: "KFC", code: "KF02", brand: "KFC", sector: "Restaurantes", logo: "/brands/kfc.svg", address: "Av. Principal 123" },
  { name: "Denny" + String.fromCharCode(39) + "s", code: "DN03", brand: "Denny" + String.fromCharCode(39) + "s", sector: "Restaurantes", logo: "/brands/dennys.svg", address: "Centro Comercial" },
  { name: "China Wok", code: "CW04", brand: "China Wok", sector: "Restaurantes", logo: "/brands/china-wok.svg", address: "Zona Centro" },
];

const now = Date.now();
for (const r of DEMO) {
  const hit = await client.execute({
    sql: "SELECT id FROM restaurants WHERE code = ?",
    args: [r.code],
  });
  if (hit.rows.length > 0) {
    await client.execute({
      sql: "UPDATE restaurants SET brand = ?, sector = ?, logo = ?, updatedAt = ? WHERE code = ?",
      args: [r.brand, r.sector, r.logo, now, r.code],
    });
    console.log("UPDATED=" + r.code + " (" + r.name + ")");
  } else {
    await client.execute({
      sql: "INSERT INTO restaurants (id, name, code, address, brand, sector, logo, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      args: [randomUUID(), r.name, r.code, r.address, r.brand, r.sector, r.logo, now, now],
    });
    console.log("INSERTED=" + r.code + " (" + r.name + ")");
  }
}

const verify = await client.execute("SELECT name, code, brand, sector, logo FROM restaurants ORDER BY code");
console.log("TOTAL_RESTAURANTS=" + verify.rows.length);
for (const x of verify.rows) {
  console.log([x.name, x.code, x.brand ?? "-", x.sector ?? "-", x.logo ?? "-"].join(" | "));
}
client.close();
