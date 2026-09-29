# SEO y exposición pública

Documento para profesor y visitante. Explica qué es visible para un buscador en
este proyecto, qué no, y qué falta para que Google lo indexe.

---

## 1. El problema

El sitio es una **aplicación interna**: casi todo exige sesión. En el estado
inicial de la auditoría, el proyecto **no tenía `robots.txt` ni `sitemap.xml`**, y
la única página pública sin sesión (la ficha del QR) estaba en `noindex`.

Resultado: un buscador que llega a la URL de producción se encuentra con un
redireccionamiento a `/login`, un formulario de acceso, y nada más. No hay nada
que indexar.

---

## 2. La estrategia aplicada

Un sistema interno no debe indexar su panel. Pero sí puede —y debe— tener **una
página pública** que explique qué es, para que un docente, un visitante o un
buscador entienda de qué se trata.

| Pieza | Qué hace |
|---|---|
| **Una sola página indexable** | `/inicio`, una landing estática. |
| **Todo lo demás, cerrado** | 14 rutas privadas en `robots.txt`, y `noindex` en login y ficha QR. |
| **Un sitemap mínimo** | Solo `/inicio`. |
| **Metadata completa** | Título, descripción, keywords, Open Graph, Twitter Card, Apple Web App. |
| **URL canónica única** | Declarada en un solo sitio (`lib/site.ts`). |

---

## 3. La página pública: `/inicio`

`app/inicio/page.tsx` es **estática** (`○` en el build: se prerenderiza).

Por qué no consulta la base de datos: si la landing leyera la BD, cada visita de un
crawler abriría una conexión a Turso, y la página dejaría de ser pública para
convertirse en un endpoint que depende de la producción. No vale la pena: el
contenido es descriptivo, no un contador.

Qué contiene:

- Qué es el sistema y para qué sirve.
- Los seis módulos, descritos sin cifras ni datos de ninguna unidad.
- Tres principios de construcción (autorización en servidor, QR opaco, historial
  que no se reescribe).
- El stack, en lenguaje llano.
- Un enlace a `/login`.

**Lo que deliberadamente NO contiene:**

- Ninguna cifra de la base de datos (ni número de equipos, ni de restaurantes, ni
  de solicitudes).
- Ninguna ruta del panel. Solo enlaza a `/login`.
- Ningún nombre de unidad, marca con datos asociados, ni token.
- Ningún dato de ninguna persona.

Es una página de presentación, no un panel de control abierto.

---

## 4. `robots.txt`

Generado por `app/robots.ts`. Comprobado sobre el build real:

```
User-Agent: *
Allow: /
Disallow: /dashboard
Disallow: /equipment
Disallow: /equipment-types
Disallow: /inventory
Disallow: /movements
Disallow: /requests
Disallow: /my-requests
Disallow: /statistics
Disallow: /labels
Disallow: /restaurants
Disallow: /users
Disallow: /settings
Disallow: /api
Disallow: /e

Host: https://inventario-equipos-app.vercel.app
Sitemap: https://inventario-equipos-app.vercel.app/sitemap.xml
```

Dos decisiones que conviene explicar:

**`Allow: /` en lugar de bloquearlo todo.** Un `Disallow: /` global impediría
indexar la landing. Lo correcto es permitir y excluir ruta por ruta.

**Las 14 rutas se listan una a una**, aunque `Disallow: /equipment` ya cubre
`/equipment/new` y `/equipment/[id]`. Es deliberado: una lista explícita es
auditable. Si alguien añade una sección nueva al panel, tiene que acordarse de
añadirla aquí, y esa es la parte que se quiere que sea visible.

**`robots.txt` no es seguridad.** Es una ayuda de rastreo. Un `Disallow` no
impide entrar a nadie: quien construya a mano una URL a `/users` sin sesión sigue
topando con `requireUser()`. La seguridad real es la del servidor.

---

## 5. `sitemap.xml`

Generado por `app/sitemap.ts`. Contiene **una** URL:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://inventario-equipos-app.vercel.app/inicio</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

No incluye `/login` (está en `noindex`), ni las rutas del panel, ni las fichas
`/e/[token]`, que además son secretas por token.

---

## 6. Metadata

`app/layout.tsx` define:

| Campo | Valor |
|---|---|
| `metadataBase` | `https://inventario-equipos-app.vercel.app` |
| `title` | Default + plantilla `%s \| Grupo Comidas` |
| `description` | Descripción del sistema |
| `keywords` | 8 términos en español |
| `alternates.canonical` | `/` en la raíz, `/inicio` en la landing |
| `openGraph` | `website`, `es_MX`, imagen 1399×501, `siteName` |
| `twitter` | `summary_large_image` |
| `appleWebApp` | Instalable como app |
| `formatDetection` | Sin detección de teléfono |

`metadataBase` es lo que permite que las rutas relativas de `canonical` y las
imágenes de Open Graph se resuelvan a URL absolutas. Sin él, Next avisa en el
build.

La imagen social es el logo corporativo completo, que es 1399×501. No es la
proporción 1.91:1 que algunos recommendan, pero es el asset que existe y es el
que se lee sin recortarse.

### Páginas con `noindex`

| Página | Declaración | Por qué |
|---|---|---|
| `/login` | `noindex, follow` | Es accesible para rastrear, pero no debe ocupar resultado. |
| `/e/[token]` | `noindex, follow` | Las etiquetas no se indexan. `follow` para que el rastreador pueda seguir los enlaces públicos. |

---

## 7. `lib/site.ts`: una sola fuente de verdad

```ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://inventario-equipos-app.vercel.app";

export const PRIVATE_PATHS = [/* 14 rutas */] as const;
```

Layout, robots y sitemap leen de aquí. Así es **imposible** que el canonical apunte
a un sitio y el sitemap a otro: si se cambia la URL, se cambia en un único lugar.

El respaldo es la URL de producción, no `localhost`, para que un build sin
variables de entorno no emita canonical ni sitemap apuntando al ordenador de
alguien.

---

## 8. Estado de la indexación: preparado, no indexado

> **El sitio está preparado para indexación. No se ha verificado que Google ni
> Bing lo hayan indexado, y no se afirma que lo estén.**

El código hace su parte. Para que un buscador lo encuentre hay que darlo de alta a
mano, y eso no se puede hacer desde el repositorio.

### Google Search Console

1. Entrar en [search.google.com/search-console](https://search.google.com/search-console).
2. **Añadir propiedad** → tipo **Dominio** (o **Prefijo de URL** si se prefiere).
3. Verificar por DNS (lo más fiable) o por archivo de verificación.
4. En **Sitemaps**, enviar `https://inventario-equipos-app.vercel.app/sitemap.xml`.
5. En **Inspección de URL**, comprobar `/inicio`.
6. En **Indexación**, usar **Solicitar indexación** sobre `/inicio`.

**El dominio no tiene código de verificación** en el repositorio, y no se ha
inventado ninguno. Se añade en Search Console y se coloca en `metadata` si se
quiere que aparezca en la página.

### Bing Webmaster Tools

1. Entrar en [bing.com/webmasters](https://www.bing.com/webmasters).
2. **Importar desde GSC** es lo más rápido si ya se configuró Google.
3. Enviar el mismo `sitemap.xml`.

### Después

- La indexación no es inmediata: puede tardar días o semanas.
- `/inicio` es la única URL que debe aparecer. Si aparece otra, es un bug de
  configuración.
- Los `Disallow` de `robots.txt` **no** limpian resultados existentes: si alguna
  vez se indexó algo del panel, hay que pedir su eliminación en Search Console.

---

## 9. Cómo comprobarlo sin desplegar

```bash
npm run build

# Contenido exacto de robots.txt
Get-Content .next/server/app/robots.txt.body

# Contenido exacto de sitemap.xml
Get-Content .next/server/app/sitemap.xml.body
```

Y con la app levantada:

```bash
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml
curl -sI http://localhost:3000/inicio | Select-String -i "x-robots-tag"
```

Para la metadata, hay que mirar el `<head>` renderizado: el canonical debe ser
una URL absoluta, y `og:` / `twitter:` deben estar presentes.

---

## 10. Limitaciones

- **No hay analítica.** No hay Google Analytics ni nada equivalente. Si se quiere
  medir visitas, hay que añadirlo (con las consideraciones de privacidad que
  implica).
- **Sin `next/image` para la imagen social.** Las imágenes de Open Graph necesitan
  una URL, no un componente.
- **El service worker cachea navegaciones.** `public/sw.js` guarda en caché las
  navegaciones servidas con éxito. Como solo afecta al navegador de cada visitante
  (no al rastreador, que no ejecuta service workers), no afecta a la indexación.
- **Un solo idioma.** Todo el contenido es en español (`lang="es"`, `og:locale` =
  `es_MX`). No hay `hreflang` porque no hay versión en otro idioma.
