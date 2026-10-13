import "server-only";

/**
 * Envío de correo desacoplado del proveedor.
 *
 * El repositorio NO traía ningún servicio de correo. Para no inventar
 * credenciales, este módulo:
 *  - usa Resend por HTTP (`fetch`) si existe `RESEND_API_KEY` (sin añadir
 *    dependencias al `package.json`);
 *  - si no hay clave, devuelve `SKIPPED`: la notificación se registra igual en
 *    la bandeja de salida (`request_notifications`) pero no sale por la red.
 *
 * Modos (`MAIL_MODE`): para que una demostración o un entorno de pruebas NO
 * envíe correos reales a los empleados, el modo por defecto es `test`:
 *  - `test` (por defecto): el remitente se fuerza al sandbox de Resend
 *    (`onboarding@resend.dev`) y SOLO se envía a `MAIL_TEST_RECIPIENTS`.
 *    Cualquier otro destinatario queda `SKIPPED` (nunca se intenta la red).
 *  - `production`: usa `MAIL_FROM` y envía a cualquier destinatario.
 *
 * Variables de entorno (nombres en `.env.example`, valores NUNCA en el repo):
 *  - `RESEND_API_KEY`          clave del proveedor (habilita el envío real).
 *  - `MAIL_MODE`               `production` habilita el envío real; cualquier
 *                              otro valor (o ausente) = modo `test`.
 *  - `MAIL_TEST_RECIPIENTS`    allowlist en modo `test`, separados por comas.
 *  - `MAIL_TEST_FROM`          remitente del modo `test` (por defecto el
 *                              sandbox `onboarding@resend.dev`).
 *  - `MAIL_FROM`               remitente verificado (solo en `production`).
 *  - `REQUEST_APPROVER_EMAILS` destinatarios de aprobación (Damaris), separados
 *                              por comas; si falta, se usan los ADMIN activos.
 */

export type EmailMode = "test" | "production";

/** Modo de correo: `production` solo si `MAIL_MODE` vale exactamente eso. */
export function emailMode(): EmailMode {
  return process.env.MAIL_MODE === "production" ? "production" : "test";
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailResult {
  status: "SENT" | "SKIPPED" | "FAILED";
  provider: string;
  error?: string;
}

export function mailFrom(): string {
  if (emailMode() === "test") {
    return (
      process.env.MAIL_TEST_FROM ||
      "Inventario de Equipos <onboarding@resend.dev>"
    );
  }
  return (
    process.env.MAIL_FROM ||
    "Inventario de Equipos <no-reply@inventario-equipos.local>"
  );
}

/** Destinatarios autorizados en modo `test` (`MAIL_TEST_RECIPIENTS`). */
export function testAllowedRecipients(): string[] {
  return (process.env.MAIL_TEST_RECIPIENTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * ¿Se puede enviar a `to` en el modo actual?
 * En `production` siempre; en `test`, solo si está en `MAIL_TEST_RECIPIENTS`.
 */
export function canEmailRecipient(to: string): boolean {
  if (emailMode() === "production") return true;
  return testAllowedRecipients().includes(to.trim().toLowerCase());
}

/** Destinatarios de aprobación configurados explícitamente (si los hay). */
export function configuredApproverEmails(): string[] {
  return (process.env.REQUEST_APPROVER_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function emailProviderName(): "resend" | "none" {
  return process.env.RESEND_API_KEY ? "resend" : "none";
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = emailProviderName();
  if (provider === "none") {
    return {
      status: "SKIPPED",
      provider: "none",
      error:
        "Falta RESEND_API_KEY. La notificación quedó registrada en la bandeja de salida sin enviarse.",
    };
  }

  // En modo `test` solo se envía a la allowlist: cualquier otro destinatario
  // (por ejemplo un empleado) queda SKIPPED y NUNCA se intenta la red. Es la
  // barrera que protege una demostración de enviar correos reales.
  if (!canEmailRecipient(message.to)) {
    return {
      status: "SKIPPED",
      provider,
      error:
        "Modo de prueba (MAIL_MODE distinto de 'production'): el destinatario " +
        "no está autorizado en MAIL_TEST_RECIPIENTS. No se envió ningún correo.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html ?? undefined,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        status: "FAILED",
        provider,
        error: `Resend ${response.status}: ${detail.slice(0, 300)}`,
      };
    }
    return { status: "SENT", provider };
  } catch (error) {
    return {
      status: "FAILED",
      provider,
      error: error instanceof Error ? error.message : "Error de red",
    };
  }
}
