import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/security/csp";

/**
 * Cabeceras de seguridad por petición (Next 16 renombró `middleware` a
 * `proxy`).
 *
 * La CSP lleva un `nonce` distinto en cada respuesta; el layout raíz lee el
 * mismo valor desde `x-nonce` para pasárselo al script de `next-themes`. Por eso
 * el panel y `/inicio` se renderizan de forma dinámica: un nonce solo puede
 * inyectarse al servir, no en build time.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, {
    isDev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  // Next lee la CSP de la petición para aplicar el nonce a sus propios scripts;
  // `x-nonce` es el canal para los scripts de terceros (aquí, next-themes).
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    /*
     * Todas las rutas salvo:
     * - `api`: las respuestas JSON no ejecutan scripts.
     * - `_next/static` y `_next/image`: assets inmutables.
     * - `sw.js` y `offline.html`: el service worker y la página sin conexión se
     *   sirven tal cual (la offline usa un `onclick` en línea que la CSP
     *   bloquearía).
     *
     * Los prefetch del router quedan fuera (`missing`): reutilizan una
     * navegación ya generada y no deben recibir un nonce nuevo.
     */
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sw.js|offline.html).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
