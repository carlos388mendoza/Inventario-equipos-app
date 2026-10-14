import { describe, expect, it } from "vitest";

import {
  ASSIGNED_RESTAURANTS_VISIBLE,
  summarizeAssignedRestaurants,
} from "@/lib/ui/assigned-restaurants";

/**
 * Resumen de restaurantes asignados (sección 7). Se prueba en Node, sin DOM.
 *
 * Cubre los casos que pide el requerimiento: uno, dos y más de dos.
 */
describe("summarizeAssignedRestaurants", () => {
  it("con un solo restaurante lo muestra tal cual, sin contador", () => {
    const summary = summarizeAssignedRestaurants(["Pizza Hut"]);
    expect(summary.visible).toEqual(["Pizza Hut"]);
    expect(summary.hiddenCount).toBe(0);
    expect(summary.hasOverflow).toBe(false);
  });

  it("con dos restaurantes muestra ambos, sin contador", () => {
    const summary = summarizeAssignedRestaurants(["Pizza Hut", "KFC"]);
    expect(summary.visible).toEqual(["Pizza Hut", "KFC"]);
    expect(summary.hiddenCount).toBe(0);
    expect(summary.hasOverflow).toBe(false);
  });

  it("con tres o más muestra dos y resume el resto con el número real", () => {
    const names = ["Uno", "Dos", "Tres", "Cuatro", "Cinco"];
    const summary = summarizeAssignedRestaurants(names);
    expect(summary.visible).toEqual(["Uno", "Dos"]);
    expect(summary.hidden).toEqual(["Tres", "Cuatro", "Cinco"]);
    expect(summary.hiddenCount).toBe(3);
    expect(summary.hasOverflow).toBe(true);
  });

  it("con exactamente tres, el contador es +1", () => {
    const summary = summarizeAssignedRestaurants(["Uno", "Dos", "Tres"]);
    expect(summary.hiddenCount).toBe(1);
  });

  it("sin restaurantes no muestra nada ni contador", () => {
    const summary = summarizeAssignedRestaurants([]);
    expect(summary.visible).toEqual([]);
    expect(summary.hiddenCount).toBe(0);
    expect(summary.hasOverflow).toBe(false);
  });

  it("no pierde nombres: visibles + ocultos reconstruyen la lista original", () => {
    const names = ["Uno", "Dos", "Tres", "Cuatro"];
    const summary = summarizeAssignedRestaurants(names);
    expect([...summary.visible, ...summary.hidden]).toEqual(names);
  });

  it("respeta el número visible por defecto", () => {
    expect(ASSIGNED_RESTAURANTS_VISIBLE).toBe(2);
  });

  it("acepta un límite distinto (para reutilizarlo en otros sitios)", () => {
    const summary = summarizeAssignedRestaurants(["Uno", "Dos", "Tres"], 1);
    expect(summary.visible).toEqual(["Uno"]);
    expect(summary.hiddenCount).toBe(2);
  });
});
