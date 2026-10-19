import { describe, expect, it } from "vitest";

import {
  formatRangeLabel,
  isRangeEmpty,
  isWithinRange,
  normalizeRange,
  rangeBounds,
} from "@/lib/date-range";
import { formatDate } from "@/lib/utils";

/** Fecha local, para no depender de la zona horaria del entorno. */
const day = (year: number, month: number, date: number) =>
  new Date(year, month - 1, date);

describe("rangeBounds", () => {
  it("1. sin fechas no acota el filtro", () => {
    expect(rangeBounds({})).toEqual({ from: null, to: null });
  });

  it("2. solo fecha inicial: acota desde el inicio de ese día", () => {
    const bounds = rangeBounds({ from: day(2026, 3, 10) });
    expect(bounds.from).toBe(new Date(2026, 2, 10, 0, 0, 0, 0).getTime());
    expect(bounds.to).toBeNull();
  });

  it("3. solo fecha final: acota hasta el fin de ese día", () => {
    const bounds = rangeBounds({ to: day(2026, 3, 20) });
    expect(bounds.from).toBeNull();
    expect(bounds.to).toBe(new Date(2026, 2, 20, 23, 59, 59, 999).getTime());
  });

  it("4. intervalo completo cubre el día inicial y el final enteros", () => {
    const bounds = rangeBounds({ from: day(2026, 3, 10), to: day(2026, 3, 20) });
    expect(bounds.from).toBe(new Date(2026, 2, 10, 0, 0, 0, 0).getTime());
    expect(bounds.to).toBe(new Date(2026, 2, 20, 23, 59, 59, 999).getTime());
  });

  it("6. un intervalo invertido se corrige intercambiando los extremos", () => {
    const inverted = { from: day(2026, 3, 20), to: day(2026, 3, 10) };
    const bounds = rangeBounds(inverted);
    expect(bounds.from).toBe(new Date(2026, 2, 10, 0, 0, 0, 0).getTime());
    expect(bounds.to).toBe(new Date(2026, 2, 20, 23, 59, 59, 999).getTime());
    expect(normalizeRange(inverted)).toEqual({
      from: day(2026, 3, 10),
      to: day(2026, 3, 20),
    });
  });
});

describe("isWithinRange", () => {
  const range = { from: day(2026, 3, 10), to: day(2026, 3, 20) };

  it("5. incluye el primer milisegundo del día inicial", () => {
    expect(isWithinRange(new Date(2026, 2, 10, 0, 0, 0, 0).getTime(), range)).toBe(
      true
    );
  });

  it("5. incluye el último milisegundo del día final", () => {
    expect(
      isWithinRange(new Date(2026, 2, 20, 23, 59, 59, 999).getTime(), range)
    ).toBe(true);
  });

  it("excluye justo antes y justo después del intervalo", () => {
    expect(
      isWithinRange(new Date(2026, 2, 9, 23, 59, 59, 999).getTime(), range)
    ).toBe(false);
    expect(
      isWithinRange(new Date(2026, 2, 21, 0, 0, 0, 0).getTime(), range)
    ).toBe(false);
  });

  it("un rango vacío no filtra nada", () => {
    expect(isWithinRange(Date.now(), {})).toBe(true);
  });
});

describe("isRangeEmpty", () => {
  it("7. limpiar deja el rango vacío", () => {
    expect(isRangeEmpty({})).toBe(true);
    expect(isRangeEmpty({ from: day(2026, 3, 10) })).toBe(false);
    expect(isRangeEmpty({ to: day(2026, 3, 20) })).toBe(false);
    expect(isRangeEmpty({ from: day(2026, 3, 10), to: day(2026, 3, 20) })).toBe(
      false
    );
  });
});

describe("formatRangeLabel", () => {
  it("9. sin fechas devuelve null (el botón usa el placeholder)", () => {
    expect(formatRangeLabel({})).toBeNull();
  });

  it("9. formatea el intervalo completo con separador", () => {
    expect(
      formatRangeLabel({ from: day(2026, 3, 10), to: day(2026, 3, 20) })
    ).toBe(`${formatDate(day(2026, 3, 10))} – ${formatDate(day(2026, 3, 20))}`);
  });

  it("9. formatea intervalos abiertos con prefijo", () => {
    expect(formatRangeLabel({ from: day(2026, 3, 10) })).toBe(
      `Desde ${formatDate(day(2026, 3, 10))}`
    );
    expect(formatRangeLabel({ to: day(2026, 3, 20) })).toBe(
      `Hasta ${formatDate(day(2026, 3, 20))}`
    );
  });
});
