import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, SITE_URL } from "@/lib/site";

/**
 * robots.txt del sitio.
 *
 * El panel es una aplicación interna: se abre a los crawlers solo la página
 * pública /inicio. Las áreas privadas se listan una por una para que la
 * señal sea explícita y auditable, en vez de un `Disallow: /` que además
 * impediría indexar esa landing.
 *
 * Esto es una ayuda de rastreo, NO el control de acceso: cada página y cada
 * server action siguen validando sesión y rol en el servidor.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATHS],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
