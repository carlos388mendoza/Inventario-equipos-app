import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LabelPreview,
  type LabelPreviewData,
} from "@/components/labels/label-preview";

const QR = "data:image/png;base64,QR-DE-PRUEBA";
const LOGO = "data:image/png;base64,LOGO-DE-PRUEBA";

function render(data: LabelPreviewData) {
  return renderToStaticMarkup(React.createElement(LabelPreview, { data }));
}

describe("LabelPreview (solo QR + logotipo)", () => {
  it("muestra el QR que recibe, sin recalcularlo", () => {
    const html = render({ qrDataUrl: "data:image/png;base64,QR-ESPECIFICO", restaurantLogo: null });
    expect(html).toContain('src="data:image/png;base64,QR-ESPECIFICO"');
    expect(html).toContain('alt="Código QR de la etiqueta"');
  });

  it("muestra el logotipo cuando existe", () => {
    const html = render({ qrDataUrl: "data:image/png;base64,QR", restaurantLogo: "data:image/png;base64,LOGO-X" });
    expect(html).toContain('src="data:image/png;base64,LOGO-X"');
    expect(html).toContain('alt="Logotipo del restaurante"');
    expect((html.match(/<img/g) ?? []).length).toBe(2);
  });

  it("omite el logotipo cuando no existe (sin imagen rota)", () => {
    const html = render({ qrDataUrl: "data:image/png;base64,QR", restaurantLogo: null });
    // Solo el QR: ninguna segunda imagen que pudiera salir rota.
    expect((html.match(/<img/g) ?? []).length).toBe(1);
    expect(html).not.toContain("Logotipo");
  });

  it("trata el logotipo vacío como ausente", () => {
    const html = render({ qrDataUrl: "data:image/png;base64,QR", restaurantLogo: "" });
    expect((html.match(/<img/g) ?? []).length).toBe(1);
  });

  it("no imprime ningún texto dentro de la etiqueta", () => {
    const html = render({
      qrDataUrl: QR,
      restaurantLogo: LOGO,
    });
    // Sin nodos de texto: al quitar las etiquetas no queda nada visible.
    expect(html.replace(/<[^>]*>/g, "").trim()).toBe("");
    // Y en particular no aparecen datos de negocio (equipo, tipo, restaurante).
    expect(html).not.toContain("ACT-001");
    expect(html).not.toContain("Impresora");
    expect(html).not.toContain("Pizza Hut");
  });
});
