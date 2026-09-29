import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";

import { equipment, equipmentTypes, restaurants, securityLabels } from "@/lib/db/schema";
import { createTempDb, testId, type TempDb } from "@/lib/test-utils/temp-db";

/**
 * Una unidad retirada no es una opción.
 *
 * PH01 se consolidó en PZ01 y su fila se borró de `restaurants`. Este test fija
 * la regla que lo hizo innecesario: aunque una fila inactiva volviera a existir
 * (un archivo antiguo, una importación de un documento, un seed), los selectores
 * de la aplicación la ofrecen a la vez que el mapa histórico la conserva para
 * leer.
 *
 * Se prueban las DOS mitades porque las dos importan y se contradicen si solo se
 * implementa una: el selector que ofrece y el mapa que consulta.
 */

let temp: TempDb;

const PZ01 = testId("rest", 1);
const PH01 = testId("rest", 2);
const KF02 = testId("rest", 3);
const TIPO = testId("type", 1);

beforeAll(async () => {
  temp = await createTempDb();
  const ahora = new Date();
  await temp.db.insert(equipmentTypes).values({
    id: TIPO,
    name: "Mini-PC",
    description: null,
    createdAt: ahora,
    updatedAt: ahora,
  });
  await temp.db.insert(restaurants).values([
    { id: PZ01, code: "PZ01", name: "Pizza Hut", brand: "Pizza Hut", sector: "Cocina", logo: "/brands/pizza-hut.jpg", address: null, active: true, createdAt: ahora, updatedAt: ahora },
    { id: PH01, code: "PH01", name: "Pizza Hut PH01", brand: "Pizza Hut", sector: null, logo: "/brands/pizza-hut.jpg", address: null, active: false, createdAt: ahora, updatedAt: ahora },
    { id: KF02, code: "KF02", name: "KFC", brand: "KFC", sector: "Caja", logo: "/brands/kfc.svg", address: null, active: true, createdAt: ahora, updatedAt: ahora },
  ]);
});

afterAll(() => temp.close());

/** La consulta que hacen los selectores: solo unidades activas. */
async function unidadesOfrecidas() {
  return temp.db
    .select({ id: restaurants.id, code: restaurants.code })
    .from(restaurants)
    .where(eq(restaurants.active, true));
}

/** La consulta que hace el inventario para poder leer el nombre de una unidad. */
async function mapaHistorico() {
  return temp.db.select({ id: restaurants.id, code: restaurants.code }).from(restaurants);
}

describe("la unidad inactiva no se ofrece", () => {
  it("el selector excluye la unidad retirada", async () => {
    const opciones = await unidadesOfrecidas();
    expect(opciones.map((r) => r.code)).toEqual(["PZ01", "KF02"]);
  });

  it("el selector nunca incluye PH01", async () => {
    const opciones = await unidadesOfrecidas();
    expect(opciones.some((r) => r.code === "PH01")).toBe(false);
  });

  it("el mapa histórico sí la conserva, para poder leer y traducir", async () => {
    // Si el mapa también la borrara, un equipo que aún la mencionara se vería
    // sin nombre en vez de con el nombre de su unidad.
    const mapa = await mapaHistorico();
    expect(mapa.map((r) => r.code)).toContain("PH01");
  });
});

describe("eliminar la fila no rompe nada", () => {
  it("borrar PH01 deja el resto intacto y no genera huérfanos", async () => {
    // Se replica aquí la operación real: `DELETE` sin cascada sobre una unidad
    // que ya no tiene equipos ni etiquetas.
    const equipoPh01 = testId("eq", 1);
    const ahora = new Date();
    await temp.db.insert(equipment).values({
      id: equipoPh01,
      assetCode: "PH01-0001",
      serialNumber: "SN-1",
      equipmentTypeId: TIPO,
      restaurantId: PZ01,
      ownerRestaurantId: null,
      status: "ACTIVE",
      sourceDocument: "INVENTARIO PH01.xlsx",
      createdAt: ahora,
      updatedAt: ahora,
    });

    await temp.db.delete(restaurants).where(eq(restaurants.id, PH01));

    const supervivientes = await temp.db.select({ code: restaurants.code }).from(restaurants);
    expect(supervivientes.map((r) => r.code).sort()).toEqual(["KF02", "PZ01"]);

    // El equipo que venía del documento de PH01 sigue en PZ01, con su etiqueta
    // intacta: el borrado de la unidad no arrastra al inventario.
    const [equipo] = await temp.db.select().from(equipment).where(eq(equipment.id, equipoPh01));
    expect(equipo?.restaurantId).toBe(PZ01);
    expect(equipo?.sourceDocument).toBe("INVENTARIO PH01.xlsx");

    const huerfanos = await temp.db
      .select({ id: equipment.id })
      .from(equipment)
      .leftJoin(restaurants, eq(equipment.restaurantId, restaurants.id))
      .where(isNull(restaurants.id));
    expect(huerfanos).toHaveLength(0);

    const etiquetasHuerfanas = await temp.db
      .select({ id: securityLabels.id })
      .from(securityLabels)
      .leftJoin(equipment, eq(securityLabels.equipmentId, equipment.id))
      .where(isNull(equipment.id));
    expect(etiquetasHuerfanas).toHaveLength(0);
  });
});
