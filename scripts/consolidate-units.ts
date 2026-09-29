/**
 * Mantenimiento: consolida dos unidades en una.
 *
 * Herramienta genérica y reutilizable. El caso real que la motivó fue
 * PH01 -> PZ01, ya aplicado y cerrado: PH01 no existe hoy en `restaurants` y su
 * inventario vive en PZ01. Ese nombre aparece en la documentación solo como
 * memoria de la operación, nunca como unidad por defecto: el script exige
 * `--source` y `--target` explícitos, así que ninguna ejecución puede dar por
 * hecho que PH01 (ni ninguna otra unidad) exista.
 *
 * Por defecto SOLO LECTURA: imprime el plan y no escribe nada. Hay que pasar
 * `--apply` explícitamente para que escriba.
 *
 *   npx.cmd tsx --env-file=.env.local scripts/consolidate-units.ts --source <ORIGEN> --target <DESTINO>
 *   npx.cmd tsx --env-file=.env.local scripts/consolidate-units.ts --source <ORIGEN> --target <DESTINO> --apply
 *
 * Reutiliza `lib/restaurants/consolidate-units.ts`, que es la misma función que
 * cubren los tests: el script no reimplementa la lógica, solo la invoca e imprime.
 *
 * No hay INSERT ni DELETE en ninguna parte: no crea ni borra unidades ni equipos.
 * La unidad origen se retira con `active = false` y se conservan equipos,
 * asset_code, series, tokens y auditoría.
 */
import { createClient } from "@libsql/client";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import {
  consolidateUnit,
  planUnitConsolidation,
  type ConsolidatableDb,
} from "../lib/restaurants/consolidate-units";
import { equipment, restaurants } from "../lib/db/schema";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const argOf = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  const value = i >= 0 ? argv[i + 1] : undefined;
  return value ? value : fallback;
};

// Ambas unidades son obligatorias y no tienen valor por defecto. Un default
// sería una afirmación sobre qué unidades existen, y esa lista cambia con el
// tiempo: la última vez que había un default (PH01) dejó de ser cierto al
// consolidar el inventario. Ahora el script no sabe ninguna: pregunta.
const sourceCode = argOf("--source", "");
const targetCode = argOf("--target", "");

if (!sourceCode || !targetCode) {
  console.error(
    "Faltan las unidades. Indica origen y destino de forma explicita:\n" +
      "  npx.cmd tsx --env-file=.env.local scripts/consolidate-units.ts --source <ORIGEN> --target <DESTINO>\n" +
      "  (anade --apply para escribir; sin --apply solo imprime el plan)"
  );
  process.exit(1);
}

const tursoUrl = process.env.TURSO_DATABASE_URL;
if (!tursoUrl) {
  console.error(
    "Falta TURSO_DATABASE_URL. Ejecuta con: npx.cmd tsx --env-file=.env.local scripts/consolidate-units.ts"
  );
  process.exit(1);
}

const client = createClient({
  url: tursoUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db: ConsolidatableDb = drizzle(client);

const line = (label: string, value: number | string | boolean) =>
  console.log(String(value).padStart(7), " ", label);

async function countEquipment(db: ConsolidatableDb, restaurantId: string) {
  const rows = await db
    .select({ n: count() })
    .from(equipment)
    .where(eq(equipment.restaurantId, restaurantId));
  return Number(rows[0]?.n ?? 0);
}

async function main(): Promise<void> {
  console.log("=".repeat(66));
  console.log(
    apply
      ? `CONSOLIDAR ${sourceCode} -> ${targetCode}   (ESCRITURA)`
      : `PLAN ${sourceCode} -> ${targetCode}   (solo lectura, no se escribe nada)`
  );
  console.log("=".repeat(66));

  const plan = await planUnitConsolidation(db, sourceCode, targetCode);

  console.log(`origen   ${plan.source.code}  "${plan.source.name}"  active=${plan.source.active}`);
  console.log(`         id=${plan.source.id}`);
  console.log(`destino  ${plan.target.code}  "${plan.target.name}"  active=${plan.target.active}`);
  console.log(`         id=${plan.target.id}`);
  console.log("\nRelaciones de la unidad origen:");
  line("equipos", plan.relations.equipment);
  line("con etiqueta", plan.relations.labelled);
  line("grupos de inventario", plan.relations.groups);
  line("solicitudes", plan.relations.requests);
  line("historial (se conserva)", plan.relations.history);
  line("movimientos origen", plan.relations.movementsAsSource);
  line("movimientos destino", plan.relations.movementsAsTarget);
  line("propietario en otras", plan.relations.ownersElsewhere);
  line("copias desde otras", plan.copiesFromElsewhere);
  line("owner = origen", plan.ownersPointingAtSource);
  line("colisiones asset", plan.assetCodeCollisions.length);

  const beforeSource = plan.relations.equipment;
  const beforeTarget = await countEquipment(db, plan.target.id);

  console.log(
    `\nSe moveran ${plan.equipmentIds.length} equipo(s) con un unico UPDATE de restaurant_id.`
  );
  console.log(
    "No se recrea ningun equipo: se conservan id, asset_code, serie, token y trazabilidad."
  );
  console.log("La unidad origen quedara con active = 0: retirada, no borrada.");

  if (!apply) {
    console.log("\nSin cambios. Anade --apply para escribir.");
    return;
  }

  if (plan.assetCodeCollisions.length > 0) {
    throw new Error("ABORTADO: hay colisiones de asset_code con el destino.");
  }

  const result = await consolidateUnit(db, sourceCode, targetCode, {
    deactivateSource: true,
  });

  const afterSource = await countEquipment(db, plan.source.id);
  const afterTarget = await countEquipment(db, plan.target.id);
  const [sourceRow] = await db
    .select({ active: restaurants.active })
    .from(restaurants)
    .where(eq(restaurants.id, plan.source.id))
    .limit(1);

  console.log("\n" + "-".repeat(66));
  line("movidos", result.movedEquipment);
  line("origen antes", beforeSource);
  line("origen despues", afterSource);
  line("destino antes", beforeTarget);
  line("destino despues", afterTarget);
  line("origen activa", sourceRow?.active ?? "?");

  const gained = afterTarget - beforeTarget;
  const ok = afterSource === 0 && gained === result.movedEquipment && sourceRow?.active === false;
  console.log(
    ok
      ? "\nOK: origen vacia y retirada; el destino recibio exactamente los equipos movidos."
      : "\nREVISAR: el estado final no es el esperado."
  );
  if (!ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nERROR:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.close());

