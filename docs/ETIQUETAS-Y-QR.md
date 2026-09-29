# Etiquetas, QR e impresión

Documento para usuario técnico. Explica cómo se emite una etiqueta de seguridad,
qué lleva el QR y cómo llega a una impresora Zebra.

---

## 1. Qué es una etiqueta

Cada equipo puede tener **una** etiqueta de seguridad, que se guarda en
`security_labels`:

| Columna | Qué es |
|---|---|
| `id` | Identificador interno, UUID. |
| `equipmentId` | El equipo. **Único**: un equipo, una etiqueta. |
| `token` | **UUID sin guiones** (32 hexadecimales). **Único**. |
| `createdAt` | Cuándo se emitió. |

La etiqueta se genera desde `/labels` (solo `ADMIN` e `IT_MANAGER`) con la acción
`generateSecurityLabel`.

### Reemitir no duplica

`upsertSecurityLabel()` usa `onConflictDoUpdate` sobre `equipmentId`. Si el
equipo ya tenía etiqueta, **se actualiza el token** en lugar de crear una fila
nueva. Por eso hay siempre como máximo una etiqueta por equipo, y por eso
`revalidateLabelViews()` no necesita más.

---

## 2. El token: por qué no es el identificador del equipo

La URL del QR es `/e/<token>`, y el token es un UUID aleatorio.

Si la URL fuera `/e/<id-del-equipo>`, quien tuviera un QR podría recorrer los
identificadores y ver el inventario entero. Con un token opaco no se puede
deducir nada: el identificador del equipo **no viaja en la URL**, y la búsqueda
se hace por `token`, **nunca** por `id`.

El token no es un secreto de alta seguridad (el QR es físico y puede fotografiarse),
pero sí evita la enumeración trivial y hace que quien reimprima una etiqueta no
rompa las anteriores sin querer.

---

## 3. La ficha pública

`app/e/[token]/page.tsx` es la **única ruta sin autenticación** de la aplicación.

Muestra, y nada más:

| Campo | Origen |
|---|---|
| Código de activo | `equipment.assetCode` |
| Tipo | `equipmentTypes.name` |
| Marca y modelo | `equipment.brand`, `equipment.model` |
| Restaurante asignado | `restaurants.name` + `code` + logo |
| Fecha de instalación | `equipment.installationDate` |
| Estado | `equipment.status`, con su etiqueta en español |

**Nunca** muestra: número de serie, notas, documento de origen, código corto del
documento, técnico, fechas en texto libre, ni ningún dato de usuarios. La consulta
es un `SELECT` explícito de esos campos, no un `SELECT *` filtrado después: si
alguien añade una columna nueva a `equipment`, esta página **no** la expone por
accidente.

Si el token no existe, `notFound()` devuelve un 404.

La página declara `robots: { index: false, follow: false }`: las etiquetas de
seguridad no se indexan.

---

## 4. La generación

`generateSecurityLabel()` en `app/(dashboard)/labels/actions.ts`:

```
1. requireRole(ADMIN, IT_MANAGER)
2. resolveScope()
3. generateLabelSchema.parse(input)          ← Zod
4. getLabelEquipmentRow(equipmentId)         ← lee la identidad del equipo
5. assertRestaurantAccess(scope, row.restaurantId)
6. token = crypto.randomUUID().replaceAll("-", "")
7. upsertSecurityLabel(...)
8. url = `${appBaseUrl()}/e/${token}`
9. qrDataUrl = await QRCode.toDataURL(url)
10. revalidateLabelViews()
```

El paso 4 es importante: la identidad de la etiqueta (restaurante, marca, sector,
logo) se lee **del equipo**, no del restaurante que hace la solicitud. Por eso
funciona con cualquier unidad y no hay ninguna condición que lo limite a una en
concreto.

El QR se genera en el servidor con el paquete `qrcode` y se devuelve como data URL
para la vista previa, además de la URL en texto para reimprimir.

---

## 5. Impresión: Zebra Browser Print y ZPL

### 5.1 El flujo

No hay servidor de impresión. La impresión ocurre **en el navegador** contra el
servicio local **Zebra Browser Print**, que es un programa que se instala en el
PC donde se imprime:

```
App (navegador) ──► Zebra Browser Print (localhost) ──► Impresora Zebra ──► ZPL
```

El wrapper es `zebra-browser-print-wrapper` (`components/labels/browser-print.ts`),
con una capa propia que tipa la respuesta y convierte los fallos conocidos en
`BrowserPrintError` con estos códigos:

| Código | Significado |
|---|---|
| `NOT_INSTALLED` | El servicio local no está instalado o el puerto está cerrado. |
| `NO_PRINTER` | El servicio responde pero no hay impresoras. |
| `NOT_READY` | Hay impresora pero no está lista. |
| `WRITE_FAILED` | La impresora rechazó la escritura. |
| `UNKNOWN` | Cualquier otro fallo. |

La interfaz tiene fases explícitas (`usePrinterSession`): `idle`, `detecting`,
`ready`, `no-printers`, `unavailable`. Así el mensaje que ve la persona dice qué
está fallando, en vez de "no se pudo imprimir".

### 5.2 El ZPL

El ZPL lo genera el módulo propio `lib/zpl/`, no una librería:

| Archivo | Responsabilidad |
|---|---|
| `layout.ts` | Geometría de la etiqueta y sanitización de texto |
| `builder.ts` | `buildZpl(data)` — compone la etiqueta |
| `gfa.ts` | Codificador de imágenes monocromas a GFA (`~DG`) |
| `graphics.generated.ts` | **Logos embebidos**, generados |

**Geometría:** 50.8 × 25.4 mm (2 × 1 pulgadas), 8 dots por mm → 406 × 203 dots,
margen de 14 dots.

**Contenido de `ZplLabelData`:** `url`, `assetCode`, `typeName`,
`restaurantName`, `restaurantSector`, `restaurantLogo`, `installationDate`,
`createdAt`.

**QR:** corrección de errores `Q`, y la magnificación se calcula para que el QR
quepa en la etiqueta con el tamaño de módulo mayor posible dentro de los límites
(objetivo 3, máximo 10). Un QR más grande se escanea mejor.

**Logos:** el logo de la marca se incrusta como comando `~DG` (GFA). Como el
ancho de la etiqueta es limitado, el logotipo se recorta a un **área máximo** de
194 × 110 dots: no cabe un lockup horizontal completo, y por eso `GrupoComidasMark`
muestra el asset entero en el círculo pero la etiqueta **sí** lo recorta al área
disponible.

### 5.3 El módulo está congelado por hash

`lib/zpl/graphics.generated.ts` es un archivo **generado** a partir de los logos, y
cambiarlo cambia bytes de una etiqueta ya validada. Está protegido:

```
SHA-256 de lib/zpl/graphics.generated.ts
EA185E75E01164E1B95C95B16F8332A09569CFB2AC59E77F03A38DAE663F6504
```

`lib/zpl/zpl-lock.test.ts` comprueba ese hash en cada ejecución de la suite. Si el
test falla, **no** es un test roto: significa que el ZPL cambió y hay que decidir
conscientemente si la etiqueta nueva es aceptable.

Para regenerarlo a propósito: `npm run logos:zpl` (o `scripts/generate-zpl-logos.mjs`).

### 5.4 Cola de impresión

`lib/labels/print-queue-runner.ts` (`runPrintQueue`) procesa una lista de
etiquetas y devuelve un resultado por cada una (`QueueOutcome`), para que un
fallo a mitad de un lote no cancele el resto. La interfaz puede reintentar solo lo
que falló. Cubierto por `lib/labels/print-queue-runner.test.ts`.

---

## 6. Numeración de locales

`lib/labels/brand-locales.ts` define la numeración de locales por marca
(`BRAND_LOCALES`), para que "mesa 3" se etiquete como la que cada marca ya usa.
`brandKeyFor()` normaliza el nombre de la marca (sin acentos, en minúsculas) para
encontrar la configuración, e `isValidLocal()` rechaza los locales que no
existen para esa marca. Cubierto por `lib/labels/brand-locales.test.ts`.

---

## 7. Estado actual

| Dato | Valor |
|---|---|
| Etiquetas emitidas | 52 |
| Tokens distintos | 52 (ninguno duplicado) |
| Etiquetas huérfanas | 0 |
| Etiquetas de equipos con origen `INVENTARIO PH01.xlsx` | 2 |
| Etiquetas por unidad | `PZ01` 15, `DN03` 13, `KF02` 13, `CW04` 11 |

Las 2 etiquetas de origen PH01 corresponden a los dos equipos cuyo `asset_code`
incluye el texto largo del documento (Mini-PC y guarda monedas). Sus tokens se
conservan: el equipo sigue existiendo, ahora en `PZ01`.

---

## 8. Problemas frecuentes

**"No hay impresoras"**
Zebra Browser Print no está instalado, o el navegador no puede hablar con él. Se
instala desde el sitio de Zebra; el puerto por defecto es el 9100.

**"La impresora no está lista"**
La impresora está en estado de error o sin papel. `checkStatus()` lo consulta
antes de mandar nada.

**El QR no se escanea**
La URL debe ser la de producción. Si `NEXT_PUBLIC_APP_URL` apunta a
`localhost`, la etiqueta imprimida lleva una dirección que no existe fuera de ese
ordenador.

**Se reimprimió una etiqueta y la anterior dejó de funcionar**
Esperado: reemitir genera un token nuevo e invalida el anterior. `upsert` no
duplica, pero **sustituye**.

**Un equipo sin etiqueta**
La etiqueta es opcional. `/equipment` muestra su estado de seguridad, y `/labels`
genera la que falte. Los 29 equipos sin etiqueta no están rotos.
