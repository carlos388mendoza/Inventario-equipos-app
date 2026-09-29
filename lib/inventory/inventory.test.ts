import { describe, expect, it } from "vitest";
import { INVENTORY_FORMAT, INVENTORY_FORMAT_LABELS } from "../db/enums";

/**
 * Estos datos son un recorte de los documentos reales ya importados. Reproducen
 * a propósito los dos casos que rompían los algoritmos naives:
 *  - un código corto repetido en el original (MINI3, GUARA),
 *  - un SERIAL repetido por esa misma duplicación del documento,
 *  - y el caso de que un valor monetario sea el total de la línea y no el
 *    precio unitario.
 */

const PH01_ROWS = [
  { shortCode: "MINI3", serial: "PH0120230922MINI3", model: "MINIPC CAUNTER" },
  { shortCode: "MINI3", serial: "PH0120230922MINI3", model: "MINIPC DES_CLIENTES" },
  { shortCode: "GUARA", serial: "PH0120230922GUARA", model: "GUARDA MONEDAS DOMICILIO" },
  { shortCode: "GUARA", serial: "PH0120230922GUARA", model: "GUARDA MONEDAS AUTO SERVICIO" },
  { shortCode: "TABO1", serial: "PH0120230922TABO1", model: "TABLET SAMSUNG" },
];

const DNS19_ROWS = [
  { name: "TOMA PEDIDO ELO AIO", quantity: 3, value: "20,500.00" },
  { name: "IMPRESORA EPSON POS", quantity: 3, value: "7,850.00" },
  { name: "UPS APC 3000 110", quantity: 1, value: "26,929.55" },
  { name: "MAQUINA COMPLETA GERENTE", quantity: 1, value: "7,000.00" },
  { name: "MINI PC", quantity: 6, value: "8,517.00" },
  { name: "FORTI COMPLETO", quantity: 1, value: "46,335.23" },
  { name: "RED DE DATOS", quantity: 1, value: "79,392.39" },
];

const DNS19_TOTAL = "196,524.17";

/** Misma regla que `scripts/import-inventory.ts`. */
function parseMoneyToCents(value: string): number {
  const normalized = value.replace(/[^0-9.-]/g, "");
  const [whole = "0", decimals = ""] = normalized.split(".");
  return (
    Number.parseInt(whole, 10) * 100 +
    Number.parseInt(decimals.padEnd(2, "0").slice(0, 2), 10)
  );
}

describe("formato de inventario", () => {
  it("mantiene separados los dos formatos", () => {
    expect(INVENTORY_FORMAT.PER_ASSET).toBe("PER_ASSET");
    expect(INVENTORY_FORMAT.AGGREGATE).toBe("AGGREGATE");
    expect(INVENTORY_FORMAT.PER_ASSET).not.toBe(INVENTORY_FORMAT.AGGREGATE);
  });

  it("expone una etiqueta en español para cada formato", () => {
    expect(INVENTORY_FORMAT_LABELS[INVENTORY_FORMAT.PER_ASSET]).toBe("Por equipo");
    expect(INVENTORY_FORMAT_LABELS[INVENTORY_FORMAT.AGGREGATE]).toBe(
      "Agregado por rubro"
    );
  });
});

describe("códigos repetidos del documento PH01", () => {
  it("confirma que el SERIAL no es único y por eso no puede ser la clave", () => {
    const serials = PH01_ROWS.map((r) => r.serial);
    const unique = new Set(serials);
    expect(unique.size).toBeLessThan(serials.length);
  });

  it("conserva los códigos cortos tal cual, sin deduplicar ni corregir", () => {
    const counts = new Map<string, number>();
    for (const row of PH01_ROWS) {
      counts.set(row.shortCode, (counts.get(row.shortCode) ?? 0) + 1);
    }
    // MINI3 y GUARA aparecen dos veces: es un dato del original, no un error.
    expect(counts.get("MINI3")).toBe(2);
    expect(counts.get("GUARA")).toBe(2);
    expect(counts.get("TABO1")).toBe(1);
  });

  it("distingue las filas duplicadas por su descripción larga", () => {
    const models = new Set(PH01_ROWS.map((r) => r.model));
    expect(models.size).toBe(PH01_ROWS.length);
  });
});

describe("valores del documento DNS19", () => {
  it("convierte a centavos sin arrastrar error de coma flotante", () => {
    expect(parseMoneyToCents("20,500.00")).toBe(2_050_000);
    expect(parseMoneyToCents("26,929.55")).toBe(2_692_955);
    expect(parseMoneyToCents("7,000.00")).toBe(700_000);
  });

  it("trata VALOR como total de línea: las líneas suman el TOTAL del documento", () => {
    const sum = DNS19_ROWS.reduce((acc, r) => acc + parseMoneyToCents(r.value), 0);
    expect(sum).toBe(parseMoneyToCents(DNS19_TOTAL));
    expect(sum).toBe(19_652_417);
  });

  it("descarta la lectura de VALOR como precio unitario", () => {
    // Multiplicar por la cantidad inflaría el inventario; la lectura correcta
    // no multiplica y por eso el total cuadra con el documento.
    const asUnit = DNS19_ROWS.reduce(
      (acc, r) => acc + parseMoneyToCents(r.value) * r.quantity,
      0
    );
    expect(asUnit).not.toBe(parseMoneyToCents(DNS19_TOTAL));
    expect(asUnit).toBeGreaterThan(parseMoneyToCents(DNS19_TOTAL));
  });

  it("conserva la cantidad declarada en el documento", () => {
    expect(DNS19_ROWS.reduce((acc, r) => acc + r.quantity, 0)).toBe(16);
  });
});
