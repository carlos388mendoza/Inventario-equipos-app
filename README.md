# Inventario de Equipos — Grupo Comidas

Sistema web interno para que las unidades (restaurantes) de Grupo Comidas
soliciten compras y reemplazos de equipos, y para que IT y administración
gestionen el inventario, los movimientos entre unidades, las etiquetas de
seguridad con QR y las estadísticas.

- **Producción:** <https://inventario-equipos-app.vercel.app>
- **Página pública (indexable):** <https://inventario-equipos-app.vercel.app/inicio>
- **Acceso:** por cuenta autorizada. **No hay registro público.**

> Este README describe el sistema **tal como está en el código**. Cuando una
> funcionalidad se pidió y no existe, o no se puede comprobar desde el
> repositorio, se dice explícitamente en lugar de presuponerla.

---

## Índice

1. [Qué hace](#qué-hace)
2. [Stack tecnológico](#stack-tecnológico)
3. [Roles y permisos](#roles-y-permisos)
4. [Mapa de rutas](#mapa-de-rutas)
5. [Modelo de datos](#modelo-de-datos)
6. [Movimientos de inventario](#movimientos-de-inventario)
7. [Etiquetas, QR e impresión](#etiquetas-qr-e-impresión)
8. [Inteligencia artificial](#inteligencia-artificial)
9. [Instalación y desarrollo local](#instalación-y-desarrollo-local)
10. [Variables de entorno](#variables-de-entorno)
11. [Scripts disponibles](#scripts-disponibles)
12. [Migraciones](#migraciones)
13. [Pruebas y calidad](#pruebas-y-calidad)
14. [SEO y exposición pública](#seo-y-exposición-pública)
15. [Seguridad](#seguridad)
16. [Datos actuales en producción](#datos-actuales-en-producción)
17. [Historial: qué pasó con PH01](#historial-qué-pasó-con-ph01)
18. [Limitaciones conocidas](#limitaciones-conocidas)
19. [Documentación adicional](#documentación-adicional)

---

## Qué hace

| Módulo | Qué resuelve |
|---|---|
| **Panel** (`/dashboard`) | Resumen: equipos por estado y restaurante, etiquetas emitidas, solicitudes pendientes y decididas. |
| **Inventario** (`/equipment`) | Listado de equipos individuales con búsqueda, filtros por tipo/estado/restaurante y ficha por equipo. |
| **Inventario por documento** (`/inventory`) | Vista de los Excel de origen: equipos individuales (`equipment`) y agregados por rubro (`equipment_groups`). |
| **Solicitudes** (`/requests`) | Compra y reemplazo. Estados con historial de cambios; los usuarios de restaurante solo ven las suyas. |
| **Mis solicitudes** (`/my-requests`) | Vista propia del usuario de restaurante, con su historial. |
| **Movimientos** (`/movements`) | Traslado, jalado, préstamo, devolución, copia, sustitución y archivado, más el libro de movimientos. |
| **Etiquetas / QR** (`/labels`) | Emisión de etiqueta de seguridad por equipo, vista previa, QR e impresión ZPL. |
| **Estadísticas** (`/statistics`) | Indicadores de inventario y solicitudes, y asistente de IA que responde sobre datos reales. |
| **Restaurantes** (`/restaurants`) | Alta, edición y activación de unidades. Solo ADMIN. |
| **Tipos de equipo** (`/equipment-types`) | Catálogo CRUD. Solo ADMIN. |
| **Usuarios** (`/users`) | Alta, edición y activación de cuentas con rol y restaurante. Solo ADMIN. |
| **Ajustes** (`/settings`) | Preferencias de tema y densidad de tablas, guardadas **en el dispositivo**. |
| **Ficha pública** (`/e/[token]`) | Lo que ve quien escanea el QR. Sin sesión y con datos mínimos. |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.3.5 (App Router, Server Components) |
| UI | React 19.2.8, TypeScript estricto, Tailwind CSS v4, Radix UI |
| Autenticación | Better Auth 1.7.5 (correo + contraseña, registro deshabilitado) |
| Base de datos | Turso (libSQL) con Drizzle ORM 0.45.2 |
| IA | AI SDK 7 (`ai` + `@ai-sdk/openai`) contra OpenRouter |
| Impresión | `zebra-browser-print-wrapper` + generador ZPL propio |
| Gráficos | Recharts |
| Validación | Zod v4 |
| Pruebas | Vitest 5 |
| Despliegue | Vercel |

No hay `middleware.ts`: la protección de rutas se aplica en el layout de cada
grupo y, sobre todo, **en cada página y cada server action**. Ver
[Seguridad](#seguridad).

---

## Roles y permisos

Los roles se guardan en `user.role` con estos valores exactos:

| Valor | Significado |
|---|---|
| `ADMIN` | Administrador |
| `RESTAURANT_USER` | Usuario de restaurante |
| `IT_MANAGER` | IT Manager |

| Capacidad | ADMIN | IT_MANAGER | RESTAURANT_USER |
|---|:--:|:--:|:--:|
| Ver todo su restaurante | ✅ | ✅ (todos) | ✅ (solo el suyo) |
| Crear solicitudes | ✅ | ✅ | ✅ (propias) |
| Cambiar estado de solicitudes | ✅ | ✅ | ❌ |
| Ver todas las solicitudes | ✅ | ✅ | ❌ |
| Gestionar inventario (crear/editar) | ✅ | ✅ | ❌ |
| Movimientos de inventario | ✅ | ✅ | ❌ |
| Etiquetas e impresión ZPL | ✅ | ✅ | ❌ |
| Estadísticas | ✅ | ✅ | ❌ |
| Asistente de estadísticas (IA) | ✅ | ✅ | ❌ |
| Solicitud por voz (IA) | ✅ | ✅ | ✅ (dentro de su alcance) |
| Restaurantes, tipos, usuarios | ✅ | ❌ | ❌ |
| Ajustes | ✅ | ✅ | ✅ |

`RESTAURANT_USER` queda atado a un `user.restaurantId`. Si no tiene restaurante
asignado, **no puede crear solicitudes** (se lo dice la propia acción, no la
interfaz).

En `AGENTS.md` los roles aparecían en minúsculas; los valores reales en base de
datos y en el código (`lib/db/enums.ts`) van en **mayúsculas**.

---

## Mapa de rutas

Rutas públicas (sin sesión):

| Ruta | Descripción | Indexable |
|---|---|:--:|
| `/` | Redirige a `/dashboard` si hay sesión, si no a `/login` | ❌ |
| `/inicio` | Landing pública del sistema | ✅ |
| `/login` | Formulario de acceso | ❌ (`noindex`) |
| `/e/[token]` | Ficha pública del equipo por token de etiqueta | ❌ (`noindex`) |
| `/robots.txt` | Generado por `app/robots.ts` | — |
| `/sitemap.xml` | Generado por `app/sitemap.ts` | — |
| `/manifest.webmanifest` | PWA | — |

Rutas privadas (requieren sesión; el grupo `(dashboard)` exige `requireUser()`):

| Ruta | Rol mínimo |
|---|---|
| `/dashboard` | Cualquiera |
| `/equipment` | Cualquiera (datos filtrados por alcance) |
| `/equipment/new` | ADMIN, IT_MANAGER |
| `/equipment/[id]` | Cualquiera (datos filtrados por alcance) |
| `/equipment/[id]/edit` | ADMIN, IT_MANAGER |
| `/equipment-types` | ADMIN |
| `/inventory` | Cualquiera (datos filtrados por alcance) |
| `/labels` | ADMIN, IT_MANAGER |
| `/movements` | ADMIN, IT_MANAGER |
| `/requests` | Cualquiera (datos filtrados por alcance) |
| `/my-requests` | Cualquiera (solo lo propio) |
| `/restaurants` | ADMIN |
| `/settings` | Cualquiera |
| `/statistics` | ADMIN, IT_MANAGER |
| `/users` | ADMIN |

Endpoints API:

| Ruta | Acceso |
|---|---|
| `/api/auth/[...all]` | Better Auth (correo + contraseña) |
| `/api/ai/stats-agent` | ADMIN, IT_MANAGER |
| `/api/ai/voice-request` | ADMIN, IT_MANAGER, RESTAURANT_USER (dentro de su alcance) |

---

## Modelo de datos

13 tablas. Las cuatro primeras son de Better Auth; las nueve siguientes son de la
aplicación.

### Better Auth

| Tabla | Campos propios de la app |
|---|---|
| `user` | `role`, `restaurantId`, `active` |
| `session` | — |
| `account` | — |
| `verification` | — |

Los tres campos propios se declaran con `input: false`, así que **el cliente no
puede fijarse su propio rol ni su restaurante al registrarse o editarse**.

### Aplicación

| Tabla | Qué representa |
|---|---|
| `restaurants` | Unidad/restaurante. Código único, marca, sector y logo. |
| `equipment_types` | Catálogo de tipos (Television, HME, Impresora Zebra…). |
| `equipment` | Equipo físico individual. |
| `equipment_groups` | Fila agregada por rubro de un documento (Denny's). |
| `equipment_requests` | Solicitud de compra o reemplazo. |
| `request_history` | Cambio de estado de una solicitud. |
| `equipment_history` | Evento de la vida de un equipo. |
| `equipment_movements` | Libro de movimientos. |
| `security_labels` | Etiqueta de seguridad: un token opaco por equipo. |

Puntos de diseño que conviene conocer:

- **`equipment.restaurantId` es DÓNDE está el equipo; `equipment.ownerRestaurantId`
  es DE QUIÉN es.** Solo se separan durante un préstamo vigente. `NULL` significa
  "el propietario es la unidad donde está".
- **Trazabilidad al documento original**: `source_document`, `source_short_code`,
  `source_description`, `source_qr_code`, `source_technician` y `source_date_text`
  guardan el dato **verbatim** del Excel, sin normalizar. Los códigos cortos del
  original vienen repetidos y por eso **no** son únicos.
- **`equipment_groups` existe a propósito.** Una fila de `DNS19.xlsx` cubre N
  unidades idénticas de un rubro: no identifica un equipo, así que no puede tener
  etiqueta, QR ni solicitud. Meterla en `equipment` obligaría a duplicar filas y
  perdería el valor del documento.
- **`equipment_movements` es auditoría.** Sus referencias a `equipment` **no**
  tienen `onDelete: cascade`: el libro sobrevive al borrado de un equipo.
- **`security_labels`** tiene `uniqueIndex` tanto en `token` como en
  `equipmentId`: nunca hay dos etiquetas para el mismo equipo.

Hay 5 migraciones aplicadas en `lib/db/migrations/`. Detalle en
[`docs/BASE-DE-DATOS.md`](docs/BASE-DE-DATOS.md).

---

## Movimientos de inventario

El sistema registra **6 tipos de movimiento** en `equipment_movements` y ofrece
**7 operaciones** al usuario: las 6 más el archivado.

| # | Operación | Tipo | Efecto |
|---|---|---|---|
| 1 | **Traslado** | `TRANSFER` | El equipo pasa a ser de la unidad destino. |
| 2 | **Jalado** | `PULL` | Igual que traslado, con otra intención: traer el equipo de vuelta. |
| 3 | **Préstamo** | `LOAN_OUT` | El propietario **no** cambia; se fija `ownerRestaurantId`. |
| 4 | **Devolución** | `LOAN_RETURN` | Vuelve al propietario y `ownerRestaurantId` vuelve a `NULL`. |
| 5 | **Copia** | `COPY` | Crea un equipo nuevo. El original no se mueve ni pierde su serie ni su etiqueta. |
| 6 | **Sustitución** | `REPLACEMENT` | Crea el sustituto y marca el original con `replacedByEquipmentId`. |
| 7 | **Archivado** | *(no es movimiento)* | Pasa el equipo a `RETIRED` y anota el motivo en `equipment_history`. |

El archivado **no** escribe en `equipment_movements` a propósito: no es un cambio
de ubicación, es una baja. Conserva el QR, el historial y el libro.

Además existe el **movimiento masivo**, que no es un séptimo tipo sino la misma
operación aplicada a varios equipos en un lote: agrupa con `batch_id` para que
"moví 12 equipos a la vez" sea una sola entrada consultable.

Todas las acciones viven en `app/(dashboard)/equipment/movements/actions.ts`,
exigen `ADMIN` o `IT_MANAGER` y corren dentro de una transacción. El servidor
decide lo que la interfaz no puede: si el equipo está prestado, si el código de
una copia está libre, si el destino es válido.

Reglas completas en [`docs/MOVIMIENTOS.md`](docs/MOVIMIENTOS.md).

---

## Etiquetas, QR e impresión

- Cada equipo puede tener **una** etiqueta de seguridad (`security_labels`).
- El token es un **UUID sin guiones** (32 caracteres hexadecimales), no el
  identificador del equipo. Quien tenga el QR no puede deducir nada del inventario.
- La URL del QR es `/e/<token>` y se genera con `NEXT_PUBLIC_APP_URL`.
- La ficha pública **muestra solo**: código de activo, tipo, marca/modelo,
  restaurante asignado (con logo), fecha de instalación y estado.
  **Nunca** muestra número de serie, notas, documento de origen ni datos de
  usuarios. Busca por `token`, jamás por `id`.
- La impresión usa **Zebra Browser Print** (servicio local del navegador) a
  través de `zebra-browser-print-wrapper`, enviando ZPL generado por el módulo
  propio `lib/zpl/`.
- El módulo ZPL está **congelado por hash**: `lib/zpl/graphics.generated.ts` debe
  mantener SHA-256
  `EA185E75E01164E1B95C95B16F8332A09569CFB2AC59E77F03A38DAE663F6504`, y hay un
  test (`lib/zpl/zpl-lock.test.ts`) que lo verifica.

Detalle en [`docs/ETIQUETAS-Y-QR.md`](docs/ETIQUETAS-Y-QR.md).

---

## Inteligencia artificial

Dos funciones, ambas con el mismo patrón de seguridad:

| Función | Ruta | Qué hace |
|---|---|---|
| **Asistente de estadísticas** | `/api/ai/stats-agent` | Responde preguntas sobre inventario y solicitudes usando **tools con consultas predefinidas** (Drizzle). |
| **Solicitud por voz** | `/api/ai/voice-request` | Transcribe la petición del usuario a los campos de una solicitud (tipo, prioridad, motivo, equipo a reemplazar). |

- El modelo **nunca genera SQL**: solo elige entre herramientas ya escritas.
- El proveedor es **OpenRouter** (`lib/ai/openrouter.ts`), con
  `openai/gpt-4o-mini` por defecto.
- Si falta `OPENROUTER_API_KEY`, la app **sigue funcionando** y las funciones de
  IA se deshabilitan con un mensaje claro.
- La solicitud por voz respeta el alcance: un `RESTAURANT_USER` solo puede crear
  para su restaurante.

---

## Instalación y desarrollo local

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
cp .env.example .env.local     # en Windows: copy .env.example .env.local
# Completa .env.local
npm run dev                    # http://localhost:3000
```

Para trabajar **sin cuenta de Turso**, `.env.local` puede usar la base local:

```
TURSO_DATABASE_URL=file:./data/local.db
TURSO_AUTH_TOKEN=
```

`data/` está en `.gitignore`: la base local nunca se sube.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción. |
| `npm run start` | Sirve el build de producción. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run test` | Vitest, una sola pasada. |
| `npm run db:generate` | Genera una migración a partir del esquema. |
| `npm run db:migrate` | Aplica las migraciones pendientes. |
| `npm run db:push` | Empuja el esquema sin generar migración (desarrollo). |
| `npm run db:studio` | Drizzle Studio. |
| `npm run db:seed` / `npm run seed` | Datos iniciales (idempotente). |
| `npm run seed:reset` | **Bloqueado por política**: el seed nunca hace `DROP` ni `TRUNCATE`. |
| `npm run logos:zpl` | Regenera los logos embebidos en ZPL. Solo si cambia el asset. |

---

## Variables de entorno

Plantilla en [`.env.example`](.env.example). `.env*` está en `.gitignore`.

| Variable | Para qué | Si falta |
|---|---|---|
| `TURSO_DATABASE_URL` | Base de datos libSQL. `file:./data/local.db` en local, `libsql://…` en Turso. | Drizzle usa `file:./data/local.db`. |
| `TURSO_AUTH_TOKEN` | Token de Turso para bases remotas. | Solo hace falta en remoto. |
| `BETTER_AUTH_SECRET` | Firma de sesiones. **Obligatoria en producción**: la app lanza error si falta. | En desarrollo usa un secreto de prueba con aviso. |
| `BETTER_AUTH_URL` | URL base para Better Auth. | `http://localhost:3000`. |
| `NEXT_PUBLIC_APP_URL` | URL pública: QR y SEO (canonical, robots, sitemap). | El SEO usa `https://inventario-equipos-app.vercel.app`. |
| `OPENROUTER_API_KEY` | Proveedor de IA. | Las funciones de IA se deshabilitan. |
| `AI_MODEL` | Modelo de OpenRouter. | `openai/gpt-4o-mini`. |

---

## Scripts disponibles

Todos viven en `scripts/` y **no forman parte de la app**.

| Script | Qué hace |
|---|---|
| `seed.ts` | Datos iniciales: restaurantes, tipos, usuarios y equipos de ejemplo. Idempotente. |
| `seed-demo-identity.ts` | Datos de identidad de demostración. |
| `import-inventory.ts` | Importa los Excel reales (`INVENTARIO PH01.xlsx`, `DNS19.xlsx`). Soporta `--dry-run`. No borra nada. |
| `consolidate-units.ts` | Consolida dos unidades. **Solo lectura por defecto**; exige `--source` y `--target`, y `--apply` para escribir. |
| `generate-zpl-logos.mjs` | Regenera los logos embebidos en el ZPL. |
| `generate-icons.mjs` | Genera los iconos de la PWA. |

Los scripts de escritura exigen `--dry-run` o son de solo lectura por defecto,
para que nadie escriba en la base de producción por accidente.

---

## Migraciones

Flujo: `npm run db:generate` → `npm run db:migrate`. **No edites una migración ya
aplicada.**

| Migración | Qué introduce |
|---|---|
| `0000_curved_green_goblin` | Tablas base: Better Auth, restaurantes, tipos, equipos, solicitudes, historial, etiquetas. |
| `0001_clear_ironclad` | — |
| `0002_complete_thanos` | — |
| `0003_hot_lady_mastermind` | `equipment_groups` (inventario agregado por rubro). |
| `0004_sour_husk` | `equipment_movements` (libro de movimientos). |

---

## Pruebas y calidad

| Comprobación | Comando | Estado |
|---|---|---|
| Tipos | `npm run typecheck` | Sin errores |
| Lint | `npm run lint` | Sin errores ni avisos |
| Pruebas | `npm run test` | 13 archivos, 220 pruebas, todas pasan |
| Build | `npm run build` | Correcto |

Cobertura por área:

| Archivo de pruebas | Qué cubre |
|---|---|
| `lib/equipment/movements.test.ts` | Reglas de cada tipo de movimiento |
| `lib/equipment/movements-flows.test.ts` | Los flujos completos de extremo a extremo |
| `lib/equipment/movements-auth.test.ts` | Que un usuario de restaurante no pueda mover nada |
| `lib/db/queries/labels.test.ts` | Etiquetas: unicidad de token, una por equipo |
| `lib/labels/brand-locales.test.ts` | Numeración de locales por marca |
| `lib/labels/print-queue-runner.test.ts` | Cola de impresión y sus reintentos |
| `lib/restaurants/consolidate-units.test.ts` | Consolidación de unidades |
| `lib/restaurants/active-units.test.ts` | Unidades activas |
| `lib/inventory/inventory.test.ts` | Inventario y agregados |
| `lib/revalidate.test.ts` | Invalidación de vistas |
| `lib/sync/tab-sync.test.ts` | Sincronización entre pestañas |
| `lib/zpl/builder.test.ts` | Constructor ZPL |
| `lib/zpl/zpl-lock.test.ts` | Hash de congelamiento del ZPL |

`vitest.config.mts` sustituye `server-only` por un stub para poder probar
acciones reales sin el runtime de Server Components.

---

## SEO y exposición pública

El panel es una aplicación interna. La estrategia es **dejar indexable una sola
página de contenido** y señalizar todo lo demás.

| Pieza | Archivo | Qué hace |
|---|---|---|
| Metadata base | `app/layout.tsx` | `metadataBase`, título con plantilla, descripción, keywords, Open Graph, Twitter Card, `formatDetection` y Apple Web App. |
| Página pública | `app/inicio/page.tsx` | Landing estática: **no consulta la base de datos**, no lee la sesión y no enlaza rutas del panel. |
| robots.txt | `app/robots.ts` | Permite todo y **desbloquea una por una** las 14 rutas privadas. Incluye `Sitemap` y `Host`. |
| Sitemap | `app/sitemap.ts` | Contiene **solo** `/inicio`. |
| Login | `app/(auth)/login/page.tsx` | `noindex, follow`: accesible para rastrear, fuera del índice. |
| Ficha QR | `app/e/[token]/page.tsx` | `noindex, follow`: las etiquetas no se indexan. |
| Constantes | `lib/site.ts` | URL canónica y lista de rutas privadas, en un solo sitio. |

Comprobado sobre el build:

```
User-Agent: *
Allow: /
Disallow: /dashboard
Disallow: /equipment
... (14 rutas privadas)
Host: https://inventario-equipos-app.vercel.app
Sitemap: https://inventario-equipos-app.vercel.app/sitemap.xml
```

**Esto no sustituye la indexación.** El sitio queda *preparado*; para que Google
lo indexe hay que enviar `sitemap.xml` en Google Search Console y en Bing Webmaster
Tools. Ver [`docs/SEO-Y-EXPOSICION.md`](docs/SEO-Y-EXPOSICION.md).

---

## Seguridad

1. **La autorización es del servidor.** Cada página y cada server action llaman a
   `requireUser()` o `requireRole()`. Ocultar un botón nunca protege un dato.
2. **El alcance se resuelve en servidor.** `resolveScope()` decide si el usuario ve
   todo (`ADMIN`, `IT_MANAGER`) o solo su restaurante. `assertRestaurantAccess()`
   bloquea el acceso cruzado aunque el cliente manipule el `restaurantId`.
3. **Entrada validada con Zod** en todas las acciones.
4. **El QR es opaco.** Token aleatorio, búsqueda por token, y la ficha pública no
   expone serie, notas ni usuarios.
5. **El rol no lo elige el cliente.** `role`, `restaurantId` y `active` son
   `input: false` en Better Auth.
6. **Sin registro público** (`disableSignUp: true`): las cuentas las crea un ADMIN.
7. **La IA no ejecuta SQL**, solo tools predefinidas, y respeta el alcance.
8. **El libro de movimientos sobrevive al borrado de equipos**, por diseño de
   auditoría.
9. **Sin secretos en el repositorio.** `.env*` ignorado; `.env.example` solo
   nombres.

---

## Datos actuales en producción

Verificado con consultas de solo lectura. **No hay escrituras en la base desde la
auditoría.**

| Dato | Valor |
|---|---|
| Restaurantes | 4 (`CW04` China Wok, `DN03` Denny's, `KF02` KFC, `PZ01` Pizza Hut) |
| Equipos | 81 (`PZ01` 44, `DN03` 13, `KF02` 13, `CW04` 11) |
| Tipos de equipo | 16 |
| Agregados por rubro | 7 filas, todas de `DNS19.xlsx` (Denny's), 16 unidades |
| Solicitudes | 10, con 1 cambio de estado registrado |
| Etiquetas | 52, con 52 tokens distintos |
| Usuarios | 3 (uno por rol) |
| Movimientos / historial de equipos | 0 / 0 |
| Equipos con `ownerRestaurantId` | 0 (no hay préstamos vigentes) |
| Estados | 64 `ACTIVE`, 9 `MAINTENANCE`, 8 `DAMAGED` |

---

## Historial: qué pasó con PH01

`PH01` (Pizza Hut) **ya no existe** como restaurante. Se consolidó en `PZ01` (Pizza
Hut) y lo que queda son referencias históricas, deliberadamente conservadas:

- **31 equipos** de `INVENTARIO PH01.xlsx` viven ahora en `PZ01`.
- Sus **`asset_code` conservan el prefijo `PH01`** y su `source_document` sigue
  diciendo `INVENTARIO PH01.xlsx`. Es trazabilidad, no un error pendiente.
- `PH01` no aparece como unidad por defecto en ningún sitio: el script de
  consolidación exige `--source` y `--target` explícitos.

Si alguna vez hay que consolidar otra unidad, el procedimiento es el mismo y está
documentado en [`docs/PLANIFICACION.md`](docs/PLANIFICACION.md).

---

## Limitaciones conocidas

- **Solo un tipo de documento es agregable.** `equipment_groups` modela el formato
  de `DNS19.xlsx`. `AGGREGATE_INVENTORY_BRANDS` lista marcas que usan ese formato
  (hoy solo Denny's). Un tercer formato habría que añadirlo como formato nuevo.
- **El archivado no es reversible desde la interfaz.** `archiveEquipment` pone el
  equipo en `RETIRED`; devolverlo a `ACTIVE` se hace editando el equipo.
- **No hay borrado de equipos.** Es deliberado: el libro de movimientos y el
  historial son auditoría y sobreviven al equipo.
- **La ia depende de un servicio externo** (OpenRouter) y de la red. Sin clave, las
  funciones se ocultan.
- **El logo corporativo no es legible como wordmark en tamaños pequeños.** El
  asset es un lockup horizontal de 1399x501 (2.79:1) con fondo blanco horneado;
  dentro de un círculo se ve como una banda compacta. Hacerlo legible exigiría un
  asset cuadrado o circular.
- **`public/brands/pizza-hut.jpg` es en realidad un AVIF** (sus bytes empiezan por
  `ftypavif`) con extensión `.jpg`. Se usa tal cual y funciona; renombrarlo no es
  necesario.
- **Hay SVG de plantilla de Next sin usar** en `public/` (`next.svg`, `vercel.svg`,
  `file.svg`, `globe.svg`, `window.svg`).
- **La indexación depende de terceros.** El código prepara el sitio, pero nadie ha
  dado de alta el dominio en Search Console ni Bing.

---

## Documentación adicional

| Documento | Para quién |
|---|---|
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Desarrollador: capas, flujo de datos, por dónde tocar. |
| [`docs/BASE-DE-DATOS.md`](docs/BASE-DE-DATOS.md) | Desarrollador y profesor: tablas, índices, migraciones. |
| [`docs/MOVIMIENTOS.md`](docs/MOVIMIENTOS.md) | Usuario técnico: los 7 flujos y sus reglas. |
| [`docs/ETIQUETAS-Y-QR.md`](docs/ETIQUETAS-Y-QR.md) | Usuario técnico: etiquetas, QR e impresión Zebra. |
| [`docs/ROLES-Y-SEGURIDAD.md`](docs/ROLES-Y-SEGURIDAD.md) | Profesor y desarrollador: autorización y modelo de amenazas. |
| [`docs/IA.md`](docs/IA.md) | Desarrollador: las dos funciones de IA y su seguridad. |
| [`docs/SEO-Y-EXPOSICION.md`](docs/SEO-Y-EXPOSICION.md) | Profesor y visitante: qué es indexable y cómo darlo de alta. |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Desarrollador: despliegue en Vercel. |
| [`docs/PLANIFICACION.md`](docs/PLANIFICACION.md) | Profesor: qué está pendiente y qué se descartó. |
| [`AGENTS.md`](AGENTS.md) | Reglas del repositorio para asistentes de IA. |
