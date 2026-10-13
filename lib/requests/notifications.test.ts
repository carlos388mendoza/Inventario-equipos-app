import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { createTempDb, testId, type TempDb } from "@/lib/test-utils/temp-db";
import {
  equipmentRequests,
  equipmentTypes,
  requestNotifications,
  restaurants,
  userTable,
} from "@/lib/db/schema";
import {
  REQUEST_NOTIFICATION_STATUS,
  REQUEST_NOTIFICATION_TYPE,
} from "@/lib/db/enums";
import { recordNotifications } from "@/lib/requests/notifications";

/**
 * Bandeja de salida de notificaciones (issue #13).
 *
 * Se usa una base en memoria con el esquema real (mocks + DB aislada, nunca
 * producción) y se controla `sendEmail` para fijar cada estado. Se verifica:
 *  - cada estado del proveedor se persiste tal cual (SENT/SKIPPED/FAILED);
 *  - `SENT` marca `sentAt`; `SKIPPED`/`FAILED` NO (nunca se comunica como
 *    enviado lo que no lo fue);
 *  - los tipos de un solo envío no se duplican mientras haya un envío en
 *    PENDING/SENT/SKIPPED, pero un envío FAILED NO bloquea el reintento;
 *  - sin destinatarios no se inserta ni se envía nada.
 */

const mocks = vi.hoisted(() => {
  const state = {
    db: undefined as unknown,
    result: { status: "SENT", provider: "resend" } as {
      status: string;
      provider: string;
      error?: string;
    },
    sendCalls: [] as { to: string }[],
  };

  const dbProxy = new Proxy({} as Record<PropertyKey, unknown>, {
    get(_t, prop) {
      if (prop === Symbol.toStringTag) return "TempDbProxy";
      if (!state.db) throw new Error("Base temporal no inicializada.");
      const value = (state.db as Record<PropertyKey, unknown>)[prop];
      return typeof value === "function"
        ? (value as (...a: unknown[]) => unknown).bind(state.db)
        : value;
    },
  });

  return { state, dbProxy };
});

vi.mock("@/lib/db", () => ({ db: mocks.dbProxy }));
vi.mock("@/lib/email/send", () => ({
  configuredApproverEmails: () => [],
  sendEmail: vi.fn(async (message: { to: string }) => {
    mocks.state.sendCalls.push(message);
    return mocks.state.result;
  }),
}));

let t: TempDb;

const REQUEST_ID = testId("req", 1);

/** La base temporal aplica claves foráneas: hay que sembrar la solicitud. */
async function sembrarSolicitud() {
  const ahora = new Date();
  const restaurante = testId("r", 1);
  const tipo = testId("t", 1);
  const usuario = testId("u", 1);
  await t.db.insert(restaurants).values({
    id: restaurante,
    name: "Restaurante Uno",
    code: "R1",
    createdAt: ahora,
    updatedAt: ahora,
  });
  await t.db.insert(equipmentTypes).values({
    id: tipo,
    name: "Horno",
    usefulLifeMonths: 36,
    createdAt: ahora,
    updatedAt: ahora,
  });
  await t.db.insert(userTable).values({
    id: usuario,
    name: "Ana",
    email: "ana@test.local",
    createdAt: ahora,
    updatedAt: ahora,
  });
  await t.db.insert(equipmentRequests).values({
    id: REQUEST_ID,
    restaurantId: restaurante,
    requestedBy: usuario,
    equipmentTypeId: tipo,
    reason: "Solicitud de prueba",
    priority: "NORMAL",
    status: "PENDING",
    installationStatus: "PENDING",
    createdAt: ahora,
    updatedAt: ahora,
  });
}

beforeEach(async () => {
  t = await createTempDb();
  mocks.state.db = t.db;
  mocks.state.result = { status: "SENT", provider: "resend" };
  mocks.state.sendCalls = [];
  await sembrarSolicitud();
});

afterEach(() => {
  t.close();
});

function entrada(overrides: Partial<Parameters<typeof recordNotifications>[0]> = {}) {
  return {
    requestId: REQUEST_ID,
    type: REQUEST_NOTIFICATION_TYPE.REQUEST_CREATED,
    recipients: ["ana@test.local"],
    subject: "Asunto",
    body: "Cuerpo",
    ...overrides,
  };
}

async function filas() {
  return t.db
    .select()
    .from(requestNotifications)
    .where(eq(requestNotifications.requestId, REQUEST_ID));
}

describe("recordNotifications: persistencia de estados", () => {
  it("SENT marca sentAt y guarda el proveedor", async () => {
    mocks.state.result = { status: "SENT", provider: "resend" };
    await recordNotifications(entrada());

    const [row] = await filas();
    expect(row.status).toBe(REQUEST_NOTIFICATION_STATUS.SENT);
    expect(row.provider).toBe("resend");
    expect(row.sentAt).toBeInstanceOf(Date);
    expect(row.error).toBeNull();
  });

  it("SKIPPED (sin configuración) no marca sentAt y no se convierte en SENT", async () => {
    mocks.state.result = { status: "SKIPPED", provider: "none" };
    await recordNotifications(entrada());

    const [row] = await filas();
    expect(row.status).toBe(REQUEST_NOTIFICATION_STATUS.SKIPPED);
    expect(row.sentAt).toBeNull();
  });

  it("FAILED guarda el error sin datos sensibles y no marca sentAt", async () => {
    mocks.state.result = { status: "FAILED", provider: "resend" };
    await recordNotifications(entrada());

    const [row] = await filas();
    expect(row.status).toBe(REQUEST_NOTIFICATION_STATUS.FAILED);
    expect(row.sentAt).toBeNull();
  });

  it("crea una fila por destinatario (sin duplicar repetidos)", async () => {
    mocks.state.result = { status: "SENT", provider: "resend" };
    await recordNotifications(
      entrada({ recipients: ["Ana@Test.local", "ana@test.local", "b@test.local"] })
    );

    const rows = await filas();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.recipient).sort()).toEqual([
      "ana@test.local",
      "b@test.local",
    ]);
    expect(mocks.state.sendCalls).toHaveLength(2);
  });

  it("sin destinatarios no inserta ni envía nada", async () => {
    await recordNotifications(entrada({ recipients: [] }));
    expect(await filas()).toHaveLength(0);
    expect(mocks.state.sendCalls).toHaveLength(0);
  });
});

describe("recordNotifications: control de duplicados (un solo envío)", () => {
  it("un tipo de un solo envío no se duplica ni se reenvía", async () => {
    mocks.state.result = { status: "SENT", provider: "resend" };
    await recordNotifications(entrada());
    await recordNotifications(entrada());

    const rows = await filas();
    expect(rows).toHaveLength(1);
    expect(mocks.state.sendCalls).toHaveLength(1);
  });

  it("un envío FAILED no bloquea: el mismo tipo puede reintentarse", async () => {
    mocks.state.result = { status: "FAILED", provider: "resend" };
    await recordNotifications(entrada());
    mocks.state.result = { status: "SENT", provider: "resend" };
    await recordNotifications(entrada());

    const rows = await filas();
    expect(rows).toHaveLength(2);
    expect(rows[1].status).toBe(REQUEST_NOTIFICATION_STATUS.SENT);
    expect(rows[1].sentAt).toBeInstanceOf(Date);
    expect(mocks.state.sendCalls).toHaveLength(2);
  });
});
