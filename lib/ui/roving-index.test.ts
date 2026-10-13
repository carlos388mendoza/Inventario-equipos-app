import { describe, expect, it } from "vitest";

import { moveActiveIndex, resolveActiveIndex } from "@/lib/ui/roving-index";

/**
 * Robustez del índice activo de las listas con teclado (paleta de comandos y
 * selector múltiple). Se prueba la lógica pura, sin DOM.
 */
describe("resolveActiveIndex", () => {
  it("devuelve -1 cuando la lista está vacía", () => {
    expect(resolveActiveIndex(0, 0)).toBe(-1);
    expect(resolveActiveIndex(5, 0)).toBe(-1);
  });

  it("recorta un índice mayor que la lista al último elemento", () => {
    expect(resolveActiveIndex(9, 3)).toBe(2);
  });

  it("normaliza negativos y no finitos a 0", () => {
    expect(resolveActiveIndex(-4, 3)).toBe(0);
    expect(resolveActiveIndex(Number.NaN, 3)).toBe(0);
    expect(resolveActiveIndex(Number.POSITIVE_INFINITY, 3)).toBe(0);
  });

  it("deja pasar índices válidos sin cambios", () => {
    expect(resolveActiveIndex(0, 3)).toBe(0);
    expect(resolveActiveIndex(2, 3)).toBe(2);
  });
});

describe("moveActiveIndex", () => {
  it("devuelve -1 cuando la lista está vacía", () => {
    expect(moveActiveIndex(0, 0, 1)).toBe(-1);
  });

  it("avanza con envoltura circular", () => {
    expect(moveActiveIndex(0, 3, 1)).toBe(1);
    expect(moveActiveIndex(2, 3, 1)).toBe(0);
  });

  it("retrocede con envoltura circular", () => {
    expect(moveActiveIndex(0, 3, -1)).toBe(2);
    expect(moveActiveIndex(1, 3, -1)).toBe(0);
  });

  it("parte de un índice fuera de rango ya recortado", () => {
    expect(moveActiveIndex(99, 3, 1)).toBe(0);
  });
});
