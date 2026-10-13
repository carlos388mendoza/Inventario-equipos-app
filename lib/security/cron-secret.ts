import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Autorización de endpoints internos por `CRON_SECRET`.
 *
 * Se usa en el cron de seguimiento (`/api/cron/request-followups`) y en el
 * endpoint de correo de prueba (`/api/email/test-send`). El secreto llega en la
 * cabecera `x-cron-secret` o en `Authorization: Bearer <secreto>`.
 *
 * La comparación se hace en tiempo constante sobre resúmenes SHA-256, para que
 * el resultado no dependa de la longitud (que `timingSafeEqual` exige igual) ni
 * del contenido, evitando ataques de temporización.
 */

/** Secreto presentado en la cabecera dedicada o en `Authorization: Bearer`. */
export function providedSecret(request: NextRequest): string | null {
  const header = request.headers.get("x-cron-secret");
  if (header) return header;
  const authz = request.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) return authz.slice("Bearer ".length);
  return null;
}

/** Compara dos secretos en tiempo constante. */
export function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * ¿La petición presenta el `CRON_SECRET` correcto?
 * Sin `CRON_SECRET` configurado, siempre es `false` (no se autoriza nada).
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return secretsMatch(providedSecret(request), secret);
}
