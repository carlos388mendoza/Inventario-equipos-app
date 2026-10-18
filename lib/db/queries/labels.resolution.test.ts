import { afterEach, describe, expect, it } from "vitest";

import { EQUIPMENT_STATUS } from "@/lib/db/enums";
import { equipment, equipmentTypes, restaurants } from "@/lib/db/schema";
import { resolveLabelEquipment } from "./labels";
import { createTempDb, type TempDb } from "@/lib/test-utils/temp-db";

describe("resolveLabelEquipment", () => {
  let temp: TempDb;
  const now = new Date("2024-01-01T00:00:00Z");

  /**
   * Activa/desactiva las claves foráneas SOLO para insertar datos sintéticos
   * huérfanos (tipo/restaurante inexistente) que la rama `incomplete` necesita.
   *
   * `temp.client` es el MISMO cliente libSQL que envuelve `temp.db`, así que el
   * PRAGMA afecta a la conexión real, y no hay ninguna transacción abierta (la
   * migración ya terminó), por lo que el cambio surte efecto.
   *
   * LIMITACIÓN: el driver no devuelve el valor de `PRAGMA foreign_keys` de forma
   * tipada, así que no se confirma aquí. La garantía es indirecta: si no se
   * desactivara, el propio `insert` fallaría por FK activa; y cada test usa una
   * base en memoria nueva, así que no puede filtrarse a otros tests.
   */
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
        id: "r-kf",
        name: "KFC",
        code: "KF02",
        active: true,
        brand: "KFC",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await temp.db.insert(equipment).values([
      {
        id: "eq-valid",
        assetCode: "PZ01-0001",
        equipmentTypeId: "type-a",
        restaurantId: "r-pz",
        status: EQUIPMENT_STATUS.ACTIVE,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  it("equipo válido devuelve ok con identidad", async () => {
    await setupDb();
    const res = await resolveLabelEquipment(temp.db, "eq-valid");
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.row.assetCode).toBe("PZ01-0001");
      expect(res.row.restaurantCode).toBe("PZ01");
    }
    temp.close();
  });

  it("tipo inexistente → incomplete con TYPE", async () => {
    await setupDb();
    // Desactiva FK para insertar un equipo con tipo huérfano (rama incomplete).
    // El `finally` garantiza intentar reactivarlas aunque el insert falle.
    await setForeignKeys(temp.client, false);
    try {
      await temp.db.insert(equipment).values({
        id: "eq-no-type",
        assetCode: "PZ01-0123",
        equipmentTypeId: "type-missing",
        restaurantId: "r-pz",
        status: EQUIPMENT_STATUS.ACTIVE,
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      await setForeignKeys(temp.client, true);
    }
    const res = await resolveLabelEquipment(temp.db, "eq-no-type");
    expect(res.status).toBe("incomplete");
    if (res.status === "incomplete") {
      expect(res.assetCode).toBe("PZ01-0123");
      expect(res.issues).toContain("TYPE");
    }
    temp.close();
  });

  it("restaurante inexistente → incomplete con RESTAURANT", async () => {
    await setupDb();
    await setForeignKeys(temp.client, false);
    try {
      await temp.db.insert(equipment).values({
        id: "eq-no-restaurant",
        assetCode: "KF02-0099",
        equipmentTypeId: "type-a",
        restaurantId: "r-missing",
        status: EQUIPMENT_STATUS.ACTIVE,
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      await setForeignKeys(temp.client, true);
    }
    const res = await resolveLabelEquipment(temp.db, "eq-no-restaurant");
    expect(res.status).toBe("incomplete");
    if (res.status === "incomplete") {
      expect(res.assetCode).toBe("KF02-0099");
      expect(res.issues).toContain("RESTAURANT");
    }
    temp.close();
  });

  it("ambas relaciones inválidas → incomplete con ambos", async () => {
    await setupDb();
    await setForeignKeys(temp.client, false);
    try {
      await temp.db.insert(equipment).values({
        id: "eq-both-missing",
        assetCode: "CW04-0007",
        equipmentTypeId: "type-missing",
        restaurantId: "r-missing",
        status: EQUIPMENT_STATUS.ACTIVE,
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      await setForeignKeys(temp.client, true);
    }
    const res = await resolveLabelEquipment(temp.db, "eq-both-missing");
    expect(res.status).toBe("incomplete");
    if (res.status === "incomplete") {
      expect(res.issues.sort()).toEqual(["RESTAURANT", "TYPE"]);
    }
    temp.close();
  });

  it("no encontrado → not-found", async () => {
    await setupDb();
    const res = await resolveLabelEquipment(temp.db, "no-existe");
    expect(res.status).toBe("not-found");
    temp.close();
  });

  afterEach(() => {
    try {
      temp.close();
    } catch {}
  });
});
