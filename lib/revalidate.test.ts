import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` se hoistea por encima de las importaciones, así que el espía tiene
// que existir ya en el registro del módulo.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  revalidateEquipmentViews,
  revalidateEquipmentTypeViews,
  revalidateLabelViews,
  revalidateMovementViews,
  revalidateRequestViews,
  revalidateRestaurantViews,
  revalidateUserViews,
} from "./revalidate";

function paths(): string[] {
  return revalidatePath.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  revalidatePath.mockClear();
});

describe("invalidación de vistas del panel", () => {
  it("un cambio de equipo refresca panel y estadísticas, no solo /equipment", () => {
    revalidateEquipmentViews();
    const result = paths();

    // Estas dos rutas son las que quedaban desactualizadas: el resumen del
    // panel cuenta equipos y etiquetas, y las estadísticas los desglosan.
    expect(result).toContain("/dashboard");
    expect(result).toContain("/statistics");
    expect(result).toContain("/equipment");
    expect(result).toContain("/inventory");
  });

  it("refresca el detalle solo cuando se conoce el id del equipo", () => {
    revalidateEquipmentViews("eq-123");
    expect(paths()).toContain("/equipment/eq-123");

    revalidatePath.mockClear();
    revalidateEquipmentViews();
    expect(paths().some((p) => p.startsWith("/equipment/"))).toBe(false);
  });

  it("una solicitud refresca las dos listas y los contadores del panel", () => {
    revalidateRequestViews();
    const result = paths();

    expect(result).toContain("/requests");
    expect(result).toContain("/my-requests");
    expect(result).toContain("/dashboard");
    expect(result).toContain("/statistics");
  });

  it("una etiqueta refresca el conteo de etiquetas del panel", () => {
    revalidateLabelViews();
    const result = paths();

    expect(result).toContain("/labels");
    expect(result).toContain("/dashboard");
  });

  it("un tipo de equipo llega a los filtros y al desglose por tipo", () => {
    revalidateEquipmentTypeViews();
    const result = paths();

    expect(result).toContain("/equipment-types");
    expect(result).toContain("/equipment");
    expect(result).toContain("/statistics");
  });

  it("un restaurante llega a las listas y al resumen por unidad", () => {
    revalidateRestaurantViews();
    const result = paths();

    expect(result).toContain("/restaurants");
    expect(result).toContain("/dashboard");
    expect(result).toContain("/inventory");
  });

  it("un usuario no invalida rutas que no dependen de usuarios", () => {
    revalidateUserViews();
    expect(paths()).toEqual(["/users"]);
  });

  it("nunca revalida la ruta pública del QR", () => {
    revalidateEquipmentViews("eq-123");
    revalidateEquipmentTypeViews();
    revalidateRequestViews();
    revalidateLabelViews();
    revalidateRestaurantViews();
    revalidateUserViews();

    expect(paths().some((p) => p.startsWith("/e/"))).toBe(false);
  });
});

describe("movimientos de inventario", () => {
  it("un movimiento refresca el libro y las vistas que dependen de la unidad", () => {
    revalidateMovementViews();
    const result = paths();

    expect(result).toContain("/movements");
    expect(result).toContain("/equipment");
    expect(result).toContain("/inventory");
    expect(result).toContain("/dashboard");
    expect(result).toContain("/statistics");
  });

  it("no revalida /labels: la etiqueta pertenece al equipo, no a la unidad", () => {
    revalidateMovementViews(["eq-1"]);
    expect(paths()).not.toContain("/labels");
  });

  it("un lote revalida la ficha de cada equipo movido", () => {
    revalidateMovementViews(["eq-1", "eq-2", "eq-3"]);
    const result = paths();

    expect(result).toContain("/movements");
    for (const id of ["eq-1", "eq-2", "eq-3"]) {
      expect(result).toContain(`/equipment/${id}`);
    }
  });

  it("un lote sin ids no revalida ninguna ficha suelta", () => {
    revalidateMovementViews([]);
    expect(paths().some((p) => p.startsWith("/equipment/"))).toBe(false);

    revalidatePath.mockClear();
    revalidateMovementViews();
    expect(paths().some((p) => p.startsWith("/equipment/"))).toBe(false);
  });
});
