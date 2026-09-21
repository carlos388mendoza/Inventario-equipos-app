# Inventario de Equipos — Grupo Comidas

Sistema web para que las unidades (restaurantes) de Grupo Comidas soliciten
compras y cambios de equipos, y para que IT gestione el inventario.

## Stack

- Next.js (App Router) + TypeScript estricto + Tailwind CSS + shadcn/ui
- Better Auth con el plugin `admin` (roles y permisos)
- Drizzle ORM + Turso (libSQL). Esquema en `lib/db/schema/index.ts`
  (migraciones aplicadas en `lib/db/migrations`)
- AI SDK (`ai`) para el agente de voz y de estadísticas
- Streamdown para renderizar respuestas del agente en markdown
- Despliegue: Vercel. Base de datos: Turso (persistente)

Usa el gestor de paquetes que corresponda al lockfile existente.
Consulta siempre la documentación oficial vigente de Better Auth, Drizzle,
AI SDK y Streamdown antes de usar una API; las versiones cambian rápido.

## Roles

| Rol (`user.role`) | Puede |
|---|---|
| `admin` | Todo: usuarios, restaurantes, tipos de equipo, inventario, solicitudes |
| `restaurant` | Crear solicitudes y ver **solo** las de su restaurante (`user.restaurantId`) |
| `it_manager` | Ver todos los restaurantes, cambiar estados de solicitudes, gestionar inventario, estadísticas, imprimir etiquetas. **No** gestiona usuarios |

- El registro público está deshabilitado. El admin crea los usuarios.
- Un usuario `restaurant` sin `restaurantId` no puede crear solicitudes.

## Reglas de dominio

- Tipos de solicitud (`kind`): `purchase` | `replacement`.
  `replacement` debe indicar `replacesEquipmentId` (equipo del mismo restaurante).
- Estados: `pending → approved → purchased → delivered`; salidas: `rejected`, `cancelled`.
  Cada cambio de estado inserta una fila en `request_status_history`.
- Solicitudes "activas" = `ACTIVE_REQUEST_STATUSES`; "históricas" = el resto.
- Vida útil de un equipo = `retiredAt - installedAt` (solo equipos retirados).
- Los tipos de equipo iniciales: Televisión, HME (autoservicio), Impresora de
  facturas (Epson), Impresora Zebra ZD230 (QRs), Tomapedidos, Mini-PC.
  Son editables por CRUD; no los pongas fijos en el código.
- Valores en base de datos y código: inglés. Textos de la interfaz: español,
  definidos inline en los componentes (no hay `lib/labels.ts`).

## Seguridad (obligatorio)

- **Toda** autorización se verifica en el servidor (server actions / route
  handlers), no solo en middleware ni en la UI. Un usuario `restaurant` nunca
  debe poder leer o modificar datos de otro restaurante, aunque manipule el request.
- Valida toda entrada con Zod.
- La página pública del QR (`/e/[token]`) es la única ruta sin autenticación.
  Muestra solo: tipo, marca/modelo, restaurante asignado, fecha de instalación
  y estado. Nunca serial, notas, ni datos de usuarios. Busca por `publicToken`,
  jamás por `id`.
- Nunca subas secretos. `.env*` está en `.gitignore`; mantén `.env.example`
  actualizado con nombres de variables sin valores.
- El agente de IA solo usa **tools con consultas predefinidas** (Drizzle). Nunca
  ejecuta SQL generado por el modelo. Solo `admin` e `it_manager` lo usan.
- Si falta la key de IA, la app debe seguir funcionando: las funciones de IA se
  ocultan o se deshabilitan con un mensaje claro.

## Variables de entorno

`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, y las de IA (`AI_MODEL` y la key del proveedor).

## Convenciones

- Server Components por defecto; `"use client"` solo donde haga falta.
- Lógica de datos en `lib/db/queries/*` y server actions en
  `app/(dashboard)/*/actions.ts` (patrón de restaurantes), no en componentes.
- Migraciones con `drizzle-kit generate` + `drizzle-kit migrate`. No edites migraciones ya aplicadas.
- Antes de dar una tarea por terminada: `tsc --noEmit`, lint y `build` deben pasar.
- No hagas `git commit` ni `git push` salvo que se te pida.
- No agregues dependencias innecesarias; menciona cada dependencia nueva y por qué.
