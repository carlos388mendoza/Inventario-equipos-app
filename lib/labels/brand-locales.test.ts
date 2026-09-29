import { describe, expect, it } from "vitest";

import {
  BRAND_LOCALES,
  allLocalesFor,
  brandKeyFor,
  isValidLocal,
  localLabel,
  parseLocalValue,
} from "./brand-locales";

describe("BRAND_LOCALES: catálogo de locales por marca", () => {
  it("expone configuración para las 4 marcas", () => {
    expect(Object.keys(BRAND_LOCALES).sort()).toEqual([
      "china-wok",
      "dennys",
      "kfc",
      "pizza-hut",
    ]);
  });

  it.each([
    ["pizza-hut", "Pizza Hut"],
    ["china-wok", "China Wok"],
    ["dennys", "Denny's"],
    ["kfc", "KFC"],
  ] as const)("mapea el nombre %s a la marca %s", (key, brandName) => {
    expect(brandKeyFor(brandName)).toBe(key);
  });

  it("no mapea nombres desconocidos", () => {
    expect(brandKeyFor("Otro Restaurante")).toBeUndefined();
    expect(brandKeyFor(null)).toBeUndefined();
  });
});

describe("isValidLocal: inclusión/exclusión por marca", () => {
  it("Pizza Hut: Locales 1..78 excepto el 13", () => {
    expect(isValidLocal("pizza-hut", 1)).toBe(true);
    expect(isValidLocal("pizza-hut", 12)).toBe(true);
    expect(isValidLocal("pizza-hut", 13)).toBe(false);
    expect(isValidLocal("pizza-hut", 14)).toBe(true);
    expect(isValidLocal("pizza-hut", 78)).toBe(true);
    expect(isValidLocal("pizza-hut", 79)).toBe(false);
  });

  it("China Wok: solamente Locales 1..5", () => {
    expect(isValidLocal("china-wok", 1)).toBe(true);
    expect(isValidLocal("china-wok", 5)).toBe(true);
    expect(isValidLocal("china-wok", 6)).toBe(false);
  });

  it("Denny's: solamente Locales 1..7", () => {
    expect(isValidLocal("dennys", 1)).toBe(true);
    expect(isValidLocal("dennys", 7)).toBe(true);
    expect(isValidLocal("dennys", 8)).toBe(false);
  });

  it("KFC: Locales 1..30 excepto el 13", () => {
    expect(isValidLocal("kfc", 1)).toBe(true);
    expect(isValidLocal("kfc", 12)).toBe(true);
    expect(isValidLocal("kfc", 13)).toBe(false);
    expect(isValidLocal("kfc", 14)).toBe(true);
    expect(isValidLocal("kfc", 30)).toBe(true);
    expect(isValidLocal("kfc", 31)).toBe(false);
  });

  it("rechaza valores no numéricos o fuera de rango", () => {
    expect(isValidLocal("pizza-hut", 0)).toBe(false);
    expect(isValidLocal("pizza-hut", -1)).toBe(false);
    expect(isValidLocal("pizza-hut", 12.5)).toBe(false);
    expect(isValidLocal("pizza-hut", null)).toBe(false);
    expect(isValidLocal("pizza-hut", undefined)).toBe(false);
  });
});

describe("localLabel: texto 'Local X' solo con local real y válido", () => {
  it("devuelve 'Local X' únicamente cuando el local es válido", () => {
    expect(localLabel("pizza-hut", 12)).toBe("Local 12");
    expect(localLabel("pizza-hut", 13)).toBeNull();
    expect(localLabel("pizza-hut", 14)).toBe("Local 14");
    expect(localLabel("kfc", 30)).toBe("Local 30");
  });

  it("nunca inventa un local a partir de sector/área", () => {
    expect(localLabel("pizza-hut", null)).toBeNull();
    expect(localLabel("pizza-hut", undefined)).toBeNull();
  });
});

describe("parseLocalValue: lee un local real sin inventar", () => {
  it.each([
    ["Local 12", 12],
    ["LOCAL 13", 13],
    ["Local 14", 14],
    ["7", 7],
    ["07", 7],
  ])("interpreta '%s' como local %s", (value, expected) => {
    expect(parseLocalValue(value)).toBe(expected);
  });

  it.each(["Cocina", "Caja", "Despacho", "Autoservicio", "", "  "])(
    "no interpreta '%s' como local",
    (value) => {
      expect(parseLocalValue(value)).toBeNull();
    }
  );
});

describe("allLocalesFor: secuencia válida completa por marca", () => {
  it("Pizza Hut incluye 12 y 14 pero NO 13", () => {
    const locals = allLocalesFor("pizza-hut");
    expect(locals).toHaveLength(77);
    expect(locals[0]).toBe(1);
    expect(locals).toContain(12);
    expect(locals).not.toContain(13);
    expect(locals).toContain(14);
    expect(locals[locals.length - 1]).toBe(78);
  });

  it("KFC incluye 12 y 14 pero NO 13", () => {
    const locals = allLocalesFor("kfc");
    expect(locals).toHaveLength(29);
    expect(locals).toContain(12);
    expect(locals).not.toContain(13);
    expect(locals).toContain(14);
    expect(locals[locals.length - 1]).toBe(30);
  });

  it("China Wok y Denny's tienen secuencias completas sin exclusiones", () => {
    expect(allLocalesFor("china-wok")).toEqual([1, 2, 3, 4, 5]);
    expect(allLocalesFor("dennys")).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
