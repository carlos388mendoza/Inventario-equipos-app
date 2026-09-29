# Inventario de Equipos — Grupo Comidas

Sistema web para que las unidades (restaurantes) de Grupo Comidas soliciten
compras y cambios de equipos, y para que IT gestione el inventario.

## Stack

- Next.js (App Router) + TypeScript estricto + Tailwind CSS v4 + Radix UI
- Better Auth (correo + contraseña). Los roles NO usan el plugin `admin`: son
  campos propios del usuario (`role`, `restaurantId`, `active`) declarados con
  `input: false` en `lib/auth/server.ts`, para que el cliente no pueda fijarlos.
- Drizzle ORM + Turso (libSQL). Esquema en `lib/db/schema/index.ts`
  (migraciones aplicadas en `lib/db/migrations`)
- AI SDK (`ai`) contra **OpenRouter** para el agente de voz y de estadísticas
- Streamdown para renderizar respuestas del agente en markdown
- `zebra-browser-print-wrapper` + ZPL propio (`lib/zpl/`) para las etiquetas
- Despliegue: Vercel. Base de datos: Turso (persistente)

Usa el gestor de paquetes que corresponda al lockfile existente.
Consulta siempre la documentación oficial vigente de Better Auth, Drizzle,
AI SDK y Streamdown antes de usar una API; las versiones cambian rápido.
Para Next, las guías están en `node_modules/next/dist/docs/`.

## Roles

Los valores van en **MAYÚSCULAS** y se definen en `lib/db/enums.ts`.

| Rol (`user.role`) | Puede |
|---|---|
| `ADMIN` | Todo: usuarios, restaurantes, tipos de equipo, inventario, solicitudes, movimientos, etiquetas |
| `IT_MANAGER` | Ver todos los restaurantes, cambiar estados de solicitudes, gestionar inventario, movimientos, estadísticas, imprimir etiquetas. **No** gestiona usuarios ni restaurantes |
| `RESTAURANT_USER` | Crear solicitudes y ver **solo** las de su restaurante (`user.restaurantId`) |

- El registro público está deshabilitado (`disableSignUp: true`). El admin crea los usuarios.
- Un usuario `RESTAURANT_USER` sin `restaurantId` no puede crear solicitudes.
- `asUserRole()` cae en `RESTAURANT_USER` ante un valor desconocido: un rol
  corrupto cierra permisos, no los abre.

## Reglas de dominio

- Compra vs. reemplazo: **no hay columna `kind`**. Se distinguen por
  `currentEquipmentId`: `NULL` = equipo nuevo; con valor = reemplazo de ese
  equipo, que debe ser **del mismo restaurante** (se comprueba en el servidor).
- Estados de solicitud: `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`,
  `COMPLETED`, `CANCELLED`. Cada cambio inserta una fila en `request_history`.
- Solicitudes activas = `ACTIVE_REQUEST_STATUS` (`PENDING`, `IN_REVIEW`,
  `APPROVED`); históricas = `CLOSED_REQUEST_STATUS` (el resto).
- Estados de equipo: `ACTIVE`, `DAMAGED`, `MAINTENANCE`, `REPLACED`, `RETIRED`.
- Tipos de movimiento: `TRANSFER`, `COPY`, `PULL`, `LOAN_OUT`, `LOAN_RETURN`,
  `REPLACEMENT` (conjunto cerrado, declarado en `lib/db/enums.ts` y
  `MOVEMENT_DEFINITIONS`). El archivado **no** es un movimiento: escribe en
  `equipment_history`.
- Vida útil de un equipo: se calcula en `lib/equipment/lifecycle.ts` con
  `retiredAt - installedAt` (solo equipos retirados).
- Formatos de inventario: `PER_ASSET` (tabla `equipment`) y `AGGREGATE` (tabla
  `equipment_groups`, un agregado **no** puede tener etiqueta, QR ni solicitud).
- Los tipos de equipo son un catálogo **editable por CRUD**; no los pongas fijos
  en el código.
- Valores en base de datos y código: inglés. Textos de la interfaz: español,
  definidos inline en los componentes (no hay `lib/labels.ts`).

## Seguridad (obligatorio)

- **Toda** autorización se verifica en el servidor (server actions / route
  handlers), no solo en middleware ni en la UI. Un usuario `RESTAURANT_USER`
  nunca debe poder leer o modificar datos de otro restaurante, aunque manipule
  el request.
- Valida toda entrada con Zod.
- La página pública del QR (`/e/[token]`) es la única ruta sin autenticación.
  Muestra solo: código de activo, tipo, marca/modelo, restaurante asignado, fecha
  de instalación y estado. Nunca serial, notas, ni datos de usuarios. Busca por
  `securityLabels.token`, **jamás** por `id`.
- Nunca subas secretos. `.env*` está en `.gitignore`; mantén `.env.example`
  actualizado con nombres de variables sin valores.
- El agente de IA solo usa **tools con consultas predefinidas** (Drizzle). Nunca
  ejecuta SQL generado por el modelo. El asistente de estadísticas es solo
  `ADMIN` e `IT_MANAGER`; la solicitud por voz admite también
  `RESTAURANT_USER` dentro de su alcance.
- Si falta la key de IA, la app debe seguir funcionando: las funciones de IA se
  ocultan o se deshabilitan con un mensaje claro.
- `lib/zpl/` está **congelado por hash**
  (`EA185E75E01164E1B95C95B16F8332A09569CFB2AC59E77F03A38DAE663F6504`, verificado
  por `lib/zpl/zpl-lock.test.ts`). No lo cambies sin motivo explícito.

## Variables de entorno

`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, y las de IA: `OPENROUTER_API_KEY` y
`AI_MODEL`. Los nombres y sus comentarios están en `.env.example`.

`NEXT_PUBLIC_APP_URL` tiene dos usos: la URL del QR (`appBaseUrl()` en
`lib/utils.ts`) y la URL canónica de SEO (`SITE_URL` en `lib/site.ts`). Como es
`NEXT_PUBLIC_*`, se compila en el build: cambiarla en Vercel exige **re-desplegar**.

## SEO

- La URL canónica y la lista de rutas privadas viven **solo** en `lib/site.ts`, y
  las consumen `app/layout.tsx`, `app/robots.ts` y `app/sitemap.ts`. No las
  dupliques.
- El panel es interno. La **única** página indexable es `/inicio`
  (`app/inicio/page.tsx`), que es estática y **no consulta la base de datos**.
- `/login` y `/e/[token]` declaran `noindex`.
- Si añades una sección al panel, añádela también a `PRIVATE_PATHS`.

## Convenciones

- Server Components por defecto; `"use client"` solo donde haga falta.
- Lógica de datos en `lib/db/queries/*` y server actions en
  `app/(dashboard)/*/actions.ts` (patrón de restaurantes), no en componentes.
- Las reglas de negocio van en funciones puras en `lib/` (`lib/equipment/*`,
  `lib/labels/*`, `lib/restaurants/*`) para poder testearlas sin montar nada.
- Al añadir una vista que dependa de datos que ya se escriben, añade su ruta al
  helper correspondiente en `lib/revalidate.ts`.
- Migraciones con `drizzle-kit generate` + `drizzle-kit migrate`. No edites migraciones ya aplicadas.
- Antes de dar una tarea por terminada: `tsc --noEmit`, lint y `build` deben pasar.
- No hagas `git commit` ni `git push` salvo que se te pida.
- No agregues dependencias innecesarias; menciona cada dependencia nueva y por qué.
- La documentación pública vive en `README.md` y `docs/`. Mantenla alineada con
  el código: si un dato no se puede comprobar, dilo como "no verificable" en vez
  de suponerlo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
