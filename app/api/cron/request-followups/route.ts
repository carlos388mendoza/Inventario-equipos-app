import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipmentRequests, requestConfirmationTokens } from "@/lib/db/schema";
import {
  REQUEST_INSTALLATION_STATUS,
  REQUEST_STATUS,
} from "@/lib/db/enums";
import {
  loadRequestContext,
  sendInstallationFollowUp,
} from "@/lib/requests/notifications";
import { emailProviderName } from "@/lib/email/send";
import { isAuthorizedCronRequest } from "@/lib/security/cron-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron de seguimiento de instalación (issue #13).
 *
 * Busca solicitudes APROBADAS cuya fecha de seguimiento (aprobación + 5 días)
 * ya venció, que sigan con instalación pendiente y a las que aún no se les
 * envió el correo. Para cada una genera un token de confirmación y envía el
 * correo a la unidad.
 *
 * Protegido: debe llamarse con `x-cron-secret` (o `Authorization: Bearer`)
 * igual al valor de `CRON_SECRET`. Sin esa variable o sin coincidencia,
 * responde 401 y NO toca la base de datos.
 *
 * Concurrencia: antes de enviar, el cron "reclama" la fila con un UPDATE
 * condicional (`WHERE follow_up_sent_at IS NULL`). Si otra ejecución simultánea
 * ya la reclamó, `rowsAffected` es 0 y se omite: no se envían correos
 * duplicados.
 *
 * Si el envío no se puede procesar (ningún correo quedó en `SENT`), la
 * reclamación se libera (se vuelve a `followUpSentAt = null`) y el token de
 * confirmación creado se elimina: el seguimiento NO queda marcado como enviado
 * y se reintenta en la siguiente ejecución.
 *
 * Ejemplo de invocación (programar en Vercel Cron):
 *   GET /api/cron/request-followups   Header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  // La autorización se comprueba ANTES de cualquier consulta o efecto.
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sin proveedor de correo configurado no hay nada que enviar y, sobre todo,
  // no se debe reclamar ninguna fila: marcarla como enviada impediría el correo
  // real cuando más adelante se configure `RESEND_API_KEY`. Se sale sin tocar
  // la base de datos; el seguimiento pendiente se procesará entonces.
  if (emailProviderName() === "none") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "email-not-configured",
    });
  }

  const now = new Date();

  const due = await db
    .select({ id: equipmentRequests.id })
    .from(equipmentRequests)
    .where(
      and(
        eq(equipmentRequests.status, REQUEST_STATUS.APPROVED),
        eq(
          equipmentRequests.installationStatus,
          REQUEST_INSTALLATION_STATUS.PENDING
        ),
        lte(equipmentRequests.followUpDueAt, now),
        isNull(equipmentRequests.followUpSentAt)
      )
    );

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    // Reclama la fila de forma atómica: solo una ejecución concurrente gana.
    const claimedAt = new Date();
    const claim = await db
      .update(equipmentRequests)
      .set({ followUpSentAt: claimedAt, updatedAt: claimedAt })
      .where(
        and(
          eq(equipmentRequests.id, row.id),
          isNull(equipmentRequests.followUpSentAt)
        )
      );

    if (claim.rowsAffected === 0) {
      // Otra ejecución ya la reclamó (o dejó de estar vencida): no duplicar.
      continue;
    }

    try {
      const context = await loadRequestContext(row.id);
      if (!context) {
        failed += 1;
        continue;
      }
      const result = await sendInstallationFollowUp(context);
      if (result.sent > 0 || result.recipients.length === 0) {
        sent += 1;
      } else {
        // Ningún correo llegó a enviarse: se libera la reclamación para que el
        // seguimiento no quede marcado como enviado y pueda reintentarse, y se
        // elimina el token de confirmación huérfano (nadie recibió el enlace).
        failed += 1;
        await releaseFollowUpClaim(row.id, claimedAt);
        if (result.tokenId) {
          await db
            .delete(requestConfirmationTokens)
            .where(eq(requestConfirmationTokens.id, result.tokenId));
        }
      }
    } catch {
      // El error queda registrado en la bandeja de salida (estado FAILED) y se
      // libera la reclamación: no se da por enviado y se reintentará.
      failed += 1;
      await releaseFollowUpClaim(row.id, claimedAt);
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}

/**
 * Revierte la marca de seguimiento SOLO si sigue siendo la reclamación hecha
 * (y no se ha sobrescrito por otra ejecución).
 */
async function releaseFollowUpClaim(requestId: string, claimedAt: Date) {
  await db
    .update(equipmentRequests)
    .set({ followUpSentAt: null })
    .where(
      and(
        eq(equipmentRequests.id, requestId),
        eq(equipmentRequests.followUpSentAt, claimedAt)
      )
    );
}
