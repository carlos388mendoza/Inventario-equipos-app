import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

vi.mock("@/app/(dashboard)/labels/actions", () => ({
  generateSecurityLabel: vi.fn(),
}));

vi.mock("@/lib/sync/use-tab-sync", () => ({
  useMutationSync: () => ({
    refreshAndBroadcast: () => {},
    broadcastOnly: () => {},
  }),
}));

import { LabelsManager } from "@/components/labels/labels-manager";
import type { LabelDto } from "@/app/(dashboard)/labels/types";

function label(overrides: Partial<LabelDto> = {}): LabelDto {
  return {
    id: "l1",
    equipmentId: "e1",
    assetCode: "ACT-001",
    typeName: "Impresora",
    restaurantName: "Pizza Hut",
    restaurantBrand: "Pizza Hut",
    restaurantSector: "Cocina",
    restaurantLogo: null,
    token: "token-1",
    url: "https://example.com/e/token-1",
    qrDataUrl: "data:image/png;base64,QR-1",
    createdAt: new Date("2026-03-10T12:00:00Z"),
    regeneratedAt: null,
    installationDate: null,
    ...overrides,
  };
}

function render(labels: LabelDto[]) {
  return renderToStaticMarkup(
    React.createElement(LabelsManager, {
      labels,
      restaurantOptions: [],
      equipmentOptions: [],
    })
  );
}

/**
 * La tabla de etiquetas es HTML "normal" (no vive en un portal), así que sí se
 * renderiza en el servidor. Las acciones de cada fila van ahora en un menú de
 * tres puntos cuyo contenido solo existe al abrirse (portal de Radix), así que
 * se verifica el disparador accesible de cada fila y que las acciones ya no
 * ocupan espacio permanente. El contenido del menú se prueba directamente
 * sobre los items en la prueba de interacción inferior.
 */
describe("LabelsManager · menú de acciones en la tabla", () => {
  it("cada fila ofrece un botón de acciones ligado a su propia etiqueta", () => {
    const html = render([
      label({ id: "l1", assetCode: "ACT-001" }),
      label({ id: "l2", assetCode: "ACT-002", qrDataUrl: "data:image/png;base64,QR-2" }),
    ]);
    expect(html).toContain('aria-label="Acciones de la etiqueta ACT-001"');
    expect(html).toContain('aria-label="Acciones de la etiqueta ACT-002"');
    expect((html.match(/aria-label="Acciones de la etiqueta /g) ?? []).length).toBe(2);
    // Las tres acciones ya no ocupan espacio permanente en la fila.
    expect((html.match(/Vista previa<\/button>/g) ?? []).length).toBe(0);
    expect((html.match(/Regenerar<\/button>/g) ?? []).length).toBe(0);
  });

  it("no monta el diálogo de vista previa mientras está cerrado", () => {
    const html = render([label()]);
    expect(html).not.toContain('data-slot="dialog-content"');
    expect(html).not.toContain("Así se verá la etiqueta física");
  });
});

describe("LabelsManager · barra de búsqueda", () => {
  it("muestra un campo de búsqueda accesible sobre la tabla", () => {
    const html = render([
      label({ id: "l1", assetCode: "ACT-001" }),
      label({ id: "l2", assetCode: "ACT-002" }),
    ]);
    expect(html).toContain('aria-label="Buscar etiquetas"');
    expect(html).toContain("Buscar por equipo, tipo o restaurante");
    // El campo arranca vacío: sin filtro, todas las filas se listan.
    expect((html.match(/aria-label="Acciones de la etiqueta /g) ?? []).length).toBe(2);
  });

  it("no muestra el estado vacío de búsqueda cuando hay etiquetas y no hay filtro", () => {
    const html = render([label()]);
    expect(html).not.toContain("No hay etiquetas que coincidan");
  });
});
