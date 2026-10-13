/**
 * Predicado para detectar el error lanzado por `redirect()` de next/navigation.
 *
 * En desarrollo `error.message === "NEXT_REDIRECT"`; en producción Next.js lo
 * reemplaza por el digest (`NEXT_REDIRECT;...`). Los bloques `try/catch` de las
 * server actions no deben interceptarlo: si una guarda (`requireUser`/
 * `requireRole`) redirige, la redirect debe propagarse y NO convertirse en un
 * resultado `{ ok: false }` que nunca llega al cliente.
 */
export function isNextRedirect(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "NEXT_REDIRECT" ||
      error.message.startsWith("NEXT_REDIRECT"))
  );
}