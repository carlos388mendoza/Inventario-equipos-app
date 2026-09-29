# Base de datos

Turso (libSQL) con Drizzle ORM. Este documento describe el esquema tal como
está en `lib/db/schema/`, con el porqué de las decisiones que no son obvias.

---

## 1. Conexión

`lib/db/client.ts` y `lib/db/index.ts` crean el cliente libSQL a partir de
`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.

- Desarrollo sin cuenta: `TURSO_DATABASE_URL=file:./data/local.db`.
- Producción: `libsql://<db>-<org>.turso.io` + token.
- `lib/db/index.ts` marca el módulo con `server-only`, así que no puede acabarse
  importando desde un Client Component por accidente.

`data/` está en `.gitignore`: la base local nunca se sube.

---

## 2. Tablas de Better Auth

Las cuatro estándar del adaptador de Drizzle:

| Tabla | Notas |
|---|---|
| `user` | Con campos propios: `role`, `restaurantId`, `active`. |
| `session` | Token único, `expiresAt`, `ipAddress`, `userAgent`. |
| `account` | Proveedores, tokens, `password`. |
| `verification` | Identificador, valor y expiración. |

### Campos propios de `user`

```ts
role:         UserRole   // por defecto RESTAURANT_USER
restaurantId: string    // solo tiene sentido para RESTAURANT_USER
active:       boolean   // por defecto true
```

En `lib/auth/server.ts` los tres se declaran con `input: false`, así que Better
Auth **no acepta que el cliente los envíe**: un usuario no puede concederse un rol
ni cambiarse de restaurante por su cuenta. Solo un ADMIN, desde
`app/(dashboard)/users/actions.ts`, puede hacerlo.

`active` es una barrera de defensa en profundidad: al desactivar una cuenta se
cierran sus sesiones, y además `isAccountActive()` lo comprueba.

---

## 3. Tablas de la aplicación

### `restaurants` — la unidad

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | |
| `name` | text | |
| `code` | text | **Único** (`restaurants_code_unique`). `PZ01`, `DN03`… |
| `address` | text | opcional |
| `active` | boolean | `default true` |
| `brand` | text | "Pizza Hut", "KFC"… |
| `sector` | text | "Cocina", "Restaurantes"… |
| `logo` | text | ruta en `/public/brands` o URL externa |
| `createdAt` / `updatedAt` | timestamp_ms | |

El código es único porque es la referencia que usan los documentos y las
personas ("el equipo de DN03"). `active = false` es la forma de **retirar** una
unidad sin borrar su historia: no se usa `DELETE`.

### `equipment_types` — el catálogo

`id`, `name` (indexado), `description`, `usefulLifeMonths` (por defecto 36),
`active`, timestamps.

El catálogo es **editable por CRUD**: no hay tipos fijados en el código. El
nombre es el que se ve en la interfaz, y los 16 tipos actuales (Televisión, HME,
Impresora Epson, Impresora Zebra, Tomapedidos, Mini-PC, Monitor, PC, UPS, Switch
de red, Access point Fortinet, Firewall Fortinet, Gabinete de rack, Guarda
monedas, Tableta, Impresora de oficina) son datos, no código.

`usefulLifeMonths` alimenta el cálculo de vida útil de `lib/equipment/lifecycle.ts`.

### `equipment` — el equipo individual

Es la tabla central. Se lee por partes.

**Identidad y datos**

| Columna | Notas |
|---|---|
| `id` | text PK |
| `assetCode` | **Único** (`equipment_asset_code_unique`) |
| `serialNumber` | opcional, indexado |
| `equipmentTypeId` | FK a `equipment_types` |
| `restaurantId` | FK a `restaurants`. **Dónde está.** |
| `brand`, `model` | |
| `purchaseDate`, `installationDate` | |
| `status` | `EquipmentStatus`, por defecto `ACTIVE` |
| `notes` | |

**Trazabilidad al documento de origen**

| Columna | Notas |
|---|---|
| `sourceDocument` | p. ej. `INVENTARIO PH01.xlsx` |
| `sourceShortCode` | `DESCRIPCION` del documento. **No es único:** el original lo repite. |
| `sourceDescription` | `DESCRIPCION LARGA` |
| `sourceQrCode` | `CODIGOQR` del documento original. **No** es el token de la etiqueta propia. |
| `sourceTechnician` | `TECNICO_APERTURA` |
| `sourceDateText` | `FECHA` tal cual, sin interpretar ni reformatear |

Estas seis columnas guardan el dato **verbatim**. No se derivan ni se corrigen: el
código corto viene repetido en el Excel y la fecha puede venir en notación
científica, así que "arreglarla" sería inventar.

**Propiedad y linaje**

| Columna | Notas |
|---|---|
| `ownerRestaurantId` | FK, nullable. **De quién es.** |
| `originEquipmentId` | FK a `equipment`. De qué equipo se creó esta copia. |
| `replacedByEquipmentId` | FK a `equipment`. Qué equipo lo sustituyó. |

`restaurantId` y `ownerRestaurantId` son cosas distintas y la regla es:

```
ownerRestaurantId != null && ownerRestaurantId != restaurantId
   ⟺ el equipo está en préstamo
```

`NULL` significa "el propietario es la unidad donde está", que es el caso normal.
Solo la devolución vuelve a ponerlo en `NULL`.

`originEquipmentId` y `replacedByEquipmentId` son **comodidades de lectura**: el
linaje completo y auditable está en `equipment_movements`, que es donde se
consulta "a quién sustituyó este equipo".

**Índices**: `assetCode` (único), `restaurantId`, `ownerRestaurantId`,
`originEquipmentId`, `replacedByEquipmentId`, `equipmentTypeId`, `status`,
`serialNumber`, `sourceDocument`.

### `equipment_groups` — el agregado por rubro

| Columna | Notas |
|---|---|
| `id` | text PK |
| `restaurantId` | FK |
| `sourceFormat` | `InventoryFormat`, por defecto `AGGREGATE` |
| `name` | `EQUIPO` del documento, verbatim |
| `quantity` | `CANT`, por defecto 1 |
| `totalValue` | `VALOR` de la línea, **en centavos** |
| `currency` | tal como aparece (p. ej. `L`) |
| `sourceLineCode` | clave de la línea en el documento |
| `sourceDocument` | p. ej. `DNS19.xlsx` |
| `notes` | |

**¿Por qué existe esta tabla?** Porque una fila de `DNS19.xlsx` cubre N unidades
idénticas de un rubro. No identifica un equipo individual, así que **no puede
tener etiqueta, QR ni solicitud asociada**. Meterla en `equipment` obligaría a
duplicar filas para llegar a 81 y perdería el valor real del documento.

`totalValue` es el valor **de la línea**, no el precio unitario: en `DNS19.xlsx`
la suma de `VALOR` coincide exactamente con el `TOTAL` del documento. Se guarda en
centavos para no arrastrar errores de coma flotante.

### `equipment_requests` — la solicitud

| Columna | Notas |
|---|---|
| `id` | text PK |
| `restaurantId` | FK |
| `requestedBy` | FK a `user` |
| `equipmentTypeId` | FK |
| `currentEquipmentId` | FK a `equipment`, **nullable**. `NULL` = se pide un equipo **nuevo**; con valor = es un **reemplazo**. |
| `reason` | obligatorio |
| `description` | opcional |
| `priority` | `LOW` \| `NORMAL` \| `HIGH` \| `URGENT` |
| `status` | `RequestStatus`, por defecto `PENDING` |
| `createdAt` / `updatedAt` | |

No hay columna `kind`: la compra y el reemplazo se distinguen por si
`currentEquipmentId` viene nulo o no. El formulario usa `kind` como concepto de
interfaz y la acción lo traduce a esa nulidad.

El servidor comprueba que el equipo a reemplazar **pertenece al restaurante de la
solicitud**, aunque el cliente envíe otro `restaurantId`.

### `request_history` — cambios de estado

`requestId` (FK, `onDelete: cascade`), `userId`, `oldStatus`, `newStatus`,
`comment`, `createdAt`. Una fila por transición, incluida la creación
(`oldStatus = null`).

### `equipment_history` — eventos del equipo

`equipmentId` (FK, cascade), `restaurantId`, `action` (texto), `description`,
`performedBy`, `createdAt`.

`action` es texto libre a propósito, y por eso **no puede contestar** por sí solo
"a dónde se movió este equipo": para eso está `equipment_movements`, que sí guarda
origen, destino y motivo.

### `equipment_movements` — el libro

| Columna | Notas |
|---|---|
| `id` | text PK |
| `batchId` | Agrupa una operación. Un movimiento simple es un lote de uno. |
| `type` | `EquipmentMovementType`, conjunto **cerrado** |
| `equipmentId` | FK (equipo movido) |
| `counterpartEquipmentId` | FK. En `COPY` el origen; en `REPLACEMENT` el sustituto. |
| `fromRestaurantId` | FK, **opcional** |
| `toRestaurantId` | FK, **opcional** |
| `assetCode` | Desnormalizado a propósito |
| `equipmentTypeId` | Desnormalizado a propósito |
| `reason`, `notes` | |
| `performedBy` | FK a `user` |
| `createdAt` | |

Cuatro decisiones que conviene no deshacer:

1. **`batchId` existe** para que "moví 12 equipos a la vez" sea **una sola entrada
   consultable**, y no 12 sueltas.
2. **`assetCode` y `equipmentTypeId` están desnormalizados** para que el libro siga
   siendo legible aunque el código del equipo cambie o la fila se elimine.
3. **`from` y `to` son ambos opcionales** porque las operaciones difieren: un
   traslado tiene ambos, un reemplazo se expresa con el `counterpartEquipmentId`.
4. **`equipmentId` y `counterpartEquipmentId` NO tienen `onDelete: cascade`.** El
   libro es auditoría y debe sobrevivir al borrado de un equipo. Las acciones de
   eliminación comprueban esas referencias y **bloquean** el borrado en lugar de
   arrastrar el historial (`describeDeletionBlockers()` en
   `lib/equipment/movements.ts`).

### `security_labels` — la etiqueta

| Columna | Notas |
|---|---|
| `id` | text PK |
| `equipmentId` | FK, `onDelete: cascade`, **único** |
| `token` | **único** |
| `createdAt` | |

Dos `uniqueIndex`: `security_labels_token_unique` y
`security_labels_equipment_unique`. La segunda garantiza **una sola etiqueta por
equipo**: reemitir actualiza el token en lugar de crear un duplicado
(`upsertSecurityLabel` con `onConflictDoUpdate`).

La etiqueta pertenece **al equipo**, no a la unidad donde está: por eso mover un
equipo no revalida `/labels` ni cambia su token.

---

## 4. Relaciones

Definidas con `relations()` de Drizzle en `lib/db/schema/app.ts`.

```
restaurants ─┬─< equipment (restaurantId)         "dónde está"
             ├─< equipment (ownerRestaurantId)    "de quién es"
             ├─< equipment_groups
             ├─< equipment_requests
             ├─< equipment_history
             ├─< equipment_movements (from / to)
             └─< user                              "de qué unidad es"

equipment_types ──< equipment / equipment_requests / equipment_movements
user ──< equipment_requests / request_history / equipment_history
equipment ─┬─< equipment_movements (equipment / counterpart)
           ├─< equipment_history
           └─1─ security_labels
```

Las dos relaciones `equipment` ↔ `restaurants` están **explícitamente nombradas**
(`equipment_restaurant` y `equipment_owner`) porque Drizzle no puede deducir
cuál es cuál: sin nombre, la relación sería ambigua.

---

## 5. Migraciones

Flujo: `npm run db:generate` → `npm run db:migrate`. **No editar una migración ya
aplicada.**

| Migración | Qué introduce |
|---|---|
| `0000_curved_green_goblin` | Base: Better Auth (4 tablas), restaurantes, tipos, equipos, historial, solicitudes, historial de solicitudes, etiquetas |
| `0001_clear_ironclad` | (sin tablas nuevas) |
| `0002_complete_thanos` | (sin tablas nuevas) |
| `0003_hot_lady_mastermind` | `equipment_groups` |
| `0004_sour_husk` | `equipment_movements` |

`drizzle.config.ts` usa `dialect: "turso"` y carga `.env.local` por sí mismo
(lee el archivo a mano, sin depender de `dotenv`), con respaldo a
`file:./data/local.db`.

---

## 6. Datos actuales (verificado en solo lectura)

| Tabla | Filas |
|---|---|
| `restaurants` | 4 |
| `equipment` | 81 |
| `equipment_types` | 16 |
| `equipment_groups` | 7 |
| `equipment_requests` | 10 |
| `request_history` | 1 |
| `equipment_history` | 0 |
| `equipment_movements` | 0 |
| `security_labels` | 52 |
| `user` | 3 |

Integridad comprobada en la auditoría: 0 etiquetas huérfanas, 0 equipos con
`restaurantId` inexistente, 0 `ownerRestaurantId` apuntando a una unidad
inexistente, 0 `originEquipmentId` o `replacedByEquipmentId` rotos, 52 tokens
distintos para 52 etiquetas.

---

## 7. Cómo consultar sin romper nada

Para una auditoría o una comprobación, usa siempre `SELECT`:

```bash
# Con el cliente de libSQL, sin escribir nada
node --env-file=.env.local -e "..."
```

Los scripts de `scripts/` tienen una protección: `import-inventory.ts` acepta
`--dry-run` y nunca emite `DELETE` ni `TRUNCATE`; `consolidate-units.ts` es de
solo lectura salvo que se pase `--apply`; `seed.ts` es idempotente y su `--reset`
está **bloqueado por política** (no ejecuta `DROP` ni `TRUNCATE`).

La base de producción es de lectura para cualquier trabajo que no sea una
migración aprobada.
