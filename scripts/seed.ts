import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function findId(
  table: string,
  column: string,
  value: string,
): Promise<string | null> {
  const res = await client.execute({
    sql: `SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`,
    args: [value],
  });
  return res.rows.length > 0 ? String(res.rows[0].id) : null;
}

async function main(): Promise<void> {
  if (process.argv.includes("--reset")) {
    console.log(
      "SEED_RESET_BLOQUEADO=no se ejecutan DROP/TRUNCATE por politica del proyecto; el seed es idempotente y no destructivo.",
    );
  }

  const now = Date.now();
  const monthsMs = (m: number): number => m * 30 * 24 * 60 * 60 * 1000;

  const restaurants = [
    {
      name: "Pizza Hut",
      code: "PZ01",
      brand: "Pizza Hut",
      sector: "Cocina",
      logo: "/brands/pizza-hut.jpg",
      address: "Av. Principal 101",
    },
    {
      name: "KFC",
      code: "KF02",
      brand: "KFC",
      sector: "Caja",
      logo: "/brands/kfc.svg",
      address: "Av. Principal 123",
    },
    {
      name: "Denny" + String.fromCharCode(39) + "s",
      code: "DN03",
      brand: "Denny" + String.fromCharCode(39) + "s",
      sector: "Autoservicio",
      logo: "/brands/dennys.png",
      address: "Centro Comercial",
    },
    {
      name: "China Wok",
      code: "CW04",
      brand: "China Wok",
      sector: "Despacho",
      logo: "/brands/china-wok.svg",
      address: "Zona Centro",
    },
  ];

  const restaurantIds: Record<string, string> = {};
  for (const r of restaurants) {
    const hit = await findId("restaurants", "code", r.code);
    if (hit) {
      await client.execute({
        sql: "UPDATE restaurants SET name = ?, address = ?, brand = ?, sector = ?, logo = ?, updatedAt = ? WHERE id = ?",
        args: [r.name, r.address, r.brand, r.sector, r.logo, now, hit],
      });
      restaurantIds[r.code] = hit;
      console.log("RESTAURANT_UPDATED=" + r.code);
    } else {
      const id = randomUUID();
      await client.execute({
        sql: "INSERT INTO restaurants (id, name, code, address, brand, sector, logo, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
        args: [id, r.name, r.code, r.address, r.brand, r.sector, r.logo, now, now],
      });
      restaurantIds[r.code] = id;
      console.log("RESTAURANT_INSERTED=" + r.code);
    }
  }

  const types = [
    {
      name: "Televisión",
      description: "Pantalla para menús y promociones",
      months: 60,
    },
    {
      name: "HME",
      description: "Equipo de autoservicio (HME)",
      months: 48,
    },
    {
      name: "Impresora Epson",
      description: "Impresora de facturas para punto de venta",
      months: 36,
    },
    {
      name: "Impresora Zebra",
      description: "Impresora Zebra ZD230 para etiquetas QR",
      months: 36,
    },
    {
      name: "Tomapedidos",
      description: "Dispositivo de captura de pedidos",
      months: 24,
    },
    {
      name: "Mini-PC",
      description: "Mini computadora para el punto de venta",
      months: 36,
    },
  ];

  const typeIds: Record<string, string> = {};
  for (const t of types) {
    const hit = await findId("equipment_types", "name", t.name);
    if (hit) {
      await client.execute({
        sql: "UPDATE equipment_types SET description = ?, useful_life_months = ?, active = 1, updatedAt = ? WHERE id = ?",
        args: [t.description, t.months, now, hit],
      });
      typeIds[t.name] = hit;
      console.log("TYPE_UPDATED=" + t.name);
    } else {
      const id = randomUUID();
      await client.execute({
        sql: "INSERT INTO equipment_types (id, name, description, useful_life_months, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?)",
        args: [id, t.name, t.description, t.months, now, now],
      });
      typeIds[t.name] = id;
      console.log("TYPE_INSERTED=" + t.name);
    }
  }

  type EquipmentSpec = {
    assetCode: string;
    type: string;
    restaurant: string;
    serial: string;
    brand: string;
    model: string;
    purchaseMonthsAgo: number;
    installMonthsAgo: number;
    status: string;
    notes: string | null;
  };

  const equipmentSpecs: EquipmentSpec[] = [
    { assetCode: "PH-TV-001", type: "Televisión", restaurant: "PZ01", serial: "SAM-TV-88210", brand: "Samsung", model: 'QLED 43"', purchaseMonthsAgo: 10, installMonthsAgo: 9, status: "ACTIVE", notes: "Pantalla del menú principal" },
    { assetCode: "PH-EPS-001", type: "Impresora Epson", restaurant: "PZ01", serial: "EPS-556201", brand: "Epson", model: "TM-T20X", purchaseMonthsAgo: 24, installMonthsAgo: 23, status: "DAMAGED", notes: "Reemplazo solicitado (se atasca al imprimir)" },
    { assetCode: "PH-ZEB-001", type: "Impresora Zebra", restaurant: "PZ01", serial: "ZEB-330114", brand: "Zebra", model: "ZD230", purchaseMonthsAgo: 6, installMonthsAgo: 5, status: "ACTIVE", notes: "Imprime etiquetas de seguridad QR" },
    { assetCode: "PH-MPC-001", type: "Mini-PC", restaurant: "PZ01", serial: "LNV-771003", brand: "Lenovo", model: "ThinkCentre M70q", purchaseMonthsAgo: 14, installMonthsAgo: 13, status: "ACTIVE", notes: "POS caja 1" },
    { assetCode: "KFC-HME-001", type: "HME", restaurant: "KF02", serial: "HME-902718", brand: "HME", model: "SmartCafe", purchaseMonthsAgo: 18, installMonthsAgo: 17, status: "ACTIVE", notes: "Kiosco de autoservicio" },
    { assetCode: "KFC-TV-001", type: "Televisión", restaurant: "KF02", serial: "LG-TV-441008", brand: "LG", model: '55UH6065 55"', purchaseMonthsAgo: 30, installMonthsAgo: 29, status: "ACTIVE", notes: null },
    { assetCode: "KFC-EPS-001", type: "Impresora Epson", restaurant: "KF02", serial: "EPS-782330", brand: "Epson", model: "TM-U220", purchaseMonthsAgo: 8, installMonthsAgo: 7, status: "ACTIVE", notes: null },
    { assetCode: "KFC-TOM-001", type: "Tomapedidos", restaurant: "KF02", serial: "ZEB-991022", brand: "Zebra", model: "TC22", purchaseMonthsAgo: 12, installMonthsAgo: 11, status: "MAINTENANCE", notes: "Pantalla presenta líneas intermitentes" },
    { assetCode: "DEN-MPC-001", type: "Mini-PC", restaurant: "DN03", serial: "DEL-118450", brand: "Dell", model: "OptiPlex 3000", purchaseMonthsAgo: 36, installMonthsAgo: 35, status: "MAINTENANCE", notes: "Revisión de rendimiento programada" },
    { assetCode: "DEN-ZEB-001", type: "Impresora Zebra", restaurant: "DN03", serial: "ZEB-220776", brand: "Zebra", model: "ZD230", purchaseMonthsAgo: 4, installMonthsAgo: 3, status: "ACTIVE", notes: null },
    { assetCode: "DEN-TV-001", type: "Televisión", restaurant: "DN03", serial: "SAM-TV-330119", brand: "Samsung", model: 'LED 55"', purchaseMonthsAgo: 20, installMonthsAgo: 19, status: "ACTIVE", notes: "Lobby" },
    { assetCode: "DEN-EPS-001", type: "Impresora Epson", restaurant: "DN03", serial: "EPS-664912", brand: "Epson", model: "TM-T88VI", purchaseMonthsAgo: 15, installMonthsAgo: 14, status: "ACTIVE", notes: null },
    { assetCode: "CW-ZEB-001", type: "Impresora Zebra", restaurant: "CW04", serial: "ZEB-118009", brand: "Zebra", model: "ZD230", purchaseMonthsAgo: 9, installMonthsAgo: 8, status: "ACTIVE", notes: null },
    { assetCode: "CW-EPS-001", type: "Impresora Epson", restaurant: "CW04", serial: "EPS-900332", brand: "Epson", model: "TM-T20X", purchaseMonthsAgo: 11, installMonthsAgo: 10, status: "ACTIVE", notes: null },
    { assetCode: "CW-HME-001", type: "HME", restaurant: "CW04", serial: "HME-557004", brand: "HME", model: "SmartCafe", purchaseMonthsAgo: 5, installMonthsAgo: 4, status: "ACTIVE", notes: null },
  ];

  /**
   * Datos DEMO adicionales para poder probar la impresion multiple.
   *
   * - 35 equipos deterministas (`DEMO-001`..`DEMO-035`) que llevan el total de
   *   DEMO de 15 a 50 (15 originales + 35 nuevos), no 50 adicionales.
   * - NUNCA se asignan a PH01: esa unidad ya no existe. Su inventario real
   *   importado de `INVENTARIO PH01.xlsx` se consolidó en PZ01.
   * - `source_document` queda NULL, igual que los 15 DEMO ya existentes, para
   *   que el inventario los siga mostrando como DEMO y no como importacion real.
   * - Son ficticios: no describen equipos reales de KFC, China Wok ni Denny's.
   * - El `asset_code` es determinista, asi que reejecutar el seed actualiza las
   *   filas existentes en vez de duplicarlas.
   */
  const DEMO_FILLER_TARGETS: Array<{ code: string; count: number }> = [
    { code: "PZ01", count: 9 },
    { code: "KF02", count: 9 },
    { code: "DN03", count: 9 },
    { code: "CW04", count: 8 },
  ];

  const DEMO_FILLER_POOL: Array<{
    type: string;
    brand: string;
    model: string;
  }> = [
    { type: "Impresora Zebra", brand: "Zebra", model: "ZD230 (demo)" },
    { type: "Impresora Epson", brand: "Epson", model: "TM-T20X (demo)" },
    { type: "Televisión", brand: "Samsung", model: 'QLED 43" (demo)' },
    { type: "Mini-PC", brand: "Lenovo", model: "ThinkCentre M70q (demo)" },
    { type: "Tomapedidos", brand: "Zebra", model: "TC22 (demo)" },
    { type: "HME", brand: "HME", model: "SmartCafe (demo)" },
  ];

  const DEMO_FILLER_STATUSES = [
    "ACTIVE",
    "ACTIVE",
    "ACTIVE",
    "DAMAGED",
    "MAINTENANCE",
  ];

  const DEMO_FILLER_TOTAL = DEMO_FILLER_TARGETS.reduce(
    (acc, t) => acc + t.count,
    0,
  );

  let demoFillerIndex = 0;
  for (const target of DEMO_FILLER_TARGETS) {
    for (let i = 0; i < target.count; i += 1) {
      demoFillerIndex += 1;
      const seq = String(demoFillerIndex).padStart(3, "0");
      const pool = DEMO_FILLER_POOL[(demoFillerIndex - 1) % DEMO_FILLER_POOL.length];
      if (!pool) {
        console.log("DEMO_FILLER_SKIPPED=" + seq + " (pool vacio)");
        continue;
      }
      equipmentSpecs.push({
        assetCode: "DEMO-" + seq,
        type: pool.type,
        restaurant: target.code,
        serial: "DEMO-SN-" + seq,
        brand: pool.brand,
        model: pool.model,
        purchaseMonthsAgo: 6 + (demoFillerIndex % 12),
        installMonthsAgo: 5 + (demoFillerIndex % 11),
        status: DEMO_FILLER_STATUSES[(demoFillerIndex - 1) % DEMO_FILLER_STATUSES.length] ?? "ACTIVE",
        notes:
          "DEMO " +
          seq +
          " de " +
          String(DEMO_FILLER_TOTAL).padStart(3, "0") +
          ": equipo ficticio para prueba de impresion multiple",
      });
    }
  }
  console.log("DEMO_FILLER_DECLARADOS=" + String(demoFillerIndex));

  const equipmentIds: Record<string, string> = {};
  for (const e of equipmentSpecs) {
    const hit = await findId("equipment", "asset_code", e.assetCode);
    const restId = restaurantIds[e.restaurant];
    const typeId = typeIds[e.type];
    const purchase = now - monthsMs(e.purchaseMonthsAgo);
    const install = now - monthsMs(e.installMonthsAgo);
    if (hit) {
      await client.execute({
        sql: "UPDATE equipment SET serial_number = ?, equipment_type_id = ?, restaurant_id = ?, brand = ?, model = ?, purchase_date = ?, installation_date = ?, status = ?, notes = ?, updatedAt = ? WHERE id = ?",
        args: [e.serial, typeId, restId, e.brand, e.model, purchase, install, e.status, e.notes, now, hit],
      });
      equipmentIds[e.assetCode] = hit;
      console.log("EQUIPMENT_UPDATED=" + e.assetCode);
    } else {
      const id = randomUUID();
      await client.execute({
        sql: "INSERT INTO equipment (id, asset_code, serial_number, equipment_type_id, restaurant_id, brand, model, purchase_date, installation_date, status, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [id, e.assetCode, e.serial, typeId, restId, e.brand, e.model, purchase, install, e.status, e.notes, now, now],
      });
      equipmentIds[e.assetCode] = id;
      console.log("EQUIPMENT_INSERTED=" + e.assetCode);
    }
  }

  const usersRes = await client.execute({
    sql: "SELECT id, email FROM user WHERE email IN (?, ?, ?)",
    args: ["admin@grupo.comidas", "it@grupo.comidas", "user@grupo.comidas"],
  });
  const userIdByEmail: Record<string, string> = {};
  for (const row of usersRes.rows) {
    userIdByEmail[String(row.email)] = String(row.id);
  }

  type RequestSpec = {
    restaurant: string;
    requestedBy: string;
    type: string;
    currentAssetCode: string | null;
    reason: string;
    description: string;
    priority: string;
    status: string;
  };

  const requestSpecs: RequestSpec[] = [
    { restaurant: "PZ01", requestedBy: "user@grupo.comidas", type: "Impresora Epson", currentAssetCode: "PH-EPS-001", reason: "Reemplazo por falla al imprimir", description: "La impresora de caja 1 se atasca constantemente", priority: "URGENT", status: "PENDING" },
    { restaurant: "PZ01", requestedBy: "user@grupo.comidas", type: "Televisión", currentAssetCode: null, reason: "Televisor adicional para sala de espera", description: "Se requiere segunda pantalla para espera de clientes", priority: "NORMAL", status: "APPROVED" },
    { restaurant: "PZ01", requestedBy: "it@grupo.comidas", type: "Mini-PC", currentAssetCode: null, reason: "Mini-PC adicional para caja 2", description: "Apertura de una nueva caja en temporada alta", priority: "NORMAL", status: "IN_REVIEW" },
    { restaurant: "KF02", requestedBy: "user@grupo.comidas", type: "Tomapedidos", currentAssetCode: "KFC-TOM-001", reason: "Reparación de tomapedidos", description: "Pantalla con líneas intermitentes al salir del modo reposo", priority: "HIGH", status: "IN_REVIEW" },
    { restaurant: "KF02", requestedBy: "user@grupo.comidas", type: "Impresora Zebra", currentAssetCode: null, reason: "Impresora de etiquetas para nuevos QRs", description: "Crecimiento de caja 2, se requiere nueva ZD230", priority: "NORMAL", status: "APPROVED" },
    { restaurant: "KF02", requestedBy: "user@grupo.comidas", type: "Televisión", currentAssetCode: "KFC-TV-001", reason: "Cambio de pantalla del lobby", description: "Pantalla actual con brillo reducido", priority: "LOW", status: "REJECTED" },
    { restaurant: "DN03", requestedBy: "user@grupo.comidas", type: "Mini-PC", currentAssetCode: "DEN-MPC-001", reason: "Reemplazo de mini-pc por lentitud", description: "El punto de venta tarda en responder", priority: "HIGH", status: "PENDING" },
    { restaurant: "DN03", requestedBy: "it@grupo.comidas", type: "Impresora Zebra", currentAssetCode: "DEN-ZEB-001", reason: "Mantenimiento de impresora de etiquetas", description: "Cabezal de impresión con desgaste", priority: "NORMAL", status: "COMPLETED" },
    { restaurant: "CW04", requestedBy: "user@grupo.comidas", type: "HME", currentAssetCode: "CW-HME-001", reason: "Falla en equipo de autoservicio", description: "La pantalla no inicia en horario de apertura", priority: "URGENT", status: "PENDING" },
    { restaurant: "CW04", requestedBy: "user@grupo.comidas", type: "Impresora Epson", currentAssetCode: null, reason: "Impresora fiscal adicional", description: "Nueva caja en mostrador", priority: "NORMAL", status: "CANCELLED" },
  ];

  for (const req of requestSpecs) {
    const restId = restaurantIds[req.restaurant];
    const typeId = typeIds[req.type];
    const userId = userIdByEmail[req.requestedBy];
    const currentId = req.currentAssetCode
      ? equipmentIds[req.currentAssetCode]
      : null;
    if (!restId || !typeId || !userId) {
      console.log("REQUEST_SKIPPED=" + req.reason + " (faltan referencias)");
      continue;
    }
    const hit = await client.execute({
      sql: "SELECT id FROM equipment_requests WHERE restaurant_id = ? AND equipment_type_id = ? AND requested_by = ? AND reason = ? LIMIT 1",
      args: [restId, typeId, userId, req.reason],
    });
    if (hit.rows.length > 0) {
      console.log("REQUEST_EXISTS=" + req.reason);
      continue;
    }
    const id = randomUUID();
    await client.execute({
      sql: "INSERT INTO equipment_requests (id, restaurant_id, requested_by, equipment_type_id, current_equipment_id, reason, description, priority, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, restId, userId, typeId, currentId, req.reason, req.description, req.priority, req.status, now, now],
    });
    console.log("REQUEST_INSERTED=" + req.reason);
  }

  for (const assetCode of Object.keys(equipmentIds)) {
    const equipmentId = equipmentIds[assetCode];
    const hit = await client.execute({
      sql: "SELECT id FROM security_labels WHERE equipment_id = ? LIMIT 1",
      args: [equipmentId],
    });
    if (hit.rows.length > 0) {
      console.log("LABEL_EXISTS=" + assetCode);
      continue;
    }
    const token = randomUUID().replaceAll("-", "");
    await client.execute({
      sql: "INSERT INTO security_labels (id, equipment_id, token, createdAt) VALUES (?, ?, ?, ?)",
      args: [randomUUID(), equipmentId, token, now],
    });
    console.log("LABEL_INSERTED=" + assetCode + " token=" + token.slice(0, 8) + "...");
  }

  const restaurantsCount = await client.execute("SELECT COUNT(*) AS n FROM restaurants");
  const typesCount = await client.execute("SELECT COUNT(*) AS n FROM equipment_types");
  const equipmentCount = await client.execute("SELECT COUNT(*) AS n FROM equipment");
  const requestsCount = await client.execute("SELECT COUNT(*) AS n FROM equipment_requests");
  const labelsCount = await client.execute("SELECT COUNT(*) AS n FROM security_labels");
  const usersCount = await client.execute("SELECT COUNT(*) AS n FROM user");

  console.log("FINAL_RESTAURANTS=" + String(restaurantsCount.rows[0].n));
  console.log("FINAL_EQUIPMENT_TYPES=" + String(typesCount.rows[0].n));
  console.log("FINAL_EQUIPMENT=" + String(equipmentCount.rows[0].n));
  console.log("FINAL_REQUESTS=" + String(requestsCount.rows[0].n));
  console.log("FINAL_SECURITY_LABELS=" + String(labelsCount.rows[0].n));
  console.log("FINAL_USERS=" + String(usersCount.rows[0].n));

  // Verificacion de los invariantes del seed: DEMO vs inventario real.
  const byDocument = await client.execute(
    "SELECT COALESCE(source_document, 'DEMO (sin documento)') AS doc, COUNT(*) AS n FROM equipment GROUP BY source_document ORDER BY n DESC",
  );
  for (const row of byDocument.rows) {
    console.log("BREAKDOWN_" + String(row.doc) + "=" + String(row.n));
  }

  const demoEquipment = await client.execute(
    "SELECT COUNT(*) AS n FROM equipment WHERE source_document IS NULL",
  );
  const demoLabels = await client.execute(
    `SELECT COUNT(*) AS n FROM security_labels sl
     JOIN equipment e ON e.id = sl.equipment_id
     WHERE e.source_document IS NULL`,
  );
  const realEquipment = await client.execute(
    "SELECT COUNT(*) AS n FROM equipment WHERE source_document IS NOT NULL",
  );
  const groups = await client.execute("SELECT COUNT(*) AS n FROM equipment_groups");
  const duplicateTokens = await client.execute(
    "SELECT COUNT(*) AS n FROM (SELECT token FROM security_labels GROUP BY token HAVING COUNT(*) > 1)",
  );
  const demoWithoutLabel = await client.execute(
    `SELECT COUNT(*) AS n FROM equipment e
     WHERE e.source_document IS NULL
       AND NOT EXISTS (SELECT 1 FROM security_labels sl WHERE sl.equipment_id = e.id)`,
  );
  const realInDemoRestaurants = await client.execute(
    `SELECT COUNT(*) AS n FROM equipment e
     WHERE e.source_document IS NOT NULL
       AND e.restaurant_id IN (
         SELECT id FROM restaurants WHERE code IN ('PZ01','KF02','DN03','CW04')
       )`,
  );

  console.log("VERIFY_DEMO_EQUIPMENT=" + String(demoEquipment.rows[0].n));
  console.log("VERIFY_DEMO_LABELS=" + String(demoLabels.rows[0].n));
  console.log("VERIFY_DEMO_WITHOUT_LABEL=" + String(demoWithoutLabel.rows[0].n));
  console.log("VERIFY_REAL_EQUIPMENT=" + String(realEquipment.rows[0].n));
  console.log("VERIFY_EQUIPMENT_GROUPS=" + String(groups.rows[0].n));
  console.log("VERIFY_DUPLICATE_TOKENS=" + String(duplicateTokens.rows[0].n));
  console.log("VERIFY_REAL_IN_DEMO_RESTAURANTS=" + String(realInDemoRestaurants.rows[0].n));
  console.log("SEED_OK=1");
}

main()
  .catch((err) => {
    console.error("SEED_ERROR=" + String(err));
    process.exitCode = 1;
  })
  .finally(() => client.close());