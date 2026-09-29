/**
 * Constantes públicas del sitio, compartidas por metadata, robots y sitemap.
 *
 * Se separan de `appBaseUrl()` (lib/utils.ts) a propósito: aquella resuelve la
 * URL en tiempo de ejecución para construir enlaces de etiqueta y su respaldo es
 * `localhost`, porque en desarrollo ese es el destino correcto. Aquí, en cambio,
 * el respaldo es la URL de producción, para que un build sin variables de
 * entorno no emita canonical, robots ni sitemap apuntando a `localhost`.
 *
 * Es un módulo sin efectos: se importa tanto desde el layout raíz como desde las
 * rutas de metadata, y ninguna de ellas consulta la base de datos.
 */

/** Origen público canónico, sin barra final. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://inventario-equipos-app.vercel.app";

export const SITE_NAME = "Inventario de Equipos";

export const SITE_ORGANIZATION = "Grupo Comidas";

export const SITE_TITLE = "Inventario de Equipos — Grupo Comidas";

export const SITE_DESCRIPTION =
  "Sistema web de gestión de inventario de equipos, solicitudes de compra y " +
  "reemplazo, movimientos entre restaurantes, etiquetas de seguridad con QR e " +
  "impresión ZPL para las unidades de Grupo Comidas.";

/**
 * Rutas privadas del panel. Se listan en `app/robots.ts` para que los crawlers no
 * las recorran. La autorización real no depende de esto: cada página y cada
 * server action vuelven a comprobar sesión y rol en el servidor.
 */
export const PRIVATE_PATHS = [
  "/dashboard",
  "/equipment",
  "/equipment-types",
  "/inventory",
  "/movements",
  "/requests",
  "/my-requests",
  "/statistics",
  "/labels",
  "/restaurants",
  "/users",
  "/settings",
  "/api",
  "/e",
] as const;

/** Única página de contenido público indexable del sitio. */
export const PUBLIC_LANDING_PATH = "/inicio";

export const PUBLIC_LANDING_URL = `${SITE_URL}${PUBLIC_LANDING_PATH}`;
