import type { MetadataRoute } from "next";
import { PUBLIC_LANDING_URL } from "@/lib/site";

/**
 * Sitemap con la única URL pública de contenido.
 *
 * No se incluyen ni /login ni las páginas del panel: el login ya declara
 * `noindex` y el panel exige sesión, de modo que ninguna de las dos es
 * indexable. Tampoco se incluyen las páginas /e/[token] de etiqueta, que son
 * secretas por token y además están en `noindex`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: PUBLIC_LANDING_URL,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
