import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BatchFailures } from "@/components/labels/batch-failures";
import { type BatchFailure } from "@/lib/labels/label-generation";

function render(failures: BatchFailure[]) {
  return renderToStaticMarkup(
    React.createElement(BatchFailures, { failures })
  );
}

/**
 * El bloque de fallos es HTML plano (no vive en un portal de Radix), así que se
 * puede renderizar en el servidor. Cubre los dos escenarios de #34: lote con
 * fallo parcial (hay éxitos aparte) y lote fallado por completo.
 */
describe("BatchFailures", () => {
  it("no pinta nada cuando no hay fallos", () => {
    const html = render([]);
    expect(html).toBe("");
  });

  it("fallo parcial: lista cada equipo con su mensaje", () => {
    const html = render([
      {
        equipmentId: "eq-1",
        assetCode: "PZ01-0001",
        message:
          'No se puede generar la etiqueta de "PZ01-0001": le falta un tipo de equipo. Corrige la relación del equipo y vuelve a intentarlo.',
      },
      {
        equipmentId: "eq-2",
        assetCode: "KF02-0010",
        message: "Equipo no encontrado.",
      },
    ]);
    expect(html).toContain("No se pudieron generar 2 etiqueta(s):");
    expect(html).toContain("PZ01-0001");
    expect(html).toContain("le falta un tipo de equipo");
    expect(html).toContain("KF02-0010");
    expect(html).toContain("Equipo no encontrado.");
  });

  it("fallo total: también lista los errores por equipo", () => {
    const html = render([
      {
        equipmentId: "eq-1",
        assetCode: "PZ01-0001",
        message: "No se pudo generar ninguna etiqueta.",
      },
      {
        equipmentId: "eq-2",
        assetCode: "PZ01-0002",
        message: "No se pudo generar ninguna etiqueta.",
      },
      {
        equipmentId: "eq-3",
        assetCode: "PZ01-0003",
        message: "No se pudo generar ninguna etiqueta.",
      },
    ]);
    expect(html).toContain("No se pudieron generar 3 etiqueta(s):");
    expect(html).toContain("PZ01-0001");
    expect(html).toContain("PZ01-0002");
    expect(html).toContain("PZ01-0003");
  });
});
