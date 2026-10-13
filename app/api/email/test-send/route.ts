import { NextRequest, NextResponse } from "next/server";
import {
  emailMode,
  emailProviderName,
  sendEmail,
  testAllowedRecipients,
} from "@/lib/email/send";
import { isAuthorizedCronRequest } from "@/lib/security/cron-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envío de correo de PRUEBA para la demostración.
 *
 * No forma parte del flujo de negocio y NO toca la base de datos: solo
 * comprueba que la configuración de Resend funciona enviando un mensaje de
 * ejemplo a las direcciones autorizadas en `MAIL_TEST_RECIPIENTS`.
 *
 * Barreras:
 *  - requiere `CRON_SECRET` (cabecera `x-cron-secret` o `Authorization: Bearer`);
 *  - deshabilitado en modo `production` (409): en producción se usan los flujos
 *    reales, no este atajo;
 *  - sin proveedor de correo (`RESEND_API_KEY`) responde `skipped`;
 *  - sin `MAIL_TEST_RECIPIENTS` responde 400: nunca se envía a ciegas.
 *
 * Ejemplo:  GET /api/email/test-send   Header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (emailMode() === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: "disabled-in-production",
        message: "El endpoint de prueba está deshabilitado en modo producción.",
      },
      { status: 409 }
    );
  }

  if (emailProviderName() === "none") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "email-not-configured",
    });
  }

  const recipients = testAllowedRecipients();
  if (recipients.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-test-recipients",
        message: "Define MAIL_TEST_RECIPIENTS con las direcciones autorizadas.",
      },
      { status: 400 }
    );
  }

  const results: { to: string; status: string; provider: string }[] = [];
  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject: "Prueba de correo — Inventario de Equipos",
      text:
        "Este es un correo de prueba del modo de demostración de Inventario " +
        "de Equipos. Si lo ves, la configuración de Resend funciona.",
    });
    results.push({ to, status: result.status, provider: result.provider });
  }

  return NextResponse.json({ ok: true, mode: "test", results });
}
