import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipmentRequests } from "@/lib/db/schema";
import {
  REQUEST_INSTALLATION_STATUS,
  REQUEST_STATUS,
} from "@/lib/db/enums";
import {
  loadRequestContext,
  sendInstallationFollowUp,
} from "@/lib/requests/notifications";
import { emailProviderName } from "@/lib/email/send";

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
 * duplicados. El envío es de un solo intento por solicitud (a lo sumo una vez).
 *
 * Ejemplo de invocación (programar en Vercel Cron):
 *   GET /api/cron/request-followups   Header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = providedSecret(request);

  // La autorización se comprueba ANTES de cualquier consulta o efecto.
  if (!secret || !secretsMatch(provided, secret)) {
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
      await sendInstallationFollowUp(context);
      sent += 1;
    } catch {
      // El error queda registrado en la bandeja de salida (estado FAILED);
      // no se reintenta de forma indefinida ni se expone el secreto.
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}

/** Secreto presentado en la cabecera dedicada o en `Authorization: Bearer`. */
function providedSecret(request: NextRequest): string | null {
  const header = request.headers.get("x-cron-secret");
  if (header) return header;
  const authz = request.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) return authz.slice("Bearer ".length);
  return null;
}

/**
 * Compara dos secretos en tiempo constante.
 *
 * Se comparan los resúmenes SHA-256 para que la comprobación no dependa de la
 * longitud (que `timingSafeEqual` exige igual) ni del contenido, evitando
 * ataques de temporización. `timingSafeEqual` existe en el runtime Node.js que
 * usa esta ruta (`export const runtime = "nodejs"`).
 */
function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
