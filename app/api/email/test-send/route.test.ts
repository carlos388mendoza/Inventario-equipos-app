import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Endpoint de correo de prueba (demostración).
 *
 * Se ejercita a través de `sendEmail` real con `fetch` sustituido, de modo que
 * se comprueba de extremo a extremo:
 *  - la barrera del `CRON_SECRET` (sin secreto no se envía nada);
 *  - que solo se envía a la allowlist `MAIL_TEST_RECIPIENTS`;
 *  - que el remitente es el sandbox de Resend;
 *  - que en modo `production` el endpoint queda deshabilitado.
 */

const { GET } = await import("@/app/api/email/test-send/route");

const SECRETO = "secreto-de-cron-para-pruebas-1234567890";

function peticion(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/email/test-send", {
    headers,
  });
}

describe("endpoint de correo de prueba", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRETO);
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    vi.stubEnv("MAIL_MODE", "test");
    vi.stubEnv("MAIL_TEST_RECIPIENTS", "uno@test.local, dos@test.local");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sin secreto rechaza con 401 y no envía nada", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await GET(peticion());

    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("con el secreto correcto envía solo a la allowlist con el sandbox", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await GET(peticion({ "x-cron-secret": SECRETO }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("test");
    expect(json.results).toHaveLength(2);
    expect(json.results.map((r: { status: string }) => r.status)).toEqual([
      "SENT",
      "SENT",
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    const body = JSON.parse(init.body);
    expect(body.from).toBe("Inventario de Equipos <onboarding@resend.dev>");
    expect(body.to).toEqual(["uno@test.local"]);
  });

  it("en modo producción está deshabilitado (409) y no envía", async () => {
    vi.stubEnv("MAIL_MODE", "production");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await GET(peticion({ "x-cron-secret": SECRETO }));

    expect(res.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sin MAIL_TEST_RECIPIENTS responde 400 y no envía", async () => {
    vi.stubEnv("MAIL_TEST_RECIPIENTS", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await GET(peticion({ "x-cron-secret": SECRETO }));

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sin RESEND_API_KEY responde skipped y no envía", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await GET(peticion({ "x-cron-secret": SECRETO }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      reason: "email-not-configured",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
