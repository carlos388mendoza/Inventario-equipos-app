import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssignedRestaurantsSummary } from "@/components/restaurants/assigned-restaurants-summary";

/**
 * Resumen de restaurantes asignados (sección 7). Se renderiza a HTML en el
 * servidor (como el resto de componentes sin DOM) para comprobar el marcado: un
 * restaurante se muestra solo, con dos no aparece ningún botón y a partir de
 * tres aparece un único botón de tres puntos, sin contador numérico.
 */
function render(names: readonly string[]) {
  return renderToStaticMarkup(
    React.createElement(AssignedRestaurantsSummary, { names })
  );
}

describe("AssignedRestaurantsSummary", () => {
  it("con un restaurante lo muestra sin botón", () => {
    const html = render(["Pizza Hut"]);
    expect(html).toContain("Pizza Hut");
    expect(html).not.toContain("dropdown-menu-trigger");
  });

  it("con dos restaurantes muestra ambos y ningún botón", () => {
    const html = render(["Pizza Hut", "KFC"]);
    expect(html).toContain("Pizza Hut, KFC");
    expect(html).not.toContain("dropdown-menu-trigger");
  });

  it("con más de dos muestra los dos primeros y un botón de tres puntos", () => {
    const html = render(["Uno", "Dos", "Tres", "Cuatro"]);
    expect(html).toContain("Uno, Dos");
    expect(html).toContain("dropdown-menu-trigger");
    expect(html).toContain("lucide-ellipsis");
    expect(html).toContain('aria-label="Ver los 4 restaurantes asignados"');
  });

  it("no muestra ningún contador numérico (+N)", () => {
    const html = render(["Uno", "Dos", "Tres", "Cuatro"]);
    expect(html).not.toContain("+2");
    expect(html).not.toContain("tabular-nums");
  });
});
