# Movimientos de inventario

Documento para usuario técnico. Explica los siete flujos, qué hace cada uno y
qué decide el servidor frente a lo que decide la interfaz.

---

## 1. La idea central: dónde está y de quién es

Todo el módulo gira alrededor de una distinción que el sistema mantiene en dos
columnas:

| Columna | Significa |
|---|---|
| `equipment.restaurantId` | **Dónde** está el equipo ahora |
| `equipment.ownerRestaurantId` | **De quién** es el equipo |

Normalmente coinciden, y `ownerRestaurantId` es `NULL`. Se separan **solo durante
un préstamo vigente**:

```
ownerRestaurantId != null && ownerRestaurantId != restaurantId
   ⟺ el equipo está en préstamo
```

Por eso un equipo prestado se puede mover de sitio sin dejar de pertenecer a su
dueño, y la devolución lo manda a casa sin ambigüedad.

---

## 2. Los siete flujos

El sistema registra **6 tipos** en `equipment_movements` y ofrece **7 operaciones**,
porque el archivado es una baja y no un cambio de ubicación.

| # | Operación | Tipo | Crea equipo | Cambia propietario | Lote | Efecto |
|---|---|---|:--:|:--:|:--:|---|
| 1 | Traslado | `TRANSFER` | No | Sí | Sí | El equipo pasa a ser del destino. |
| 2 | Jalado | `PULL` | No | Sí | Sí | Mismo efecto sobre la ubicación, distinto propósito. |
| 3 | Préstamo | `LOAN_OUT` | No | **No** | Sí | El equipo sale a otra unidad y sigue siendo del dueño. |
| 4 | Devolución | `LOAN_RETURN` | No | Se restablece | Sí | Vuelve al propietario. |
| 5 | Copia | `COPY` | **Sí** | Sí | No | Equipo nuevo con los mismos datos. |
| 6 | Sustitución | `REPLACEMENT` | **Sí** | Sí | No | El sustituido queda fuera de servicio. |
| 7 | Archivado | *(no es movimiento)* | No | No | No | Pasa a `RETIRED` con motivo en el historial. |

### 1. Traslado (`TRANSFER`)

El equipo pasa a ser de la unidad destino. Conserva identidad, número de serie,
etiqueta e historial. Es la operación más común y admite lote.

### 2. Jalado (`PULL`)

El efecto sobre la ubicación es un traslado. Se registra aparte para poder
distinguir *"lo traje de vuelta"* de *"lo mandé"*, que es información real de
operación. Si el equipo estaba en préstamo, la devolución la hace el propietario.

### 3. Préstamo (`LOAN_OUT`)

El equipo sale temporalmente a otra unidad. **No deja de pertenecer a su
propietario**, así que la devolución lo devuelve a casa. Admite lote.

Estados permitidos: `ACTIVE`, `DAMAGED`, `MAINTENANCE`. No se presta un equipo
retirado ni uno ya sustituido.

### 4. Devolución (`LOAN_RETURN`)

El equipo vuelve a su unidad propietaria y `ownerRestaurantId` vuelve a `NULL`.
Solo tiene sentido sobre un equipo en préstamo; por eso en la interfaz el botón
de devolución **sustituye** al de mover cuando el equipo está prestado, y copiar
o sustituir aparecen deshabilitados con la explicación "devuelve el equipo antes
de…".

### 5. Copia (`COPY`)

Se crea un equipo **nuevo** con los mismos datos. El original no se mueve y
conserva su número de serie y su etiqueta. La copia necesita **código y serie
propios**, y el servidor comprueba que el código esté libre antes de escribir.

El linaje se guarda en `equipment.originEquipmentId`, y el origen queda
registrado como `counterpartEquipmentId` en el movimiento.

### 6. Sustitución (`REPLACEMENT`)

Un equipo entra a sustituir a otro. El sustituido queda fuera de servicio y
enlazado con su sustituto mediante `replacedByEquipmentId`; el nuevo hereda los
datos del antiguo. El movimiento registra el par en
`equipmentId` / `counterpartEquipmentId`.

### 7. Archivado

No es un movimiento: **no escribe en `equipment_movements`**. Pone el equipo en
`RETIRED` y anota el motivo en `equipment_history`.

Es la alternativa honesta a "borrar": conserva el QR público, el historial y el
libro de movimientos, y lo único que cambia es que el equipo deja de estar
disponible.

---

## 3. El movimiento masivo

No es un séptimo tipo: es **la misma operación aplicada a varios equipos**. Todos
los movimientos comparten un `batchId`, de modo que "moví 12 equipos a la vez" es
una sola entrada consultable en el libro.

Tipos que admiten lote: `TRANSFER`, `PULL`, `LOAN_OUT`, `LOAN_RETURN`.
`COPY` y `REPLACEMENT` no, porque crean un equipo por equipo y necesitan datos
propios (código, serie, destino) que no tienen sentido agrupar.

Antes de aplicar un lote, `validateBatch()` y `summarizeBatch()` revisan el
conjunto entero y devuelven qué se va a hacer y qué se va a rechazar, para que la
persona vea el efecto antes de confirmar.

---

## 4. Quién puede mover

| | ADMIN | IT_MANAGER | RESTAURANT_USER |
|---|:--:|:--:|:--:|
| Traslado, jalado, préstamo, devolución, copia, sustitución | ✅ | ✅ | ❌ |
| Archivo masivo | ✅ | ✅ | ❌ |
| Archivado | ✅ | ✅ | ❌ |
| Ver el libro de movimientos | ✅ | ✅ | ❌ |

Las cinco acciones (`moveEquipment`, `bulkMoveEquipment`, `copyEquipment`,
`replaceEquipment`, `archiveEquipment`) están en
`app/(dashboard)/equipment/movements/actions.ts`, cada una empieza con
`requireRole(ROLES.ADMIN, ROLES.IT_MANAGER)`.

`lib/equipment/movements-auth.test.ts` comprueba explícitamente que un usuario de
restaurante no puede ejecutar ninguna de ellas.

---

## 5. Qué decide el servidor y qué decide la interfaz

**La interfaz solo evita ofrecer lo que ya va a fallar.** Por ejemplo, no ofrece
elegir como destino la unidad de la que parte el equipo, o copiar un equipo que
está en préstamo.

**El servidor es quien decide de verdad:**

| Comprobación | Dónde |
|---|---|
| Que el equipo exista y esté dentro del alcance del usuario | `loadEquipmentForScope()` |
| Que el equipo pueda moverse desde su estado actual | `checkLocationChange()` |
| Que el destino sea distinto y válido | `checkLocationChange()` |
| Que el equipo no esté ya en préstamo | `checkLocationChange()` |
| Que el código de una copia esté libre | `checkCopyInput()` |
| Que un reemplazo tenga sentido con el estado actual | `checkReplacement()` |
| Que el lote completo sea coherente | `validateBatch()` |

Todo eso son **funciones puras** en `lib/equipment/movements.ts`, sin React ni
conexión a la base, y por eso están cubiertas por tests. Las acciones del servidor
las invocan dentro de la transacción.

Cada escritura se hace dentro de `db.transaction(...)`, de modo que un lote
parcialmente válido **no** deja la base a medias.

---

## 6. El catálogo: por qué añadir un tipo no es escribir un diálogo

Cada tipo se declara una vez en `MOVEMENT_DEFINITIONS`:

```ts
{
  type, label, description,
  createsEquipment,            // ¿crea un equipo nuevo?
  requiresDifferentDestination,// ¿el destino debe ser distinto?
  changesOwnership,            // ¿se separa propietario de ubicación?
  supportsBatch,               // ¿admite lote?
  allowedStatuses,             // ¿desde qué estados se puede hacer?
}
```

La interfaz se construye a partir de ahí. **Añadir un tipo nuevo es añadir una
entrada al catálogo y su test**, no escribir un diálogo nuevo. Los tres diálogos
que existen (mover, copiar, sustituir) se generan desde esas banderas.

---

## 7. El libro de movimientos

`equipment_movements` es la fuente de verdad del módulo, y responde a una pregunta
que `equipment_history` no puede contestar: `equipment_history` guarda un `action`
de texto libre y no dice a dónde se movió el equipo ni por qué.

La vista `/movements` muestra el libro con filtros y el detalle de cada entrada.

### Auditoría sobre el borrado

`equipment_movements` **no** tiene `onDelete: cascade` sobre `equipment` a
propósito. Si se intenta borrar un equipo que aparece en el libro, la acción
comprueba las referencias y **bloquea el borrado** con un mensaje que explica
por qué, en lugar de arrastrar el historial. `describeDeletionBlockers()` y
`DELETION_BLOCKER_LABELS` construyen ese mensaje.

### Lectura de linaje

- `equipment.originEquipmentId` → de qué equipo se creó esta copia.
- `equipment.replacedByEquipmentId` → qué equipo sustituyó a este.
- "A quién sustituyó este equipo" → se consulta en `equipment_movements`, no con
  una columna inversa.

---

## 8. Trazabilidad de los documentos de origen

Cuando un equipo viene de un Excel, el movimiento **no toca** las columnas
`source_*`. Un equipo que se mudó de PZ01 a DN03 sigue registrando su documento de
origen, su código corto, su técnico de apertura y su fecha tal como venían en el
archivo.

Mover un equipo cambia **dónde está**, nunca **de dónde vino**.

---

## 9. Preguntas frecuentes

**¿Por qué un equipo no se puede mover?**
Puede estar en préstamo, en `RETIRED` o `REPLACED`, el destino puede coincidir con
su ubicación actual, o puede no haber otras unidades disponibles. El mensaje de
la acción dice cuál de esas es.

**¿Se puede deshacer un traslado?**
No hay acción de "revertir". Se hace un traslado o un jalado en sentido contrario,
que queda registrado como un movimiento nuevo. Un libro de movimientos es un
registro de hechos, no una pila de operaciones que se puedan anular.

**¿Archivar es borrar?**
No. Archivar pone el equipo en `RETIRED`. El equipo, su etiqueta, su QR, su
historial y sus movimientos siguen existiendo. No hay borrado de equipos en la
interfaz, y es deliberado.

**¿Por qué copiar y sustituir no admiten lote?**
Porque cada equipo nuevo necesita código y serie propios, y el servidor tiene que
comprobar que estén libres uno a uno. Agrupar eso no ahorra trabajo real.

**¿El movimiento cambia la etiqueta?**
No. La etiqueta pertenece al equipo, no a la unidad donde está. Por eso
`revalidateMovementViews()` no invalida `/labels`.

**¿Un equipo prestado aparece en el restaurante que lo tiene?**
Sí: aparece en su `restaurantId`, que es donde está. Para saber de quién es, las
consultas usan `ownerRestaurantId` o la función `effectiveOwnerRestaurantId()`.
