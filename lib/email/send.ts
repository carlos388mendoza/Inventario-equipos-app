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
 * Variables de entorno (nombres en `.env.example`, valores NUNCA en el repo):
 *  - `RESEND_API_KEY`          clave del proveedor (habilita el envío real).
 *  - `MAIL_FROM`               remitente verificado.
 *  - `REQUEST_APPROVER_EMAILS` destinatarios de aprobación (Damaris), separados
 *                              por comas; si falta, se usan los ADMIN activos.
 */

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
  return (
    process.env.MAIL_FROM ||
    "Inventario de Equipos <no-reply@inventario-equipos.local>"
  );
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
