import { afterEach, describe, expect, it } from "vitest";

import { EQUIPMENT_STATUS } from "@/lib/db/enums";
import { equipment, equipmentTypes, restaurants } from "@/lib/db/schema";
import {
  findEquipmentInInactiveUnits,
  findEquipmentRelationProblems,
  listEquipmentRelations,
} from "@/lib/labels/relation-audit";
import { createTempDb, type TempDb } from "@/lib/test-utils/temp-db";

/**
 * La consulta real de la auditoría (issue #34) sobre el esquema de verdad: se
 * reproduce el caso "solo funciona con algunos equipos" insertando equipos con
 * el tipo o el restaurante huérfanos y comprobando qué reporta el diagnóstico.
 */
describe("listEquipmentRelations + clasificación", () => {
  let temp: TempDb;
  const now = new Date("2024-01-01T00:00:00Z");

  async function setForeignKeys(
    client: TempDb["client"],
    enabled: boolean
  ): Promise<void> {
    const exec = client as unknown as {
      execute?: (sql: string) => Promise<unknown>;
    };
    await exec.execute?.(`PRAGMA foreign_keys=${enabled ? "ON" : "OFF"}`);
  }

  async function setupDb() {
    temp = await createTempDb();
    await temp.db.insert(equipmentTypes).values({
      id: "type-a",
      name: "Impresora",
      createdAt: now,
      updatedAt: now,
    });
    await temp.db.insert(restaurants).values([
      {
        id: "r-pz",
        name: "Pizza Hut",
        code: "PZ01",
        active: true,
        brand: "Pizza Hut",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "r-old",
        name: "Pizza Hut PH01",
        code: "PH01",
        active: false,
        brand: "Pizza Hut",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await temp.db.insert(equipment).values({
      id: "eq-ok",
      assetCode: "PZ01-0001",
      equipmentTypeId: "type-a",
      restaurantId: "r-pz",
      status: EQUIPMENT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function insertOrphan(equipmentTypeId: string, restaurantId: string) {
    await setForeignKeys(temp.client, false);
    try {
      await temp.db.insert(equipment).values({
        id: "eq-orphan",
        assetCode: "PZ01-0002",
        equipmentTypeId,
        restaurantId,
        status: EQUIPMENT_STATUS.ACTIVE,
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      await setForeignKeys(temp.client, true);
    }
  }

  it("sin relaciones rotas no reporta nada", async () => {
    await setupDb();
    const rows = await listEquipmentRelations(temp.db);
    expect(findEquipmentRelationProblems(rows)).toEqual([]);
    expect(findEquipmentInInactiveUnits(rows)).toEqual([]);
    expect(rows[0]).toMatchObject({
      assetCode: "PZ01-0001",
      typeName: "Impresora",
      restaurantName: "Pizza Hut",
      restaurantActive: true,
    });
  });

  it("detecta un equipo con el tipo huérfano", async () => {
    await setupDb();
    await insertOrphan("type-missing", "r-pz");
    const problems = findEquipmentRelationProblems(
      await listEquipmentRelations(temp.db)
    );
    expect(problems).toEqual([
      { id: "eq-orphan", assetCode: "PZ01-0002", issues: ["TYPE"] },
    ]);
  });

  it("separa el equipo rotos del sano y respeta el orden por assetCode", async () => {
    await setupDb();
    await insertOrphan("type-missing", "r-missing");
    const rows = await listEquipmentRelations(temp.db);
    expect(rows.map((r) => r.assetCode)).toEqual(["PZ01-0001", "PZ01-0002"]);
    expect(findEquipmentRelationProblems(rows)).toEqual([
      { id: "eq-orphan", assetCode: "PZ01-0002", issues: ["TYPE", "RESTAURANT"] },
    ]);
  });

  it("una unidad retirada no es una relación rota, pero sí se señala", async () => {
    await setupDb();
    await setForeignKeys(temp.client, false);
    try {
      await temp.db.insert(equipment).values({
        id: "eq-retired",
        assetCode: "PH01-0009",
        equipmentTypeId: "type-a",
        restaurantId: "r-old",
        status: EQUIPMENT_STATUS.ACTIVE,
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      await setForeignKeys(temp.client, true);
    }
    const rows = await listEquipmentRelations(temp.db);
    expect(findEquipmentRelationProblems(rows)).toEqual([]);
    expect(findEquipmentInInactiveUnits(rows)).toEqual([
      { id: "eq-retired", assetCode: "PH01-0009", restaurantName: "Pizza Hut PH01" },
    ]);
  });

  afterEach(() => {
    try {
      temp.close();
    } catch {}
  });
});
