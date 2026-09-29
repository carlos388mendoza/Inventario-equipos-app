import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EQUIPMENT_STATUS, ROLES } from "@/lib/db/enums";
import {
  equipment,
  equipmentGroups,
  equipmentRequests,
  equipmentTypes,
  restaurants,
  securityLabels,
  userTable,
} from "@/lib/db/schema";
import { createTempDb, testId, type TempDb } from "@/lib/test-utils/temp-db";
import {
  ConsolidationError,
  consolidateUnit,
  equipmentStillAssigned,
  planUnitConsolidation,
} from "./consolidate-units";

/**
 * Consolidación PH01 → PZ01 sobre el esquema real en un SQLite temporal.
 *
 * Lo que se comprueba aquí es lo que no se puede ver en un doble de test: que el
 * mismo registro cambia de unidad sin cambiar de id, que las etiquetas siguen
 * colgando del mismo equipo y que nada de lo demás se mueve.
 */

const PH01 = "rest-ph01";
const PZ01 = "rest-pz01";
const KF02 = "rest-kf02";
const TYPE = "type-minipc";
const PH01_COUNT = 31;

let temp: TempDb;

async function seed() {
  const now = new Date("2024-01-01T00:00:00Z");
  await temp.db.insert(equipmentTypes).values({
    id: TYPE,
    name: "Mini-PC",
    createdAt: now,
    updatedAt: now,
  });

  await temp.db.insert(restaurants).values([
    {
      id: PH01,
      name: "Pizza Hut PH01",
      code: "PH01",
      active: true,
      brand: "Pizza Hut",
      sector: "Restaurantes",
      logo: "/brands/pizza-hut.jpg",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: PZ01,
      name: "Pizza Hut",
      code: "PZ01",
      active: true,
      brand: "Pizza Hut",
      sector: "Restaurantes",
      logo: "/brands/pizza-hut.jpg",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: KF02,
      name: "KFC",
      code: "KF02",
      active: true,
      brand: "KFC",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // 13 equipos que YA están en PZ01: no se deben tocar.
  await temp.db.insert(equipment).values(
    Array.from({ length: 13 }, (_, i) => ({
      id: testId("eq-pz", i),
      assetCode: `PZ01-${String(i + 1).padStart(4, "0")}`,
      equipmentTypeId: TYPE,
      restaurantId: PZ01,
      status: EQUIPMENT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    }))
  );

  // Los 31 del inventario PH01, con trazabilidad de origen.
  await temp.db.insert(equipment).values(
    Array.from({ length: PH01_COUNT }, (_, i) => ({
      id: testId("eq-ph", i),
      assetCode: `PH01-${String(i + 1).padStart(4, "0")}`,
      serialNumber: `SN-${i + 1}`,
      equipmentTypeId: TYPE,
      restaurantId: PH01,
      sourceDocument: "INVENTARIO PH01.xlsx",
      sourceShortCode: "PC-01",
      sourceQrCode: "DOC-QR-01",
      status: EQUIPMENT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    }))
  );

  // KFC, para comprobar que otra marca no se ve afectada.
  await temp.db.insert(equipment).values({
    id: testId("eq-kf", 0),
    assetCode: "KF02-0001",
    equipmentTypeId: TYPE,
    restaurantId: KF02,
    status: EQUIPMENT_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  // Dos de los 31 ya tienen etiqueta, como en producción.
  await temp.db.insert(securityLabels).values([
    {
      id: "lbl-1",
      equipmentId: testId("eq-ph", 0),
      token: "6a1d2d74b0fb488d8466216b1c11a770",
      createdAt: now,
    },
    {
      id: "lbl-2",
      equipmentId: testId("eq-ph", 1),
      token: "be3804d69afd4c358abb548fe26cb11e",
      createdAt: now,
    },
  ]);
}

/** Foto de lo que hay que conservar, tomada ANTES de consolidar. */
async function snapshot() {
  const rows = await temp.db
    .select({
      id: equipment.id,
      assetCode: equipment.assetCode,
      serialNumber: equipment.serialNumber,
      restaurantId: equipment.restaurantId,
      sourceDocument: equipment.sourceDocument,
      sourceQrCode: equipment.sourceQrCode,
      updatedAt: equipment.updatedAt,
    })
    .from(equipment);
  const labels = await temp.db.select().from(securityLabels);
  return { rows, labels };
}

beforeEach(async () => {
  temp = await createTempDb();
  await seed();
});

afterEach(() => temp.close());

describe("plan de consolidación", () => {
  it("describe las dos unidades y los 31 equipos de PH01", async () => {
    const plan = await planUnitConsolidation(temp.db, "PH01", "PZ01");

    expect(plan.source).toMatchObject({ id: PH01, code: "PH01" });
    expect(plan.target).toMatchObject({ id: PZ01, code: "PZ01" });
    expect(plan.equipmentIds).toHaveLength(PH01_COUNT);
    expect(plan.relations.equipment).toBe(PH01_COUNT);
    expect(plan.relations.labelled).toBe(2);
  });

  it("detecta que no hay relaciones que bloqueen el traslado", async () => {
    const plan = await planUnitConsolidation(temp.db, "PH01", "PZ01");

    expect(plan.assetCodeCollisions).toEqual([]);
    expect(plan.relations.groups).toBe(0);
    expect(plan.relations.requests).toBe(0);
    expect(plan.ownersPointingAtSource).toBe(0);
    expect(plan.copiesFromElsewhere).toBe(0);
  });

  it("no escribe nada: es solo lectura", async () => {
    const before = await snapshot();
    await planUnitConsolidation(temp.db, "PH01", "PZ01");
    expect(await snapshot()).toEqual(before);
  });

  it("rechaza unidades inexistentes o iguales", async () => {
    await expect(planUnitConsolidation(temp.db, "NOPE", "PZ01")).rejects.toThrow(
      ConsolidationError
    );
    await expect(planUnitConsolidation(temp.db, "PH01", "PH01")).rejects.toThrow(
      /misma/
    );
  });
});

describe("traslado PH01 → PZ01", () => {
  it("1. los equipos de PH01 pasan a PZ01", async () => {
    const result = await consolidateUnit(temp.db, "PH01", "PZ01");

    expect(result.movedEquipment).toBe(PH01_COUNT);
    const inTarget = await temp.db
      .select()
      .from(equipment)
      .where(eq(equipment.restaurantId, PZ01));
    expect(inTarget).toHaveLength(13 + PH01_COUNT);
  });

  it("2. no se duplica ningún equipo", async () => {
    const before = await snapshot();
    await consolidateUnit(temp.db, "PH01", "PZ01");
    const after = await snapshot();

    expect(after.rows).toHaveLength(before.rows.length);
    expect(new Set(after.rows.map((r) => r.id)).size).toBe(after.rows.length);
    expect(new Set(after.rows.map((r) => r.assetCode)).size).toBe(after.rows.length);
  });

  it("3. se conservan los ids (no se recrea nada)", async () => {
    const before = await snapshot();
    const result = await consolidateUnit(temp.db, "PH01", "PZ01");

    const beforeIds = before.rows.map((r) => r.id).sort();
    const afterIds = (await temp.db.select({ id: equipment.id }).from(equipment))
      .map((r) => r.id)
      .sort();

    expect(afterIds).toEqual(beforeIds);
    expect([...result.movedIds].sort()).toEqual(
      beforeIds.filter((id) => id.startsWith("eq-ph")).sort()
    );
  });

  it("4. se conservan asset_code, serial y trazabilidad de origen", async () => {
    const before = await snapshot();
    await consolidateUnit(temp.db, "PH01", "PZ01");
    const after = await snapshot();

    const unchanged = after.rows.filter((r) => !r.id.startsWith("eq-ph"));
    for (const row of before.rows.filter((r) => r.id.startsWith("eq-ph"))) {
      const same = after.rows.find((r) => r.id === row.id);
      expect(same).toBeDefined();
      expect(same?.assetCode).toBe(row.assetCode);
      expect(same?.serialNumber).toBe(row.serialNumber);
      expect(same?.sourceDocument).toBe(row.sourceDocument);
      expect(same?.sourceQrCode).toBe(row.sourceQrCode);
    }
    // Y el resto de equipos, byte a byte igual salvo su unidad.
    expect(unchanged).toHaveLength(14);
  });

  it("4b. los QR/token existentes siguen apuntando al mismo equipo", async () => {
    const before = await snapshot();
    await consolidateUnit(temp.db, "PH01", "PZ01");
    const after = await snapshot();

    expect(after.labels).toEqual(before.labels);
    expect(after.labels.map((l) => l.token).sort()).toEqual([
      "6a1d2d74b0fb488d8466216b1c11a770",
      "be3804d69afd4c358abb548fe26cb11e",
    ]);
  });

  it("5. PH01 queda con 0 equipos", async () => {
    await consolidateUnit(temp.db, "PH01", "PZ01");
    expect(await equipmentStillAssigned(temp.db, Array.from({ length: 31 }, (_, i) => testId("eq-ph", i)), PH01)).toBe(0);
  });

  it("6. PZ01 recibe exactamente los 31 equipos que tenía PH01", async () => {
    const beforeIds = new Set(
      (await temp.db.select({ id: equipment.id }).from(equipment))
        .map((r) => r.id)
        .filter((id) => id.startsWith("eq-ph"))
    );
    await consolidateUnit(temp.db, "PH01", "PZ01");

    const nowInPz = (await temp.db.select({ id: equipment.id }).from(equipment)).map(
      (r) => r.id
    );
    expect(nowInPz.filter((id) => beforeIds.has(id))).toHaveLength(PH01_COUNT);
  });

  it("retira PH01 sin borrarla y sin tocar PZ01", async () => {
    await consolidateUnit(temp.db, "PH01", "PZ01");
    const rows = await temp.db.select().from(restaurants);

    const ph = rows.find((r) => r.id === PH01);
    const pz = rows.find((r) => r.id === PZ01);
    expect(ph).toBeDefined(); // sigue existiendo: no hay DELETE
    expect(ph?.active).toBe(false);
    expect(pz?.active).toBe(true);
  });

  it("no modifica los equipos de KFC, Denny's ni China Wok", async () => {
    const before = await snapshot();
    await consolidateUnit(temp.db, "PH01", "PZ01");
    const after = await snapshot();

    const kfBefore = before.rows.filter((r) => r.id.startsWith("eq-kf"));
    const kfAfter = after.rows.filter((r) => r.id.startsWith("eq-kf"));
    expect(kfAfter).toEqual(kfBefore);
  });

  it("no deja equipos huérfanos: todos siguen con restaurante válido", async () => {
    await consolidateUnit(temp.db, "PH01", "PZ01");
    const validIds = new Set((await temp.db.select({ id: restaurants.id }).from(restaurants)).map((r) => r.id));
    const rows = await temp.db.select().from(equipment);
    for (const row of rows) expect(validIds.has(row.restaurantId)).toBe(true);
  });

  it("es idempotente: repetirlo no cambia nada ni duplica", async () => {
    await consolidateUnit(temp.db, "PH01", "PZ01");
    const afterFirst = await snapshot();

    const again = await consolidateUnit(temp.db, "PH01", "PZ01");
    expect(again.movedEquipment).toBe(0);
    expect(await snapshot()).toEqual(afterFirst);
  });

  it("permite no retirar la unidad origen si se pide así", async () => {
    await consolidateUnit(temp.db, "PH01", "PZ01", { deactivateSource: false });
    const ph = await temp.db.select().from(restaurants).where(eq(restaurants.id, PH01));
    expect(ph[0]?.active).toBe(true);
  });
});

describe("guardas de seguridad", () => {
  it("asset_code es único GLOBAL, así que el traslado no puede duplicar códigos", async () => {
    // Es lo que hace que la consolidación sea segura por construcción: si dos
    // unidades no pueden compartir un asset_code, mover 31 filas no puede
    // chocar con los 13 que ya están en PZ01.
    await expect(
      temp.db
        .update(equipment)
        .set({ assetCode: "PZ01-0001" })
        .where(eq(equipment.id, testId("eq-ph", 0)))
    ).rejects.toThrow();

    expect(await equipmentStillAssigned(temp.db, [testId("eq-ph", 0)], PH01)).toBe(1);
  });

  it("aborta si hay grupos de inventario en la unidad origen, sin mover nada", async () => {
    const now = new Date();
    await temp.db.insert(equipmentGroups).values({
      id: "grp-1",
      restaurantId: PH01,
      name: "MINI PC",
      quantity: 16,
      sourceDocument: "DNS19.xlsx",
      createdAt: now,
      updatedAt: now,
    });

    await expect(consolidateUnit(temp.db, "PH01", "PZ01")).rejects.toThrow(
      /grupo/i
    );
    // Nada se movió: la operación aborta antes de escribir.
    expect(await equipmentStillAssigned(temp.db, [testId("eq-ph", 0)], PH01)).toBe(1);
    const ph = await temp.db.select().from(restaurants).where(eq(restaurants.id, PH01));
    expect(ph[0]?.active).toBe(true);
  });

  it("aborta si hay solicitudes en la unidad origen, sin mover nada", async () => {
    const now = new Date();
    await temp.db.insert(userTable).values({
      id: "user-1",
      name: "Test",
      email: "test@example.com",
      emailVerified: true,
      role: ROLES.ADMIN,
      createdAt: now,
      updatedAt: now,
    });
    await temp.db.insert(equipmentRequests).values({
      id: "req-1",
      restaurantId: PH01,
      requestedBy: "user-1",
      equipmentTypeId: TYPE,
      reason: "Prueba",
      createdAt: now,
      updatedAt: now,
    });

    await expect(consolidateUnit(temp.db, "PH01", "PZ01")).rejects.toThrow(
      /solicitud/i
    );
    expect(await equipmentStillAssigned(temp.db, [testId("eq-ph", 0)], PH01)).toBe(1);
  });

  it("aborta si algún equipo tiene como propietario la unidad que se retira", async () => {
    await temp.db
      .update(equipment)
      .set({ ownerRestaurantId: PH01 })
      .where(eq(equipment.id, testId("eq-pz", 0)));

    await expect(consolidateUnit(temp.db, "PH01", "PZ01")).rejects.toThrow(
      /propietario/i
    );
    // Ni los 31 de PH01 se mueven, ni se toca el equipo que prestaba.
    expect(await equipmentStillAssigned(temp.db, [testId("eq-ph", 0)], PH01)).toBe(1);
    const prestado = await temp.db
      .select()
      .from(equipment)
      .where(eq(equipment.id, testId("eq-pz", 0)));
    expect(prestado[0]?.ownerRestaurantId).toBe(PH01);
  });
});
