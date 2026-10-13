import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Seguridad y concurrencia del cron de seguimiento (issue #13).
 *
 * Lo que se comprueba aquí es la barrera, no la redacción del correo:
 *  - sin secreto configurado, sin cabecera o con secreto incorrecto → 401 y
 *    NINGUNA consulta ni efecto sobre la base de datos;
 *  - con el secreto correcto (cabecera propia o Bearer) el proceso continúa;
 *  - sin proveedor de correo (`RESEND_API_KEY`) no se reclama nada ni se toca
 *    la base de datos: el seguimiento queda pendiente para cuando se configure;
 *  - una fila ya reclamada por otra ejecución concurrente no se reenvía;
 *  - si el envío no se procesa se LIBERA la reclamación (no se marca como
 *    enviado) y se reintenta en la siguiente ejecución;
 *  - la respuesta no filtra el secreto.
 */

const mocks = vi.hoisted(() => {
  const state = {
    dbTouched: false,
    dueRows: [] as { id: string }[],
    claimed: new Set<string>(),
    claimResult: null as number | null,
    releases: [] as string[],
    contexts: {} as Record<string, unknown>,
    sendCalls: [] as string[],
    sendShouldThrow: false,
    sendResult: {
      token: "token-de-prueba",
      tokenId: "tok-1",
      recipients: ["una@test.local"],
      sent: 1,
      skipped: 0,
      failed: 0,
    },
  };

  const selectLeaf = () => state.dueRows;

  const selectChain: Record<string, unknown> = {};
  selectChain.from = () => selectChain;
  selectChain.where = () => selectChain;
  selectChain.orderBy = () => selectChain;
  selectChain.limit = () => selectChain;
  selectChain.then = (resolve: (v: unknown) => unknown) => resolve(selectLeaf());

  const updateSet = (payload: Record<string, unknown>) => ({
    where: () => ({
      then: (resolve: (v: unknown) => unknown) => {
        // El `where` filtra por id; se simula aquí. Una reclamación nula es
        // una liberación (no se da por enviado).
        const id = state.dueRows[0]?.id ?? "";
        if (payload.followUpSentAt === null) state.releases.push(id);
        let rowsAffected = state.claimResult;
        if (rowsAffected === null) {
          rowsAffected = state.claimed.has(id) ? 0 : 1;
          state.claimed.add(id);
        }
        return resolve({ rowsAffected });
      },
    }),
  });

  return {
    state,
    db: {
      select: () => {
        state.dbTouched = true;
        return selectChain;
      },
      update: () => {
        state.dbTouched = true;
        return { set: updateSet };
      },
      delete: () => {
        state.dbTouched = true;
        return { where: () => ({ then: (resolve: (v: unknown) => unknown) => resolve(undefined) }) };
      },
    },
    loadRequestContext: vi.fn(async (id: string) => {
      if (id in state.contexts) return state.contexts[id];
      return { id };
    }),
    sendInstallationFollowUp: vi.fn(async (ctx: { id: string }) => {
      state.sendCalls.push(ctx.id);
      if (state.sendShouldThrow) throw new Error("proveedor caído");
      return { ...state.sendResult, recipients: [...state.sendResult.recipients] };
    }),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/requests/notifications", () => ({
  loadRequestContext: mocks.loadRequestContext,
  sendInstallationFollowUp: mocks.sendInstallationFollowUp,
}));

const { GET } = await import("@/app/api/cron/request-followups/route");

const SECRETO = "secreto-de-cron-para-pruebas-1234567890";

function peticion(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/cron/request-followups", {
    headers,
  });
}

describe("autorización del cron", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRETO);
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    mocks.state.dbTouched = false;
    mocks.state.dueRows = [];
    mocks.state.claimed = new Set();
    mocks.state.claimResult = null;
    mocks.state.releases = [];
    mocks.state.contexts = {};
    mocks.state.sendCalls = [];
    mocks.state.sendShouldThrow = false;
    mocks.loadRequestContext.mockClear();
    mocks.sendInstallationFollowUp.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin CRON_SECRET configurado rechaza con 401 y no toca la base de datos", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    expect(res.status).toBe(401);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("sin cabecera de secreto rechaza con 401 y no toca la base de datos", async () => {
    const res = await GET(peticion());
    expect(res.status).toBe(401);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("con un secreto incorrecto rechaza con 401 y no toca la base de datos", async () => {
    const res = await GET(peticion({ "x-cron-secret": "secreto-equivocado" }));
    expect(res.status).toBe(401);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("con un Bearer incorrecto rechaza con 401 y no toca la base de datos", async () => {
    const res = await GET(
      peticion({ authorization: "Bearer no-es-el-secreto" })
    );
    expect(res.status).toBe(401);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("con x-cron-secret válido procesa los vencidos", async () => {
    mocks.state.dueRows = [{ id: "req-1" }];
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      sent: 1,
      failed: 0,
    });
    expect(mocks.state.sendCalls).toEqual(["req-1"]);
  });

  it("con Authorization: Bearer válido también autoriza", async () => {
    mocks.state.dueRows = [{ id: "req-2" }];
    const res = await GET(peticion({ authorization: `Bearer ${SECRETO}` }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ sent: 1, failed: 0 });
  });

  it("la respuesta no filtra el secreto", async () => {
    mocks.state.dueRows = [{ id: "req-3" }];
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    const texto = JSON.stringify(await res.json());
    expect(texto).not.toContain(SECRETO);
    expect(texto).not.toContain("x-cron-secret");
  });

  it("sin proveedor de correo no procesa nada y no toca la base de datos", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    mocks.state.dueRows = [{ id: "req-sin-correo" }];
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      reason: "email-not-configured",
    });
    expect(mocks.state.dbTouched).toBe(false);
    expect(mocks.state.sendCalls).toEqual([]);
  });
});

describe("concurrencia y fallos del cron", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRETO);
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    mocks.state.dbTouched = false;
    mocks.state.dueRows = [{ id: "req-1" }];
    mocks.state.claimed = new Set();
    mocks.state.claimResult = null;
    mocks.state.releases = [];
    mocks.state.contexts = {};
    mocks.state.sendCalls = [];
    mocks.state.sendShouldThrow = false;
    mocks.state.sendResult = {
      token: "token-de-prueba",
      tokenId: "tok-1",
      recipients: ["una@test.local"],
      sent: 1,
      skipped: 0,
      failed: 0,
    };
    mocks.loadRequestContext.mockClear();
    mocks.sendInstallationFollowUp.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("una fila ya reclamada por otra ejecución no se reenvía", async () => {
    mocks.state.claimResult = 0; // simula haber perdido la carrera
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    await expect(res.json()).resolves.toMatchObject({ sent: 0, failed: 0 });
    expect(mocks.state.sendCalls).toEqual([]);
    expect(mocks.state.releases).toEqual([]);
  });

  it("un fallo del envío no aborta el proceso, se cuenta como failed y libera la reclamación", async () => {
    mocks.state.sendShouldThrow = true;
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ sent: 0, failed: 1 });
    expect(mocks.state.sendCalls).toEqual(["req-1"]);
    expect(mocks.state.releases).toEqual(["req-1"]);
  });

  it("un envío que no se procesa no se marca como enviado (se libera la reclamación)", async () => {
    mocks.state.sendResult = {
      token: "token-de-prueba",
      tokenId: "tok-1",
      recipients: ["una@test.local"],
      sent: 0,
      skipped: 0,
      failed: 1,
    };
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    await expect(res.json()).resolves.toMatchObject({ sent: 0, failed: 1 });
    expect(mocks.state.sendCalls).toEqual(["req-1"]);
    expect(mocks.state.releases).toEqual(["req-1"]);
  });

  it("una solicitud sin contexto se cuenta como failed sin enviar", async () => {
    mocks.state.contexts = { "req-1": null };
    const res = await GET(peticion({ "x-cron-secret": SECRETO }));
    await expect(res.json()).resolves.toMatchObject({ sent: 0, failed: 1 });
    expect(mocks.state.sendCalls).toEqual([]);
    expect(mocks.state.releases).toEqual([]);
  });
});
