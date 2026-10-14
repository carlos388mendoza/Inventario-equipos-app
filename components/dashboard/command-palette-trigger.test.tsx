import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommandPaletteTrigger } from "@/components/dashboard/command-palette-trigger";

/**
 * Verificación del marcado de los botones que abren la paleta (issue #19).
 *
 * Se renderiza a HTML en el servidor (react-dom/server, ya presente) porque el
 * proyecto no incluye jsdom/testing-library. Comprueba que cada variante produce
 * un único botón accesible, con su etiqueta y sin atajos de teclado obligatorios
 * en móvil.
 */
function render(variant: "desktop" | "mobile") {
  return renderToStaticMarkup(
    React.createElement(CommandPaletteTrigger, {
      variant,
      onOpen: () => {},
    })
  );
}

describe("CommandPaletteTrigger · botón de escritorio", () => {
  const html = render("desktop");

  it("es un único botón (sin controles duplicados)", () => {
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(html).toContain('type="button"');
  });

  it("tiene nombre accesible «Buscar» y muestra la etiqueta", () => {
    expect(html).toContain('aria-label="Buscar"');
    expect(html).toContain("Buscar");
  });

  it("no muestra la pista del atajo Ctrl K (la interfaz queda limpia)", () => {
    expect(html).not.toContain("Ctrl K");
    expect(html).not.toContain("Ctrl+K");
  });

  it("se identifica como disparador de escritorio", () => {
    expect(html).toContain('data-command-palette-trigger="desktop"');
    expect(html).not.toContain('data-command-palette-trigger="mobile"');
  });
});

describe("CommandPaletteTrigger · botón de móvil", () => {
  const html = render("mobile");

  it("es un único botón táctil", () => {
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(html).toContain('type="button"');
  });

  it("tiene nombre accesible «Buscar» aunque solo muestre el icono", () => {
    expect(html).toContain('aria-label="Buscar"');
    expect(html).toContain("<svg");
  });

  it("no depende del atajo de teclado", () => {
    expect(html).not.toContain("Ctrl K");
  });

  it("se identifica como disparador de móvil", () => {
    expect(html).toContain('data-command-palette-trigger="mobile"');
    expect(html).not.toContain('data-command-palette-trigger="desktop"');
  });
});

describe("CommandPaletteTrigger · accesibilidad compartida", () => {
  it("el icono decorativo queda oculto para lectores de pantalla", () => {
    expect(render("desktop")).toContain('aria-hidden="true"');
    expect(render("mobile")).toContain('aria-hidden="true"');
  });
});
