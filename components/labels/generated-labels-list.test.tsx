import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  GeneratedLabelsList,
  type GeneratedLabelItem,
} from "@/components/labels/generated-labels-list";

function item(overrides: Partial<GeneratedLabelItem> = {}): GeneratedLabelItem {
  return {
    qrDataUrl: "data:image/png;base64,QR-1",
    url: "https://example.com/e/token-1",
    assetCode: "ACT-001",
    typeName: "Impresora",
    restaurantName: "Pizza Hut",
    restaurantSector: "Cocina",
    restaurantLogo: null,
    installationDate: null,
    createdAt: new Date("2026-03-10T12:00:00Z"),
    ...overrides,
  };
}

function markup(labels: GeneratedLabelItem[]) {
  return renderToStaticMarkup(
    React.createElement(GeneratedLabelsList, {
      labels,
      onPrint: () => {},
      onPreview: () => {},
    })
  );
}

/**
 * Recorre el árbol de elementos (sin DOM) y devuelve los manejadores onClick de
 * los elementos cuya `aria-label` coincide. Permite verificar el cableado de
 * cada botón con su propia etiqueta sin depender de jsdom.
 */
function handlersFor(node: React.ReactNode, label: string): Array<() => void> {
  const found: Array<() => void> = [];
  const walk = (n: React.ReactNode) => {
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (!React.isValidElement(n)) return;
    const props = n.props as Record<string, unknown>;
    if (props["aria-label"] === label && typeof props.onClick === "function") {
      found.push(props.onClick as () => void);
    }
    walk(props.children as React.ReactNode);
  };
  walk(node);
  return found;
}

describe("GeneratedLabelsList", () => {
  it("muestra una acción de vista previa y una de imprimir por etiqueta", () => {
    const html = markup([
      item({ assetCode: "ACT-001" }),
      item({ assetCode: "ACT-002", qrDataUrl: "data:image/png;base64,QR-2" }),
    ]);
    expect(html).toContain('aria-label="Vista previa de la etiqueta ACT-001"');
    expect(html).toContain('aria-label="Vista previa de la etiqueta ACT-002"');
    expect(html).toContain('aria-label="Enviar a imprimir la etiqueta ACT-001"');
    expect(html).toContain('aria-label="Enviar a imprimir la etiqueta ACT-002"');
    expect((html.match(/Vista previa<\/button>/g) ?? []).length).toBe(2);
    expect((html.match(/Imprimir<\/button>/g) ?? []).length).toBe(2);
  });

  it("cada vista previa entrega SU etiqueta (con su QR y su logo)", () => {
    const first = item({ assetCode: "ACT-001", qrDataUrl: "data:image/png;base64,QR-1" });
    const second = item({
      assetCode: "ACT-002",
      qrDataUrl: "data:image/png;base64,QR-2",
      restaurantLogo: "data:image/png;base64,LOGO-2",
    });
    const onPreview = vi.fn();
    const onPrint = vi.fn();

    const tree = GeneratedLabelsList({
      labels: [first, second],
      onPrint,
      onPreview,
    });

    handlersFor(tree, "Vista previa de la etiqueta ACT-002")[0]();
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(second);
    expect(onPrint).not.toHaveBeenCalled();
  });

  it("imprimir y previsualizar son acciones independientes", () => {
    const only = item({ assetCode: "ACT-009" });
    const onPreview = vi.fn();
    const onPrint = vi.fn();

    const tree = GeneratedLabelsList({
      labels: [only],
      onPrint,
      onPreview,
    });

    handlersFor(tree, "Enviar a imprimir la etiqueta ACT-009")[0]();
    expect(onPrint).toHaveBeenCalledWith(only);
    expect(onPreview).not.toHaveBeenCalled();

    handlersFor(tree, "Vista previa de la etiqueta ACT-009")[0]();
    expect(onPreview).toHaveBeenCalledWith(only);
    // Sigue siendo una sola impresión: la vista previa no imprime ni regenera.
    expect(onPrint).toHaveBeenCalledTimes(1);
  });
});
