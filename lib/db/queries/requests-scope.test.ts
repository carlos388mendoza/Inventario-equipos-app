import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTempDb, testId, type TempDb } from "@/lib/test-utils/temp-db";
import { equipment, equipmentRequests, equipmentTypes, restaurants, userTable } from "@/lib/db/schema";
import { listRequests } from "@/lib/db/queries/requests";
import { equipmentWithType } from "@/lib/db/queries/stats";
import { getDashboardSummary } from "@/lib/db/queries/dashboard";

/**
 * Alcance de las consultas de solicitudes (issues #11/#16).
 *
 * El contrato es: si el que consulta tiene restaurantes permitidos, NUNCA ve
 * filas de otras unidades. La capa de defensa está en las páginas/acciones
 * (guardas y `resolveScope`), y esta prueba verifica el otro extremo: que la
 * consulta en sí filtra correctamente y que un filtro vacío NO se interpreta
 * como "todas" (vector de fuga que se cerró en #12).
 */

/**
 * `lib/db/queries/*` importan el cliente Drizzle global de `@/lib/db` (que
 * apunta a la base real/Turso). Aquí lo sustituimos por un proxy que entrega
 * la base temporal creada en cada `beforeEach`, para probar contra el esquema
 * real sin tocar la base real.
 */
const mocks = vi.hoisted(() => {
  const state: { db?: unknown } = {};
  return {
    state,
    db: new Proxy({} as Record<PropertyKey, unknown>, {
      get(_target, prop) {
        if (prop === Symbol.toStringTag) return "TempDbProxy";
        if (!state.db) {
          throw new Error("La base temporal aún no está inicializada.");
        }
        const value = (state.db as Record<PropertyKey, unknown>)[prop];
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(state.db)
          : value;
      },
    }),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const MILIS_DIA = 24 * 60 * 60 * 1000;

let t: TempDb;

beforeEach(async () => {
  t = await createTempDb();
  mocks.state.db = t.db;
});

afterEach(() => {
  t.close();
});

async function sembrarDatos() {
  const ahora = new Date();
  const ids = {
    r1: testId("r", 1),
    r2: testId("r", 2),
    r3: testId("r", 3),
    tipo: testId("t", 1),
    usuario: testId("u", 1),
  };
  await t.db.insert(restaurants).values([
    { id: ids.r1, name: "Restaurante Uno", code: "R1", createdAt: ahora, updatedAt: ahora },
    { id: ids.r2, name: "Restaurante Dos", code: "R2", createdAt: ahora, updatedAt: ahora },
    { id: ids.r3, name: "Restaurante Tres", code: "R3", createdAt: ahora, updatedAt: ahora },
  ]);
  await t.db.insert(equipmentTypes).values([
    { id: ids.tipo, name: "Horno", usefulLifeMonths: 36, createdAt: ahora, updatedAt: ahora },
  ]);
  await t.db.insert(userTable).values([
    { id: ids.usuario, name: "Ana", email: "ana@test.local", createdAt: ahora, updatedAt: ahora },
  ]);
  await t.db.insert(equipmentRequests).values([
    {
      id: testId("req", 1),
      restaurantId: ids.r1,
      requestedBy: ids.usuario,
      equipmentTypeId: ids.tipo,
      reason: "Solicitud uno",
      priority: "NORMAL",
      status: "PENDING",
      installationStatus: "PENDING",
      createdAt: new Date(ahora.getTime() - 3 * MILIS_DIA),
      updatedAt: ahora,
    },
    {
      id: testId("req", 2),
      restaurantId: ids.r2,
      requestedBy: ids.usuario,
      equipmentTypeId: ids.tipo,
      reason: "Solicitud dos",
      priority: "HIGH",
      status: "APPROVED",
      installationStatus: "PENDING",
      createdAt: new Date(ahora.getTime() - 2 * MILIS_DIA),
      updatedAt: ahora,
    },
    {
      id: testId("req", 3),
      restaurantId: ids.r3,
      requestedBy: ids.usuario,
      equipmentTypeId: ids.tipo,
      reason: "Solicitud tres",
      priority: "URGENT",
      status: "PENDING",
      installationStatus: "PENDING",
      createdAt: new Date(ahora.getTime() - MILIS_DIA),
      updatedAt: ahora,
    },
  ]);
  return ids;
}

describe("listRequests: alcance por restaurante", () => {
  it("una lista vacía devuelve CERO filas (nunca se interpreta como todas)", async () => {
    await sembrarDatos();
    const filas = await listRequests({ restaurantIds: [] });
    expect(filas).toEqual([]);
  });

  it("una lista con varios restaurantes devuelve solo los de esas unidades", async () => {
    const ids = await sembrarDatos();
    const filas = await listRequests({ restaurantIds: [ids.r1, ids.r3] });
    expect(filas.map((f) => f.restaurantId).sort()).toEqual([ids.r1, ids.r3]);
    expect(filas.map((f) => f.restaurantName)).toContain("Restaurante Uno");
  });

  it("un solo restaurante devuelve solo lo suyo", async () => {
    const ids = await sembrarDatos();
    const filas = await listRequests({ restaurantId: ids.r2 });
    expect(filas).toHaveLength(1);
    expect(filas[0].restaurantId).toBe(ids.r2);
    expect(filas[0].restaurantName).toBe("Restaurante Dos");
  });

  it("una unidad inexistente devuelve cero filas", async () => {
    await sembrarDatos();
    const filas = await listRequests({ restaurantId: "no-existe" });
    expect(filas).toEqual([]);
  });

  it("SIN filtro devuelve todas las filas (vector de fuga que las guardas evitan)", async () => {
    await sembrarDatos();
    const filas = await listRequests();
    expect(filas).toHaveLength(3);
  });

  it("combina restaurantId y restaurantIds cuando llegan ambos", async () => {
    const ids = await sembrarDatos();
    const filas = await listRequests({
      restaurantId: ids.r1,
      restaurantIds: [ids.r2],
    });
    // `restaurantId` y `restaurantIds` son condiciones AND: el resultado debe
    // ser 0 porque ninguna fila cumple ambas a la vez.
    expect(filas).toEqual([]);
  });
});

describe("equipmentWithType: filtro por restaurante (rendimiento del dashboard)", () => {
  it("sin filtro devuelve el inventario completo", async () => {
    const ids = await sembrarDatos();
    const ahora = new Date();
    await t.db.insert(equipment).values([
      { id: testId("eq", 1), assetCode: "EQ-0001", equipmentTypeId: ids.tipo, restaurantId: ids.r1, createdAt: ahora, updatedAt: ahora },
      { id: testId("eq", 2), assetCode: "EQ-0002", equipmentTypeId: ids.tipo, restaurantId: ids.r2, createdAt: ahora, updatedAt: ahora },
    ]);
    const filas = await equipmentWithType();
    expect(filas).toHaveLength(2);
  });

  it("con restaurantes indicados solo devuelve los de esas unidades", async () => {
    const ids = await sembrarDatos();
    const ahora = new Date();
    await t.db.insert(equipment).values([
      { id: testId("eq", 1), assetCode: "EQ-0001", equipmentTypeId: ids.tipo, restaurantId: ids.r1, createdAt: ahora, updatedAt: ahora },
      { id: testId("eq", 2), assetCode: "EQ-0002", equipmentTypeId: ids.tipo, restaurantId: ids.r2, createdAt: ahora, updatedAt: ahora },
    ]);
    const filas = await equipmentWithType([ids.r2]);
    expect(filas).toHaveLength(1);
    expect(filas[0].equipment.restaurantId).toBe(ids.r2);
    expect(filas[0].typeName).toBe("Horno");
  });
});

describe("getDashboardSummary: los contadores respetan el alcance", () => {
  it("alcance global cuenta todo el inventario", async () => {
    const ids = await sembrarDatos();
    const ahora = new Date();
    await t.db.insert(equipment).values([
      { id: testId("eq", 1), assetCode: "EQ-0001", equipmentTypeId: ids.tipo, restaurantId: ids.r1, createdAt: ahora, updatedAt: ahora },
      { id: testId("eq", 2), assetCode: "EQ-0002", equipmentTypeId: ids.tipo, restaurantId: ids.r2, createdAt: ahora, updatedAt: ahora },
    ]);
    const resumen = await getDashboardSummary(null);
    expect(resumen.equipmentTotal).toBe(2);
    expect(resumen.activeRequests).toBe(3);
    expect(resumen.restaurantsTotal).toBe(3);
  });

  it("alcance con un restaurante solo cuenta lo suyo", async () => {
    const ids = await sembrarDatos();
    const ahora = new Date();
    await t.db.insert(equipment).values([
      { id: testId("eq", 1), assetCode: "EQ-0001", equipmentTypeId: ids.tipo, restaurantId: ids.r1, createdAt: ahora, updatedAt: ahora },
      { id: testId("eq", 2), assetCode: "EQ-0002", equipmentTypeId: ids.tipo, restaurantId: ids.r2, createdAt: ahora, updatedAt: ahora },
    ]);
    const resumen = await getDashboardSummary([ids.r2]);
    expect(resumen.equipmentTotal).toBe(1);
    expect(resumen.activeRequests).toBe(1); // solo la solicitud de r2
    expect(resumen.restaurantId).toBe(ids.r2);
  });

  it("alcance sin ninguna unidad no ve nada (ni en equipos ni en solicitudes)", async () => {
    await sembrarDatos();
    const resumen = await getDashboardSummary([]);
    expect(resumen.equipmentTotal).toBe(0);
    expect(resumen.activeRequests).toBe(0);
    expect(resumen.closedRequests).toBe(0);
    expect(resumen.restaurantId).toBeNull();
  });
});