/**
 * Diagnóstico (SOLO LECTURA): equipos cuya relación está rota.
 *
 * Motivación: el issue #34 reporta que la generación de etiquetas "solo funciona
 * con algunos equipos de pizza hut". `generateSecurityLabel` resuelve el equipo
 * con JOIN exteriores y falla si le falta el tipo o el restaurante; este script
 * hace esa MISMA lectura sobre todo el inventario y lista los equipos que
 * fallarían, para poder corregir los datos antes de decidir nada.
 *
 * No escribe: son solo `SELECT`. No arregla nada por sí mismo.
 *
 *   npx.cmd tsx --env-file=.env.local scripts/check-label-relations.ts
 *
 * Reutiliza `lib/labels/relation-audit.ts`, que es la lógica que cubren los
 * tests; el script solo consulta e imprime.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import {
  findEquipmentInInactiveUnits,
  findEquipmentRelationProblems,
  listEquipmentRelations,
} from "../lib/labels/relation-audit";
import { describeIncompleteLabel } from "../lib/labels/label-generation";

const tursoUrl = process.env.TURSO_DATABASE_URL;
if (!tursoUrl) {
  console.error(
    "Falta TURSO_DATABASE_URL. Ejecuta con: npx.cmd tsx --env-file=.env.local scripts/check-label-relations.ts"
  );
  process.exit(1);
}

const client = createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client);

async function main() {
  const rows = await listEquipmentRelations(db);

  const problems = findEquipmentRelationProblems(rows);
  const inactive = findEquipmentInInactiveUnits(rows);

  console.log("=".repeat(66));
  console.log("ETIQUETAS: relaciones de equipo   (solo lectura, no se escribe)");
  console.log("=".repeat(66));
  console.log(`Equipos totales:            ${rows.length}`);
  console.log(`Con relacion rota:          ${problems.length}`);
  console.log(`En unidades retiradas:      ${inactive.length}`);

  if (problems.length > 0) {
    console.log("\nEquipos SIN tipo o SIN restaurante (la etiqueta fallaria):");
    for (const p of problems) {
      console.log(`  - ${p.assetCode}  (id=${p.id})`);
      console.log(`      ${describeIncompleteLabel(p.assetCode, p.issues)}`);
    }
  }

  if (inactive.length > 0) {
    console.log(
      "\nEquipos en unidades retiradas (active = 0): no aparecen en el selector."
    );
    for (const e of inactive) {
      console.log(`  - ${e.assetCode}  ->  ${e.restaurantName}`);
    }
  }

  if (problems.length === 0 && inactive.length === 0) {
    console.log("\nOK: todos los equipos tienen tipo y restaurante activos.");
    return;
  }

  console.log(
    "\nREVISAR: corrige estas relaciones antes de generar etiquetas para esos equipos."
  );
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nERROR:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
