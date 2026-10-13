import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canEmailRecipient,
  configuredApproverEmails,
  emailMode,
  emailProviderName,
  mailFrom,
  sendEmail,
  testAllowedRecipients,
} from "@/lib/email/send";

/**
 * Estados del envío de correo (issue #13).
 *
 * Definición verificada:
 *  - `SENT`    → el proveedor aceptó el mensaje (respuesta HTTP 2xx).
 *  - `SKIPPED` → NO se intentó enviar: falta la configuración (sin
 *                `RESEND_API_KEY`) o, en modo `test`, el destinatario no está
 *                autorizado en `MAIL_TEST_RECIPIENTS`. Nunca se convierte en
 *                `SENT`.
 *  - `FAILED`  → se intentó enviar y falló (HTTP no-2xx o error de red).
 *
 * Este módulo no registra en la base de datos; solo devuelve el resultado.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("configuración del proveedor", () => {
  it("sin RESEND_API_KEY el proveedor es 'none'", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailProviderName()).toBe("none");
  });

  it("con RESEND_API_KEY el proveedor es 'resend'", () => {
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    expect(emailProviderName()).toBe("resend");
  });

  it("mailFrom en producción usa MAIL_FROM o un remitente por defecto", () => {
    vi.stubEnv("MAIL_MODE", "production");
    vi.stubEnv("MAIL_FROM", "");
    expect(mailFrom()).toContain("no-reply@");
    vi.stubEnv("MAIL_FROM", "Equipo <avisos@test.local>");
    expect(mailFrom()).toBe("Equipo <avisos@test.local>");
  });

  it("en modo de prueba mailFrom fuerza el sandbox e ignora MAIL_FROM", () => {
    vi.stubEnv("MAIL_MODE", "");
    vi.stubEnv("MAIL_FROM", "Equipo <avisos@test.local>");
    expect(emailMode()).toBe("test");
    expect(mailFrom()).toBe("Inventario de Equipos <onboarding@resend.dev>");
  });

  it("emailMode es 'production' solo con MAIL_MODE='production'", () => {
    vi.stubEnv("MAIL_MODE", "production");
    expect(emailMode()).toBe("production");
    vi.stubEnv("MAIL_MODE", "test");
    expect(emailMode()).toBe("test");
    vi.stubEnv("MAIL_MODE", "");
    expect(emailMode()).toBe("test");
  });

  it("testAllowedRecipients normaliza, recorta y descarta vacíos", () => {
    vi.stubEnv(
      "MAIL_TEST_RECIPIENTS",
      "  Carlos@Gmail.com , ,otro@test.local "
    );
    expect(testAllowedRecipients()).toEqual([
      "carlos@gmail.com",
      "otro@test.local",
    ]);
  });

  it("canEmailRecipient solo limita en modo de prueba", () => {
    vi.stubEnv("MAIL_MODE", "test");
    vi.stubEnv("MAIL_TEST_RECIPIENTS", "autorizado@test.local");
    expect(canEmailRecipient("Autorizado@Test.local")).toBe(true);
    expect(canEmailRecipient("empleado@grupo.comidas")).toBe(false);

    vi.stubEnv("MAIL_MODE", "production");
    expect(canEmailRecipient("empleado@grupo.comidas")).toBe(true);
  });

  it("configuredApproverEmails normaliza, recorta y descarta vacíos", () => {
    vi.stubEnv(
      "REQUEST_APPROVER_EMAILS",
      "  Damaris@Grupo.com , ,gerencia@grupo.com "
    );
    expect(configuredApproverEmails()).toEqual([
      "damaris@grupo.com",
      "gerencia@grupo.com",
    ]);
  });
});

describe("sendEmail: estados", () => {
  it("sin RESEND_API_KEY devuelve SKIPPED y no intenta la red", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await sendEmail({
      to: "a@test.local",
      subject: "Hola",
      text: "Cuerpo",
    });

    expect(res.status).toBe("SKIPPED");
    expect(res.provider).toBe("none");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("con respuesta 2xx devuelve SENT", async () => {
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    vi.stubEnv("MAIL_MODE", "production");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }))
    );

    const res = await sendEmail({
      to: "a@test.local",
      subject: "Hola",
      text: "Cuerpo",
    });

    expect(res.status).toBe("SENT");
    expect(res.provider).toBe("resend");
    expect(res.error).toBeUndefined();
  });

  it("con respuesta no-2xx devuelve FAILED con el detalle del proveedor", async () => {
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    vi.stubEnv("MAIL_MODE", "production");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => "dominio no verificado",
      }))
    );

    const res = await sendEmail({
      to: "a@test.local",
      subject: "Hola",
      text: "Cuerpo",
    });

    expect(res.status).toBe("FAILED");
    expect(res.error).toContain("422");
    expect(res.error).toContain("dominio no verificado");
  });

  it("un error de red devuelve FAILED", async () => {
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    vi.stubEnv("MAIL_MODE", "production");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      })
    );

    const res = await sendEmail({
      to: "a@test.local",
      subject: "Hola",
      text: "Cuerpo",
    });

    expect(res.status).toBe("FAILED");
    expect(res.error).toContain("ECONNRESET");
  });

  it("en modo de prueba un destinatario NO autorizado queda SKIPPED sin tocar la red", async () => {
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    vi.stubEnv("MAIL_MODE", "test");
    vi.stubEnv("MAIL_TEST_RECIPIENTS", "autorizado@test.local");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await sendEmail({
      to: "empleado@grupo.comidas",
      subject: "Hola",
      text: "Cuerpo",
    });

    expect(res.status).toBe("SKIPPED");
    expect(res.provider).toBe("resend");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("en modo de prueba un destinatario autorizado se envía con el sandbox", async () => {
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    vi.stubEnv("MAIL_MODE", "test");
    vi.stubEnv("MAIL_FROM", "Equipo <avisos@test.local>");
    vi.stubEnv("MAIL_TEST_RECIPIENTS", "autorizado@test.local");
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await sendEmail({
      to: "Autorizado@test.local",
      subject: "Hola",
      text: "Cuerpo",
    });

    expect(res.status).toBe("SENT");
    expect(res.provider).toBe("resend");
    const [, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    const body = JSON.parse(init.body);
    expect(body.from).toBe("Inventario de Equipos <onboarding@resend.dev>");
    expect(body.to).toEqual(["Autorizado@test.local"]);
  });
});
