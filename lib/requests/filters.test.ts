import { describe, expect, it } from "vitest";

import {
  filterRequests,
  type FilterableRequest,
  type RequestFilterState,
} from "@/lib/requests/filters";

const day = (month: number, date: number, hour = 12) =>
  new Date(2026, month - 1, date, hour, 0, 0, 0);

function request(
  overrides: Partial<FilterableRequest> = {}
): FilterableRequest {
  return {
    status: "PENDING",
    restaurantId: "r1",
    priority: "NORMAL",
    equipmentTypeId: "t1",
    createdAt: day(3, 15),
    equipmentTypeName: "Impresora Zebra",
    restaurantName: "Pizza Hut",
    requestedByName: "Ana",
    reason: "Equipo dañado",
    ...overrides,
  };
}

function state(overrides: Partial<RequestFilterState> = {}): RequestFilterState {
  return {
    tab: "active",
    restaurantId: "ALL",
    statusFilter: "ALL",
    priorityFilter: "ALL",
    typeFilter: "ALL",
    query: "",
    range: {},
    ...overrides,
  };
}

describe("filterRequests (filtro de fecha combinado con el resto)", () => {
  it("sin fechas y sin filtros devuelve las solicitudes de la pestaña activa", () => {
    const rows = [
      request({ status: "PENDING" }),
      request({ status: "COMPLETED" }),
    ];
    expect(filterRequests(rows, state())).toHaveLength(1);
    expect(filterRequests(rows, state({ tab: "history" }))).toHaveLength(1);
  });

  it("2/3. acota con solo fecha inicial y solo fecha final", () => {
    const before = request({ createdAt: day(3, 5) });
    const inside = request({ createdAt: day(3, 15) });
    const after = request({ createdAt: day(3, 25) });
    const rows = [before, inside, after];

    expect(
      filterRequests(rows, state({ range: { from: day(3, 10) } }))
    ).toEqual([inside, after]);
    expect(
      filterRequests(rows, state({ range: { to: day(3, 20) } }))
    ).toEqual([before, inside]);
  });

  it("5. incluye registros del día inicial y del día final completos", () => {
    const first = request({ createdAt: new Date(2026, 2, 10, 0, 0, 0, 0) });
    const last = request({ createdAt: new Date(2026, 2, 20, 23, 59, 59, 999) });
    const outBefore = request({ createdAt: new Date(2026, 2, 9, 23, 59, 59, 999) });
    const outAfter = request({ createdAt: new Date(2026, 2, 21, 0, 0, 0, 0) });
    const rows = [first, last, outBefore, outAfter];

    expect(
      filterRequests(rows, state({ range: { from: day(3, 10), to: day(3, 20) } }))
    ).toEqual([first, last]);
  });

  it("6. un intervalo invertido no devuelve vacío: se normaliza", () => {
    const inside = request({ createdAt: day(3, 15) });
    const rows = [inside];
    expect(
      filterRequests(rows, state({ range: { from: day(3, 20), to: day(3, 10) } }))
    ).toEqual([inside]);
  });

  it("7. un rango vacío (limpiar filtros) no acota", () => {
    const rows = [request({ createdAt: day(3, 1) }), request({ createdAt: day(3, 30) })];
    expect(filterRequests(rows, state({ range: {} }))).toHaveLength(2);
  });

  it("8. combina el intervalo con tipo, estado, prioridad, restaurante y búsqueda", () => {
    const match = request({
      createdAt: day(3, 15),
      equipmentTypeId: "t1",
      status: "PENDING",
      priority: "HIGH",
      restaurantId: "r1",
      equipmentTypeName: "Impresora Zebra",
    });
    const wrongType = request({
      createdAt: day(3, 15),
      equipmentTypeId: "t2",
      status: "PENDING",
      priority: "HIGH",
      restaurantId: "r1",
    });
    const outOfRange = request({
      createdAt: day(3, 25),
      equipmentTypeId: "t1",
      status: "PENDING",
      priority: "HIGH",
      restaurantId: "r1",
    });
    const rows = [match, wrongType, outOfRange];

    const result = filterRequests(
      rows,
      state({
        range: { from: day(3, 10), to: day(3, 20) },
        typeFilter: "t1",
        statusFilter: "PENDING",
        priorityFilter: "HIGH",
        restaurantId: "r1",
        query: "impresora",
      })
    );
    expect(result).toEqual([match]);
  });
});
