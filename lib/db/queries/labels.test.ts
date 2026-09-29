import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EQUIPMENT_STATUS } from "@/lib/db/enums";
import { equipment, equipmentTypes, restaurants, securityLabels } from "@/lib/db/schema";
import { getLabelEquipmentRow, upsertSecurityLabel } from "./labels";
import { createTempDb, type TempDb } from "@/lib/test-utils/temp-db";

/**
 * La generación de etiquetas tiene que servir para CUALQUIER restaurante.
 *
 * Estas pruebas son la defensa contra que alguien reintroduzca un
 * `if (brand === "Pizza Hut")` o un `restaurantId === PZ01`: se prueban las cuatro
 * marcas reales del inventario más una unidad nueva inventada, y todas tienen
 * que devolver su propia identidad.
 */

const TYPE = "type-zebra";

/** Las cuatro marcas que hay que cubrir, más una unidad futura. */
const UNIDADES = [
  { id: "r-pz", code: "PZ01", name: "Pizza Hut", brand: "Pizza Hut", sector: "Restaurantes", logo: "/brands/pizza-hut.jpg" },
  { id: "r-kf", code: "KF02", name: "KFC", brand: "KFC", sector: "Restaurantes", logo: "/brands/kfc.png" },
  { id: "r-dn", code: "DN03", name: "Denny's", brand: "Denny's", sector: "Restaurantes", logo: "/brands/dennys.png" },
  { id: "r-cw", code: "CW04", name: "China Wok", brand: "China Wok", sector: "Restaurantes", logo: "/brands/china-wok.png" },
  { id: "r-nueva", code: "SB01", name: "Sushi Bar", brand: "Sushi Bar", sector: "Restaurantes", logo: "/brands/sushi.png" },
] as const;

let temp: TempDb;

beforeEach(async () => {
  temp = await createTempDb();
  const now = new Date("2024-01-01T00:00:00Z");

  await temp.db.insert(equipmentTypes).values({
    id: TYPE,
    name: "Impresora Zebra ZD230",
    createdAt: now,
    updatedAt: now,
  });

  await temp.db.insert(restaurants).values(
    UNIDADES.map((u) => ({
      id: u.id,
      name: u.name,
      code: u.code,
      active: true,
      brand: u.brand,
      sector: u.sector,
      logo: u.logo,
      createdAt: now,
      updatedAt: now,
    }))
  );

  await temp.db.insert(equipment).values(
    UNIDADES.map((u) => ({
      id: `eq-${u.code}`,
      assetCode: `${u.code}-0001`,
      equipmentTypeId: TYPE,
      restaurantId: u.id,
      status: EQUIPMENT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    }))
  );
});

afterEach(() => temp.close());

describe("identidad visual de la etiqueta", () => {
  it.each(UNIDADES)(
    "$brand → su equipo devuelve su propia marca, sector y logo",
    async (u) => {
      const row = await getLabelEquipmentRow(temp.db, `eq-${u.code}`);

      expect(row).toBeDefined();
      expect(row?.restaurantId).toBe(u.id);
      expect(row?.restaurantCode).toBe(u.code);
      expect(row?.restaurantName).toBe(u.name);
      expect(row?.restaurantBrand).toBe(u.brand);
      expect(row?.restaurantSector).toBe(u.sector);
      expect(row?.restaurantLogo).toBe(u.logo);
      expect(row?.typeName).toBe("Impresora Zebra ZD230");
    }
  );

  it("7-10. KFC, Denny's, China Wok y Pizza Hut generan etiqueta con su identidad", async () => {
    for (const u of UNIDADES.slice(0, 4)) {
      const row = await getLabelEquipmentRow(temp.db, `eq-${u.code}`);
      const token = `token-${u.code}`;

      await upsertSecurityLabel(temp.db, row!.id, token, new Date());

      const [saved] = await temp.db
        .select()
        .from(securityLabels)
        .where(eq(securityLabels.equipmentId, row!.id));

      expect(saved).toBeDefined();
      expect(saved.token).toBe(token);
      expect(saved.equipmentId).toBe(row!.id);
    }
  });

  it("11. no hay ninguna condición que limite la generación a PZ01", async () => {
    // Si alguien metiera un filtro por marca o por código, alguno de estos
    // equipos volvería undefined.
    const todos = await Promise.all(
      UNIDADES.map((u) => getLabelEquipmentRow(temp.db, `eq-${u.code}`))
    );
    expect(todos.every((row) => row !== undefined)).toBe(true);
  });

  it("12. la identidad sale del restaurante del equipo, no de una constante", async () => {
    // Dos equipos de marcas distintas con el mismo tipo: si la identidad no fuera
    // dinámica, ambos devolverían la misma marca.
    const pz = await getLabelEquipmentRow(temp.db, "eq-PZ01");
    const kf = await getLabelEquipmentRow(temp.db, "eq-KF02");
    expect(pz?.restaurantBrand).not.toBe(kf?.restaurantBrand);
    expect(pz?.typeName).toBe(kf?.typeName);
  });

  it("funciona con una unidad nueva sin tocar el código", async () => {
    const row = await getLabelEquipmentRow(temp.db, "eq-SB01");
    expect(row?.restaurantBrand).toBe("Sushi Bar");
  });

  it("devuelve undefined si el equipo no existe", async () => {
    expect(await getLabelEquipmentRow(temp.db, "no-existe")).toBeUndefined();
  });
});

describe("persistencia de la etiqueta", () => {
  it("el token se regenera sobre la MISMA fila, sin duplicar etiqueta", async () => {
    const id = "eq-PZ01";
    await upsertSecurityLabel(temp.db, id, "token-1", new Date("2024-01-01"));
    await upsertSecurityLabel(temp.db, id, "token-2", new Date("2024-02-01"));

    const labels = await temp.db
      .select()
      .from(securityLabels)
      .where(eq(securityLabels.equipmentId, id));

    expect(labels).toHaveLength(1);
    expect(labels[0].token).toBe("token-2");
  });

  it("la etiqueta cuelga del equipo, no del restaurante: sigue viva si el equipo cambia de unidad", async () => {
    const id = "eq-PH01-temporal";
    const now = new Date();
    await temp.db.insert(restaurants).values({
      id: "r-ph01",
      name: "Pizza Hut PH01",
      code: "PH01",
      active: true,
      brand: "Pizza Hut",
      createdAt: now,
      updatedAt: now,
    });
    await temp.db.insert(equipment).values({
      id,
      assetCode: "PH01-9999",
      equipmentTypeId: TYPE,
      restaurantId: "r-ph01",
      status: EQUIPMENT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    await upsertSecurityLabel(temp.db, id, "token-ph01", now);

    // El equipo pasa de PH01 a PZ01: la etiqueta no se toca, y la identidad que
    // devuelve ahora es la de la unidad nueva.
    await temp.db.update(equipment).set({ restaurantId: "r-pz" }).where(eq(equipment.id, id));

    const labels = await temp.db.select().from(securityLabels).where(eq(securityLabels.equipmentId, id));
    expect(labels[0].token).toBe("token-ph01");

    const row = await getLabelEquipmentRow(temp.db, id);
    expect(row?.restaurantCode).toBe("PZ01");
    expect(row?.assetCode).toBe("PH01-9999"); // el asset_code no se inventa
  });
});
