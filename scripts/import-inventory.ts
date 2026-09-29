/**
 * Importador de inventario real (INVENTARIO PH01.xlsx y DENNYS 19 - DNS19.xlsx).
 *
 * Reglas de seguridad que este script NO puedeSaltar:
 *  - No borra nada. Nunca emite DELETE ni TRUNCATE.
 *  - Es idempotente: se puede correr N veces sin duplicar filas.
 *  - Conserva los valores del documento VERBATIM. No normaliza, no "corrige"
 *    ni dedupica los códigos cortos repetidos del original.
 *  - No inventa datos. Si un campo no viene en el documento, queda NULL.
 *
 * Uso:
 *   npx tsx scripts/import-inventory.ts --dry-run   # simula, no escribe
 *   npx tsx scripts/import-inventory.ts             # aplica
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Datos del documento INVENTARIO PH01.xlsx ────────────────────────────────
// Transcritos literalmente. Orden de columnas del documento:
// UNIDAD | TECNICO_APERTURA | FECHA | DESCRIPCION LARGA | DESCRIPCION | CODIGOQR | SERIAL
type Ph01Row = {
  /** DESCRIPCION LARGA */
  model: string;
  /** DESCRIPCION: código corto, REPETIDO en el original. No es clave. */
  shortCode: string;
  /** CODIGOQR: único por fila, es el único identificador de negocio único. */
  qrCode: string;
  /** SERIAL: único salvo por las filas duplicadas del original. */
  serial: string;
  /** Categoría del catálogo de tipos de equipo. */
  typeName: string;
};

const PH01_UNIT = "PH01";
const PH01_TECHNICIAN = "HERMES PINEDA";
const PH01_DATE = "2023-09-22";
const PH01_DOCUMENT = "INVENTARIO PH01.xlsx";

const PH01_ROWS: Ph01Row[] = [
  { model: "MAQUINA DEL GERENTE LENOVO 8RAM 120SSD", shortCode: "PGGGG", qrCode: "PH01-20230922-MAQUINA DEL GERENTE LENOVO 8RAM 120SSDENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PGGGG", typeName: "PC" },
  { model: "TOMA PEDIDOS VARIPOS 750 4RAM 500HD CAJA 1", shortCode: "TOMA1", qrCode: "PH01-20230922-TOMA PEDIDOS VARIPOS 750 4RAM 500HD CAJA 1ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922TOMA1", typeName: "Tomapedidos" },
  { model: "TOMA PEDIDOS VARIPOS 750 4RAM 500HD CAJA 2", shortCode: "TOMA2", qrCode: "PH01-20230922-TOMA PEDIDOS VARIPOS 750 4RAM 500HD CAJA 2ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922TOMA2", typeName: "Tomapedidos" },
  { model: "EPSON TMM30 DOMINICIO", shortCode: "PRIN1", qrCode: "PH01-20230922-EPSON TMM30 DOMINICIOENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PRIN1", typeName: "Impresora Epson" },
  { model: "EPSON TMM30 CAJA 1", shortCode: "PRIN2", qrCode: "PH01-20230922-EPSON TMM30 CAJA 1ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PRIN2", typeName: "Impresora Epson" },
  { model: "EPSON TMM30 CAJA 2", shortCode: "PRIN3", qrCode: "PH01-20230922-EPSON TMM30 CAJA 2ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PRIN3", typeName: "Impresora Epson" },
  { model: "EPSON TMM30 CAJA AUTO SERVICIO", shortCode: "PRIN4", qrCode: "PH01-20230922-EPSON TMM30 CAJA AUTO SERVICIOENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PRIN4", typeName: "Impresora Epson" },
  { model: "MAQUINA LEARNNING LENOVO 8RAM 120SSD", shortCode: "PLLLL", qrCode: "PH01-20230922-MAQUINA LEARNNING LENOVO 8RAM 120SSDENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PLLLL", typeName: "PC" },
  { model: "MAQUINA DOMICILIO LENOVO 8RAM 120SSD", shortCode: "PAAAA", qrCode: "PH01-20230922-MAQUINA DOMICILIO LENOVO 8RAM 120SSDENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PAAAA", typeName: "PC" },
  { model: "TOMA PEDIDOS VARIPOS 750 4RAM 500HD AUTO SERVICIO", shortCode: "TOMA3", qrCode: "PH01-20230922-TOMA PEDIDOS VARIPOS 750 4RAM 500HD AUTO SERVICIOENTREGADOS A -HERMES PINEDA", serial: "PH0120230922TOMA3", typeName: "Tomapedidos" },
  { model: "SWITCH 24 PUERTOS TP-LINK", shortCode: "SWIT1", qrCode: "PH01-20230922-SWITCH 24 PUERTOS TP-LINKENTREGADOS A -HERMES PINEDA", serial: "PH0120230922SWIT1", typeName: "Switch de red" },
  { model: "SWITCH 24 PUERTOS TP-LINK", shortCode: "SWIT2", qrCode: "PH01-20230922-SWITCH 24 PUERTOS TP-LINKENTREGADOS A -HERMES PINEDA", serial: "PH0120230922SWIT2", typeName: "Switch de red" },
  { model: "FORTI 40F", shortCode: "FORTI", qrCode: "PH01-20230922-FORTI 40FENTREGADOS A -HERMES PINEDA", serial: "PH0120230922FORTI", typeName: "Firewall Fortinet" },
  { model: "FORTI AP 21E", shortCode: "FORAP", qrCode: "PH01-20230922-FORTI AP 21EENTREGADOS A -HERMES PINEDA", serial: "PH0120230922FORAP", typeName: "Access point Fortinet" },
  { model: "UPS APC 110V", shortCode: "UP110", qrCode: "PH01-20230922-UPS APC 110VENTREGADOS A -HERMES PINEDA", serial: "PH0120230922UP110", typeName: "UPS" },
  { model: "IMPRESORA OFICINA HP107W", shortCode: "PRING", qrCode: "PH01-20230922-IMPRESORA OFICINA HP107WENTREGADOS A -HERMES PINEDA", serial: "PH0120230922PRING", typeName: "Impresora de oficina" },
  { model: "GABINETE 9U", shortCode: "GABI1", qrCode: "PH01-20230922-GABINETE 9UENTREGADOS A -HERMES PINEDA", serial: "PH0120230922GABI1", typeName: "Gabinete de rack" },
  { model: "MONITOR LEARNNING DELL 20", shortCode: "MONI1", qrCode: "PH01-20230922-MONITOR LEARNNING DELL 20ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MONI1", typeName: "Monitor" },
  { model: "MONITOR DE GERENTE DELL 20", shortCode: "MONI2", qrCode: "PH01-20230922-MONITOR DE GERENTE DELL 20ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MONI2", typeName: "Monitor" },
  { model: "MONITOR DOMICILIO DELL 20", shortCode: "MONI3", qrCode: "PH01-20230922-MONITOR DOMICILIO DELL 20ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MONI3", typeName: "Monitor" },
  { model: "MINIPC BEELINK - 8RAM 256 SSD - AUTO 1", shortCode: "MINI1", qrCode: "PH01-20230922-MINIPC BEELINK - 8RAM 256 SSD - AUTO 1ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MINI1", typeName: "Mini-PC" },
  { model: "MINIPC BEELINK - 8RAM 256 SSD - AUTO 2", shortCode: "MINI2", qrCode: "PH01-20230922-MINIPC BEELINK - 8RAM 256 SSD - AUTO 2ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MINI2", typeName: "Mini-PC" },
  { model: "MINIPC BEELINK - 8RAM 256 SSD - CAUNTER", shortCode: "MINI3", qrCode: "PH01-20230922-MINIPC BEELINK - 8RAM 256 SSD - CAUNTERENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MINI3", typeName: "Mini-PC" },
  { model: "MINIPC BEELINK - 8RAM 256 SSD -SANDWICH", shortCode: "MINI4", qrCode: "PH01-20230922-MINIPC BEELINK - 8RAM 256 SSD -SANDWICHENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MINI4", typeName: "Mini-PC" },
  { model: "MINIPC BEELINK - 8RAM 256 SSD - DES_CLIENTES", shortCode: "MINI3", qrCode: "PH01-20230922-MINIPC BEELINK - 8RAM 256 SSD - DES_CLIENTESENTREGADOS A -HERMES PINEDA", serial: "PH0120230922MINI3", typeName: "Mini-PC" },
  { model: "GUARDA MONEDAS STAR DOMICILIO", shortCode: "GUARA", qrCode: "PH01-20230922-GUARDA MONEDAS STAR DOMICILIOENTREGADOS A -HERMES PINEDA", serial: "PH0120230922GUARA", typeName: "Guarda monedas" },
  { model: "GUARDA MONEDAS STAR CAJA 1", shortCode: "GUAR1", qrCode: "PH01-20230922-GUARDA MONEDAS STAR CAJA 1 ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922GUAR1", typeName: "Guarda monedas" },
  { model: "GUARDA MONEDAS STAR CAJA 2", shortCode: "GUAR2", qrCode: "PH01-20230922-GUARDA MONEDAS STAR CAJA 2ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922GUAR2", typeName: "Guarda monedas" },
  { model: "GUARDA MONEDAS STAR AUTO SERVICIO", shortCode: "GUARA", qrCode: "PH01-20230922-GUARDA MONEDAS STAR AUTO SERVICIOENTREGADOS A -HERMES PINEDA", serial: "PH0120230922GUARA", typeName: "Guarda monedas" },
  { model: "TABLET SAMSUNG A7-32GB - RUTINAS DIGITALES 1", shortCode: "TABO1", qrCode: "PH01-20230922-TABLET SAMSUNG A7-32GB - RUTINAS DIGITALES 1ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922TABO1", typeName: "Tableta" },
  { model: "TABLET SAMSUNG A7-32GB - RUTINAS DIGITALES 2", shortCode: "TABO2", qrCode: "PH01-20230922-TABLET SAMSUNG A7-32GB - RUTINAS DIGITALES 2ENTREGADOS A -HERMES PINEDA", serial: "PH0120230922TABO2", typeName: "Tableta" },
];

// ─── Datos del documento DENNYS 19 - EQUIPO SISTEMAS (DNS19.xlsx) ─────────────
// Formato AGREGADO: una fila por rubro, no por equipo. `value` es el VALOR de la
// LÍNEA tal como viene en el documento (la suma de las 7 líneas da exactamente
// el TOTAL 196,524.17). NO es el valor unitario.
type Dns19Row = { name: string; quantity: number; value: string };

const DNS19_DOCUMENT = "DNS19.xlsx";
const DNS19_CURRENCY = "L";
const DNS19_TOTAL = "196,524.17";

const DNS19_ROWS: Dns19Row[] = [
  { name: "TOMA PEDIDO ELO AIO", quantity: 3, value: "20,500.00" },
  { name: "IMPRESORA EPSON POS", quantity: 3, value: "7,850.00" },
  { name: "UPS APC 3000 110", quantity: 1, value: "26,929.55" },
  { name: "MAQUINA COMPLETA GERENTE", quantity: 1, value: "7,000.00" },
  { name: "MINI PC", quantity: 6, value: "8,517.00" },
  { name: "FORTI COMPLETO", quantity: 1, value: "46,335.23" },
  { name: "RED DE DATOS", quantity: 1, value: "79,392.39" },
];

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Convierte "20,500.00" a centavos enteros (2_050_000). Sin coma flotante. */
function parseMoneyToCents(value: string): number {
  const normalized = value.replace(/[^0-9.-]/g, "");
  const negative = normalized.startsWith("-");
  const [whole = "0", decimals = ""] = normalized.replace("-", "").split(".");
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(decimals.padEnd(2, "0").slice(0, 2), 10);
  if (Number.isNaN(cents)) throw new Error(`Valor monetario inválido: ${value}`);
  return negative ? -cents : cents;
}

/** Solo acepta YYYY-MM-DD. Cualquier otra notación (incl. 2E+07) se conserva solo como texto. */
function parseIsoDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const ts = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const date = new Date(ts);
  // Rechaza fechas imposibles como 2023-02-30 que Date.UTC normalizaría.
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) {
    return null;
  }
  return ts;
}

function formatMoney(cents: number): string {
  return `L ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function findId(table: string, column: string, value: string): Promise<string | null> {
  const res = await client.execute({
    sql: `SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`,
    args: [value],
  });
  return res.rows.length > 0 ? String(res.rows[0].id) : null;
}

const log = (msg: string) => console.log(msg);

/**
 * Vida útil de 36 meses: es el valor por defecto del catálogo del proyecto
 * (`equipment_types.useful_life_months` y el formulario de tipos), NO un dato
 * del documento. Queda anotado en la descripción para que IT lo confirme.
 */
const TYPE_LIFE_PLACEHOLDER_DESCRIPTION =
  "Vida útil provisional (36 meses por defecto del catálogo). El documento de inventario no la especifica; ajustar desde el CRUD de tipos.";

// ─── Importación ─────────────────────────────────────────────────────────────

async function importPh01(): Promise<void> {
  log("\n=== INVENTARIO PH01.xlsx (formato POR EQUIPO) ===");

  // ── PH01 ya no existe: se consolidó en PZ01 y la fila se borró. ────────────
  // Este importador es una operación HISTÓRICA de una sola vez. Ya se aplicó y
  // sus 31 equipos viven en PZ01, así que reejecutarlo solo duplicaría filas.
  // Por eso esta función NO vuelve a crear la unidad: antes insertaba la fila en
  // `restaurants` cuando no la encontraba, y eso la dejaba a un paso de
  // resucitar PH01. Esa rama ya no existe. Restaurar una unidad retirada es una
  // decisión de una persona, y se toma a mano y queda escrita.
  const restaurantId = await findId("restaurants", "code", PH01_UNIT);
  const pz01 = await findId("restaurants", "code", "PZ01");
  const yaImportados = await client.execute({
    sql: `SELECT count(*) n FROM equipment WHERE source_document = ?`,
    args: [PH01_DOCUMENT],
  });

  if (!restaurantId) {
    log(`  x ${PH01_UNIT} no existe y no se va a recrear.`);
    if (pz01) {
      log(
        `    "${PH01_DOCUMENT}" tiene ${yaImportados.rows[0].n} equipo(s) ya consolidados en PZ01.`
      );
    }
    log("    Este documento es de una sola vez y ya se aplicó.");
    log("    Para restaurar PH01 habría que hacerlo a mano y dejar constancia del porqué.");
    return;
  }

  // Si la unidad existe pero está RETIRADA, tampoco se toca: reactivarla
  // automáticamente escondería una decisión que debe tomar una persona.
  {
    const state = await client.execute({
      sql: `SELECT active FROM restaurants WHERE id = ?`,
      args: [restaurantId],
    });
    if (state.rows[0] && Number(state.rows[0].active) !== 1) {
      log(
        `  x restaurante ${PH01_UNIT} está RETIRADO (active = 0). No se importa nada.`
      );
      return;
    }
  }

  // La fila existe y está activa: se llegó aquí porque alguien la restauró a
  // mano. Se avisa, pero no se bloquea, porque en ese caso importar el documento
  // es justo lo que esa persona pidió al restaurar la unidad.
  log(`  = restaurante ${PH01_UNIT} existe y está ACTIVA (restaurado a mano)`);

  // Tipos de equipo: se crean solo los que el catálogo no tiene y el documento sí exige.
  const neededTypes = [...new Set(PH01_ROWS.map((r) => r.typeName))];
  const typeIdByName = new Map<string, string>();
  for (const name of neededTypes) {
    const existing = await findId("equipment_types", "name", name);
    if (existing) {
      typeIdByName.set(name, existing);
      continue;
    }
    const id = randomUUID();
    typeIdByName.set(name, id);
    if (!DRY_RUN) {
      // useful_life_months es NOT NULL y no viene en los documentos de inventario.
      // Se usa el default del catálogo del proyecto (36) y se deja la nota
      // visible en la descripción para que IT lo ajuste por el CRUD de tipos.
      await client.execute({
        sql: `INSERT INTO equipment_types (id, name, description, useful_life_months, active, "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, 1, ?, ?)`,
        args: [id, name, TYPE_LIFE_PLACEHOLDER_DESCRIPTION, 36, Date.now(), Date.now()],
      });
    }
    log(`  + tipo de equipo "${name}"`);
  }

  // Resuelve un asset_code único por fila.
  //
  // El SERIAL del documento se REPETE en las filas duplicadas del original
  // (MINI3 y GUARA), y además los 15 equipos demo que ya existían ocupan
  // códigos del rango PH-*. En ambos casos el documento aporta CODIGOQR, que
  // sí es único, así que se usa ese valor en vez de inventar un sufijo.
  // El SERIAL original nunca se pierde: se guarda en `serial_number`, y el
  // CODIGOQR en `source_qr_code`.
  //
  // Un asset_code que ya pertenece a otra fila de ESTE MISMO documento es la
  // misma fila (idempotencia: se actualiza, no se re-clavea).
  const myExisting = new Set(
    (
      await client.execute({
        sql: `SELECT asset_code FROM equipment WHERE source_document = ?`,
        args: [PH01_DOCUMENT],
      })
    ).rows.map((r) => String(r.asset_code)),
  );
  const foreignCodes = new Set(
    (
      await client.execute({
        sql: `SELECT asset_code FROM equipment WHERE source_document IS NULL OR source_document <> ?`,
        args: [PH01_DOCUMENT],
      })
    ).rows.map((r) => String(r.asset_code)),
  );

  const usedCodes = new Set<string>();
  let created = 0;
  let updated = 0;
  let rekeyed = 0;

  const installationDate = parseIsoDate(PH01_DATE);

  for (const row of PH01_ROWS) {
    let assetCode = row.serial;
    const collides = usedCodes.has(assetCode) || (foreignCodes.has(assetCode) && !myExisting.has(assetCode));
    if (collides) {
      assetCode = row.qrCode;
      rekeyed++;
    }
    usedCodes.add(assetCode);

    const typeId = typeIdByName.get(row.typeName)!;
    const existingId = await findId("equipment", "asset_code", assetCode);
    const now = Date.now();

    if (existingId) {
      // Solo se refrescan las columnas de origen; jamás se tocan estado,
      // tipo, restaurante, notas ni el historial del equipo ya operativo.
      if (!DRY_RUN) {
        await client.execute({
          sql: `UPDATE equipment SET
                  source_document = ?, source_short_code = ?, source_description = ?,
                  source_qr_code = ?, source_technician = ?, source_date_text = ?,
                  "updatedAt" = ?
                WHERE id = ?`,
          args: [PH01_DOCUMENT, row.shortCode, row.model, row.qrCode, PH01_TECHNICIAN, PH01_DATE, now, existingId],
        });
      }
      updated++;
      continue;
    }

    if (!DRY_RUN) {
      await client.execute({
        sql: `INSERT INTO equipment
              (id, asset_code, serial_number, equipment_type_id, restaurant_id, brand, model,
               purchase_date, installation_date, status, notes,
               source_document, source_short_code, source_description, source_qr_code,
               source_technician, source_date_text, "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'ACTIVE', NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          randomUUID(), assetCode, row.serial, typeId, restaurantId, "Pizza Hut", row.model,
          installationDate,
          PH01_DOCUMENT, row.shortCode, row.model, row.qrCode, PH01_TECHNICIAN, PH01_DATE,
          now, now,
        ],
      });
    }
    created++;
  }

  log(`  ${created} equipos creados, ${updated} actualizados`);
  if (rekeyed > 0) {
    log(`  ! ${rekeyed} filas usan CODIGOQR como asset_code porque su SERIAL se repite en el documento original (no se corrigió el dato)`);
  }
  const dupes = new Map<string, number>();
  for (const r of PH01_ROWS) dupes.set(r.shortCode, (dupes.get(r.shortCode) ?? 0) + 1);
  const repeated = [...dupes.entries()].filter(([, n]) => n > 1);
  for (const [code, n] of repeated) {
    log(`  · código corto "${code}" aparece ${n}× en el documento: conservado tal cual, no es clave única`);
  }
}

async function importDns19(): Promise<void> {
  log("\n=== DENNYS 19 - DNS19.xlsx (formato AGREGADO) ===");

  // El documento se titula "DENNYS 19" y no indica el código de unidad.
  // Se importa sobre la unidad Denny's existente y queda documentado aquí.
  const restaurantId = await findId("restaurants", "code", "DN03");
  if (!restaurantId) {
    log("  ! no se encontró la unidad Denny's (DN03): se omite DNS19");
    return;
  }
  log(`  unidad destino: DN03 (Denny's)`);
  log(`  NOTA: el título del documento dice "DENNYS 19"; verificar con el responsable`);
  log(`        que corresponde a esta unidad y no a otra antes de darlo por definitivo.`);

  // Verificación: la suma de las líneas debe cuadrar con el TOTAL del documento.
  const sumCents = DNS19_ROWS.reduce((acc, r) => acc + parseMoneyToCents(r.value), 0);
  const totalCents = parseMoneyToCents(DNS19_TOTAL);
  if (sumCents !== totalCents) {
    throw new Error(
      `Las líneas de DNS19 suman ${formatMoney(sumCents)} pero el TOTAL del documento es ${formatMoney(totalCents)}. ` +
        `No se importa nada para evitar datos incorrectos.`,
    );
  }
  log(`  ✓ ${DNS19_ROWS.length} rubros suman ${formatMoney(sumCents)}, cuadra con el TOTAL`);

  let created = 0;
  let updated = 0;
  const now = Date.now();

  for (const row of DNS19_ROWS) {
    const cents = parseMoneyToCents(row.value);
    const existingId = await findId("equipment_groups", "name", row.name);
    if (existingId) {
      if (!DRY_RUN) {
        await client.execute({
          sql: `UPDATE equipment_groups SET quantity = ?, total_value = ?, currency = ?,
                  source_document = ?, source_format = 'AGGREGATE', "updatedAt" = ?
                WHERE id = ? AND restaurant_id = ?`,
          args: [row.quantity, cents, DNS19_CURRENCY, DNS19_DOCUMENT, now, existingId, restaurantId],
        });
      }
      updated++;
      continue;
    }
    if (!DRY_RUN) {
      await client.execute({
        sql: `INSERT INTO equipment_groups
              (id, restaurant_id, source_format, name, quantity, total_value, currency,
               source_line_code, source_document, notes, "createdAt", "updatedAt")
              VALUES (?, ?, 'AGGREGATE', ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        args: [randomUUID(), restaurantId, row.name, row.quantity, cents, DNS19_CURRENCY, DNS19_DOCUMENT, null, now, now],
      });
    }
    created++;
  }
  log(`  ${created} rubros creados, ${updated} actualizados`);
}

async function main(): Promise<void> {
  log(DRY_RUN ? "MODO DRY-RUN: no se escribirá nada" : "MODO APLICAR: escribiendo en la base de datos");
  await importPh01();
  await importDns19();
  log("\nImportación finalizada. No se eliminó ningún registro previo.");
  client.close();
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? err.message : err);
  client.close();
  process.exit(1);
});
