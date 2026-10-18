import { describe, expect, it } from "vitest";
import {
  collectBatchFailures,
  describeIncompleteLabel,
} from "./label-generation";

describe("describeIncompleteLabel", () => {
  it("menciona el assetCode y el tipo faltante", () => {
    expect(describeIncompleteLabel("PZ01-0001", ["TYPE"])).toBe(
      'No se puede generar la etiqueta de "PZ01-0001": le falta un tipo de equipo. Corrige la relación del equipo y vuelve a intentarlo.'
    );
  });

  it("menciona restaurante faltante", () => {
    expect(describeIncompleteLabel("CW04-0055", ["RESTAURANT"])).toBe(
      'No se puede generar la etiqueta de "CW04-0055": le falta un restaurante. Corrige la relación del equipo y vuelve a intentarlo.'
    );
  });

  it("menciona ambas relaciones cuando faltan", () => {
    expect(describeIncompleteLabel("KF02-0010", ["TYPE", "RESTAURANT"])).toBe(
      'No se puede generar la etiqueta de "KF02-0010": le falta un tipo de equipo y un restaurante. Corrige la relación del equipo y vuelve a intentarlo.'
    );
  });
});

describe("collectBatchFailures", () => {
  const assetCodes = new Map([
    ["eq-1", "PZ01-0001"],
    ["eq-2", "KF02-0010"],
    ["eq-3", "DN03-0200"],
  ]);

  it("recoge fallos de resultados rechazados y de respuestas ok:false", () => {
    const entries = [
      {
        equipmentId: "eq-1",
        settled: { status: "rejected" as const, reason: new Error("fail") },
      },
      {
        equipmentId: "eq-2",
        settled: {
          status: "fulfilled" as const,
          value: { ok: false as const, error: "No se puede generar la etiqueta de \"KF02-0010\": le falta un tipo de equipo. Corrige la relación del equipo y vuelve a intentarlo." },
        },
      },
      {
        equipmentId: "eq-3",
        settled: {
          status: "fulfilled" as const,
          value: { ok: true as const, error: undefined, assetCode: "DN03-0200" },
        },
      },
    ];
    const failures = collectBatchFailures(entries, assetCodes);
    expect(failures).toHaveLength(2);
    expect(failures.map((f) => f.assetCode)).toEqual(["PZ01-0001", "KF02-0010"]);
    expect(failures[0].message).toContain("Fallo inesperado");
    expect(failures[1].message).toContain("le falta un tipo de equipo");
  });

  it("omite los éxitos y, en fallo total, devuelve todos los equipos", () => {
    const entries = [
      {
        equipmentId: "eq-1",
        settled: {
          status: "fulfilled" as const,
          value: { ok: true as const, error: undefined, assetCode: "PZ01-0001" },
        },
      },
      {
        equipmentId: "eq-2",
        settled: {
          status: "fulfilled" as const,
          value: { ok: false as const, error: "Equipo no encontrado." },
        },
      },
      {
        equipmentId: "eq-3",
        settled: {
          status: "fulfilled" as const,
          value: { ok: false as const, error: "Equipo no encontrado." },
        },
      },
    ];
    const failures = collectBatchFailures(entries, assetCodes);
    expect(failures.map((f) => f.equipmentId)).toEqual(["eq-2", "eq-3"]);
    expect(failures.map((f) => f.assetCode)).toEqual(["KF02-0010", "DN03-0200"]);
  });

  it("usa el map como respaldo y devuelve el id si no hay assetCode", () => {
    const entries = [
      {
        equipmentId: "eq-unknown",
        settled: {
          status: "fulfilled" as const,
          value: { ok: false as const, error: "err" },
        },
      },
    ];
    const failures = collectBatchFailures(entries, new Map());
    expect(failures[0].assetCode).toBe("eq-unknown");
  });
});
