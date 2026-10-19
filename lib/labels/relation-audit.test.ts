import { describe, expect, it } from "vitest";

import {
  findEquipmentInInactiveUnits,
  findEquipmentRelationProblems,
  type EquipmentRelationRow,
} from "@/lib/labels/relation-audit";

function row(overrides: Partial<EquipmentRelationRow> = {}): EquipmentRelationRow {
  return {
    id: "eq-1",
    assetCode: "PZ01-0001",
    typeName: "Impresora Epson",
    restaurantName: "Pizza Hut",
    restaurantActive: true,
    ...overrides,
  };
}

describe("findEquipmentRelationProblems", () => {
  it("no marca un equipo con tipo y restaurante presentes", () => {
    expect(findEquipmentRelationProblems([row()])).toEqual([]);
  });

  it("marca el tipo cuando falta", () => {
    expect(findEquipmentRelationProblems([row({ typeName: null })])).toEqual([
      { id: "eq-1", assetCode: "PZ01-0001", issues: ["TYPE"] },
    ]);
  });

  it("marca el restaurante cuando falta", () => {
    expect(findEquipmentRelationProblems([row({ restaurantName: null })])).toEqual([
      { id: "eq-1", assetCode: "PZ01-0001", issues: ["RESTAURANT"] },
    ]);
  });

  it("marca ambos y conserva el orden TYPE, RESTAURANT", () => {
    const problema = findEquipmentRelationProblems([
      row({ id: "eq-2", assetCode: "PH01-0007", typeName: null, restaurantName: null }),
    ]);
    expect(problema).toEqual([
      { id: "eq-2", assetCode: "PH01-0007", issues: ["TYPE", "RESTAURANT"] },
    ]);
  });

  it("separa los equipos sanos de los rotos", () => {
    const rows = [
      row({ id: "ok", assetCode: "PZ01-0001" }),
      row({ id: "roto", assetCode: "PZ01-0002", typeName: null }),
    ];
    expect(findEquipmentRelationProblems(rows).map((p) => p.id)).toEqual(["roto"]);
  });
});

describe("findEquipmentInInactiveUnits", () => {
  it("no marca equipos de unidades activas", () => {
    expect(findEquipmentInInactiveUnits([row()])).toEqual([]);
  });

  it("marca el equipo cuya unidad está retirada", () => {
    const resultado = findEquipmentInInactiveUnits([
      row({ id: "eq-3", assetCode: "PH01-0001", restaurantActive: false }),
    ]);
    expect(resultado).toEqual([
      { id: "eq-3", assetCode: "PH01-0001", restaurantName: "Pizza Hut" },
    ]);
  });

  it("no confunde una relación rota con una unidad retirada", () => {
    const rows = [
      row({ restaurantName: null, restaurantActive: null }),
      row({ restaurantActive: false }),
    ];
    expect(findEquipmentInInactiveUnits(rows)).toHaveLength(1);
  });
});
