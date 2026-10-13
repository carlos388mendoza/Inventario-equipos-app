"use server";

import { eq } from "drizzle-orm";
import { revalidateRequestViews } from "@/lib/revalidate";
import { db } from "@/lib/db";
import {
  equipmentRequests,
  requestConfirmationTokens,
} from "@/lib/db/schema";
import {
  REQUEST_INSTALLATION_STATUS,
  REQUEST_STATUS,
} from "@/lib/db/enums";
import {
  loadRequestContext,
  notifyInstallationResult,
} from "@/lib/requests/notifications";

export type ConfirmationActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Confirma cómo quedó la instalación de una solicitud aprobada (issue #13).
 *
 * Es público por diseño: el único "secreto" es el token opaco del enlace del
 * correo. El token es de un solo uso y este endpoint lo invalida al usarse.
 */
export async function submitInstallationConfirmation(input: {
  token: string;
  confirmed: boolean;
}): Promise<ConfirmationActionResult> {
  try {
    const now = new Date();

    const rows = await db
      .select({
        tokenId: requestConfirmationTokens.id,
        requestId: requestConfirmationTokens.requestId,
        purpose: requestConfirmationTokens.purpose,
        expiresAt: requestConfirmationTokens.expiresAt,
        usedAt: requestConfirmationTokens.usedAt,
        requestStatus: equipmentRequests.status,
        installationStatus: equipmentRequests.installationStatus,
      })
      .from(requestConfirmationTokens)
      .innerJoin(
        equipmentRequests,
        eq(requestConfirmationTokens.requestId, equipmentRequests.id)
      )
      .where(eq(requestConfirmationTokens.token, input.token))
      .limit(1);

    const token = rows[0];
    if (!token) return { ok: false, error: "Enlace no válido." };
    if (token.purpose !== "INSTALLATION_FOLLOWUP") {
      return { ok: false, error: "Enlace no válido." };
    }
    if (token.usedAt) {
      return { ok: false, error: "Este enlace ya fue utilizado." };
    }
    if (token.expiresAt.getTime() < now.getTime()) {
      return { ok: false, error: "Este enlace ha caducado." };
    }
    if (token.requestStatus !== REQUEST_STATUS.APPROVED) {
      return { ok: false, error: "La solicitud ya no está aprobada." };
    }
    if (token.installationStatus !== REQUEST_INSTALLATION_STATUS.PENDING) {
      return { ok: false, error: "La instalación ya fue confirmada." };
    }

    const update: Record<string, unknown> = {
      installationStatus: input.confirmed
        ? REQUEST_INSTALLATION_STATUS.CONFIRMED
        : REQUEST_INSTALLATION_STATUS.NOT_INSTALLED,
      updatedAt: now,
    };
    if (input.confirmed) {
      update.installationConfirmedAt = now;
    }

    await db
      .update(equipmentRequests)
      .set(update)
      .where(eq(equipmentRequests.id, token.requestId));

    await db
      .update(requestConfirmationTokens)
      .set({ usedAt: now })
      .where(eq(requestConfirmationTokens.id, token.tokenId));

    // La notificación es posterior al cambio ya aplicado y al token ya usado: no
    // puede ocultar el resultado (el outbox guarda el fallo si ocurre).
    try {
      const context = await loadRequestContext(token.requestId);
      if (context) await notifyInstallationResult(context, input.confirmed);
    } catch {
      // se ignora: la confirmación ya quedó registrada.
    }

    revalidateRequestViews();

    return {
      ok: true,
      message: input.confirmed
        ? "Gracias: la instalación quedó confirmada."
        : "Gracias: quedó registrado que el equipo aún no se ha instalado.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo procesar la confirmación.",
    };
  }
}