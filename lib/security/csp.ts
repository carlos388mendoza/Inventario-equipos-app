/**
 * Política de seguridad de contenido (CSP) del sitio.
 *
 * Se calcula aquí, fuera de `proxy.ts`, para poder probarla sin el runtime de
 * Next: la función es pura y solo recibe el `nonce` de la petición.
 *
 * Decisiones:
 * - `script-src` exige `nonce`. Junto con `'strict-dynamic'`, deja que el script
 *   autorizado cargue los chunks de Next sin listar cada archivo y bloquea
 *   cualquier script en línea inyectado. El layout raíz lee el mismo nonce para
 *   el script de `next-themes`.
 * - `style-src` incluye `'unsafe-inline'`: Radix escribe la posición de los
 *   popovers en atributos `style` y `next/font` inyecta estilos en línea; los
 *   atributos `style` no admiten nonce, así que no hay alternativa. Nunca se
 *   permite en `script-src`.
 * - `connect-src` abre `localhost:9100` porque ahí escucha Zebra Browser Print,
 *   el puente hacia la impresora ZPL.
 * - No se emite `upgrade-insecure-requests`: forzaría `http://localhost:9100`
 *   (impresora local) y el `next dev` en claro a HTTPS.
 */
export interface CspOptions {
  isDev?: boolean;
}

export function buildContentSecurityPolicy(
  nonce: string,
  options: CspOptions = {}
): string {
  const { isDev = false } = options;

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  // En desarrollo React usa `eval` para reconstruir los stack traces del
  // servidor en el navegador; sin `'unsafe-eval'` el panel no arranca con
  // `next dev`. En producción React y Next no usan `eval`.
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const connectSrc = [
    "'self'",
    "https://localhost:9100",
    "http://localhost:9100",
  ];
  // El recargado en caliente de `next dev` abre un WebSocket contra el mismo
  // host; `'self'` no cubre el esquema `ws:`.
  if (isDev) connectSrc.push("ws:", "wss:");

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    ["connect-src", connectSrc],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
  ];

  return directives
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
