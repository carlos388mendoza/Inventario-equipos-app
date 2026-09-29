# Planificación

Documento para profesor. Separa con claridad lo que **está implementado**, lo que
**quedó a medias** y lo que **no se puede comprobar desde el repositorio**.

> Esta clasificación es la regla de oro de toda la documentación: si no está en el
> código, no se afirma que exista.

---

## 1. IMPLEMENTADO — Verificado en el código

### Infraestructura

- Next.js 16.3.5 App Router con Server Components, y `strict: true` en TypeScript.
- Tailwind CSS v4 sin `tailwind.config`: se configura con variables CSS.
- ESLint plano, sin dependencias extra.
- PWA instalable: `app/manifest.ts`, service worker y `offline.html`.
- Despliegue en Vercel, base de datos en Turso.

### Autenticación y autorización

- Better Auth con correo y contraseña, mínimo 8 caracteres.
- **Registro público deshabilitado** (`disableSignUp: true`).
- Tres roles: `ADMIN`, `IT_MANAGER`, `RESTAURANT_USER`.
- `role`, `restaurantId` y `active` son `input: false`: el cliente no los fija.
- Autorización en servidor en **cada** página y **cada** server action.
- Alcance por restaurante con `resolveScope()` y `assertRestaurantAccess()`.
- Sesión de 7 días, renovada cada 24 horas.
- Desactivar una cuenta cierra sus sesiones.

### Módulos

| Módulo | Estado |
|---|---|
| Panel con contadores | ✅ |
| Inventario de equipos (CRUD, filtros, ficha) | ✅ |
| Inventario por documento (individual + agregado) | ✅ |
| Tipos de equipo (CRUD, catálogo editable) | ✅ |
| Solicitudes: crear, listar, cambiar estado | ✅ |
| Mis solicitudes + historial | ✅ |
| Movimientos: 6 tipos + archivado + lote + libro | ✅ |
| Etiquetas: emisión, QR, vista previa | ✅ |
| Impresión ZPL en Zebra | ✅ |
| Estadísticas con Recharts | ✅ |
| Restaurantes (CRUD) | ✅ |
| Usuarios (CRUD, rol, asignación) | ✅ |
| Ajustes de tema y densidad | ✅ (en el dispositivo) |
| Ficha pública del QR | ✅ |

### Datos y trazabilidad

- 13 tablas, 5 migraciones aplicadas.
- Trazabilidad verbatim a los documentos de origen (6 columnas `source_*`).
- Libro de movimientos que **sobrevive** al equipo (sin `cascade`).
- Bloqueo del borrado de equipos que aparecen en el libro.
- `batch_id` para los movimientos masivos.
- `equipment_groups` separado de `equipment` a propósito.

### Etiquetas e impresión

- Token opaco (UUID sin guiones), único y de una sola etiqueta por equipo.
- La ficha pública **no** expone serie, notas ni usuarios.
- ZPL propio: geometría, sanitización de texto, codificador GFA, logos embebidos.
- Hash de congelamiento del ZPL verificado por test.
- Cola de impresión con resultado por etiqueta.
- Numeración de locales por marca.

### Calidad

- 13 archivos de test, 220 pruebas, todas en verde.
- `typecheck`, `lint` y `build` sin errores ni avisos.

### SEO y exposición

- `metadataBase`, canonical, Open Graph, Twitter Card, keywords.
- `robots.txt` generado con 14 rutas privadas excluidas.
- `sitemap.xml` generado con la única URL pública.
- `noindex` en login y en la ficha del QR.
- Landing pública estática, sin acceso a la base de datos.

---

## 2. IMPLEMENTADO PARCIALMENTE

| Área | Lo que falta |
|---|---|
| **Analytics** (stats-agent) | Responde con datos reales de consultas predefinidas, pero **no escribe**. Toda decisión la toma una persona. |
| **Solicitud por voz** | Extrae y rellena los campos, pero **no crea** la solicitud: hay que revisarla y confirmarla. |
| **Modelos de inventario** | Hay dos formatos (`PER_ASSET` y `AGGREGATE`). Un tercer documento con otra estructura exigiría un formato nuevo. |
| **Agregados** | `equipment_groups` cubre hoy `DNS19.xlsx` (Denny's). `AGGREGATE_INVENTORY_BRANDS` lista marcas, pero el importador solo conoce ese documento. |
| **Reactividad entre pestañas** | `revalidatePath` refresca la pestaña que actúa; las demás se avisan con `BroadcastChannel` y **vuelven a pedir su ruta**. No hay sincronización en tiempo real (WebSocket/SSE). |
| **Service worker** | Cachea navegación y estáticos, pero **no** cachea `/api/` ni los payloads del router. Offline es limited a lo ya visitado. |
| **Gestión de unidades** | Existe el alta y la activación (`active`), pero no hay una fusión completa desde la interfaz: la consolidación de `PH01` → `PZ01` se hizo con un script de mantenimiento. |
| **Documentos de origen** | Se guardan y se muestran, pero no hay **visor** del Excel original ni de sus imágenes. |
| **Ajustes** | Tema y densidad se guardan en el dispositivo, no en la cuenta. Cambiar de equipo no los conserva. |
| **Búsqueda** | Filtros por texto y campos en cada módulo. No hay búsqueda global ni búsqueda difusa. |
| **Auditoría de accesos** | Se registra **qué** hizo cada usuario, pero no los intentos denegados ni los inicios de sesión. |
| **ZPL** | Congelado por hash. Añadir un campo a la etiqueta exige romper el lock a propósito. |
| **Restaurantes** | Alta, edición y activación. No hay una fusión completa de unidades desde la interfaz: la consolidación de `PH01` → `PZ01` se hizo con un script de mantenimiento. |

---

## 3. SOLICITADO ORIGINALMENTE, NO IMPLEMENTADO

> Estos puntos **no se pueden confirmar** a partir del repositorio: no hay
> historial de requisitos, ni issues, ni especificación. Se listan como
> *no verificables* y **no** se afirma que fueran pedidos.

| Área | Estado |
|---|---|
| **Compras y proveedores** | No existe nada de compras, proveedores, órdenes ni costos. Solo hay solicitudes de equipo. |
| **Notificaciones** | No hay correo, SMS, push ni webhooks. La única señal es el `Toaster` en la propia sesión. |
| **Adjuntos** | No hay subida de archivos ni documentos adjuntos a un equipo o solicitud. |
| **Costo y depreciación** | `equipment_groups.total_value` guarda el valor de línea de un documento. No hay depreciación, valor libro ni costo por equipo. |
| **Dashboard para la gerencia** | Las estadísticas son operativas. No hay objetivos, presupuestos ni comparativas. |
| **Integración con la TPV** | No hay integración con sistemas de punto de venta. |
| **Aplicación móvil nativa** | La PWA es instalable, pero no hay app nativa. |
| **Roles configurables** | Los tres roles son fijos en `lib/db/enums.ts`. Un ADMIN puede asignar usuarios a un rol, pero no crear roles nuevos. |
| **Campos personalizados** | Los tipos de equipo se editan, pero el resto del esquema es fijo. |
| **Exportación a Excel/CSV** | No hay exportación de datos. |
| **Histórico de precios** | `equipment.purchase_date` existe, pero no hay precios. |
| **Firmas o aprobaciones por niveles** | Las aprobaciones son de un rol, sin niveles ni umbrales. |

---

## 4. NO VERIFICABLE DESDE EL REPOSITORIO

Estos puntos no se pueden confirmar **ni desmentir** mirando el código:

| Punto | Por qué no se puede saber |
|---|---|
| **Si la IA está en producción real** | Depende de `OPENROUTER_API_KEY`, que no está en el repositorio, y de las claves de la interfaz. |
| **Quién usa la aplicación y cuánto** | No hay analítica. |
| **Si las impresoras Zebra están configuradas** | Zebra Browser Print se instala por equipo, fuera del repositorio. |
| **Si alguien imprimió etiquetas** | `security_labels` no registra impresión, solo emisión. |
| **Volumen y fecha de los Excel de origen** | Solo se conserva `source_document` como texto. Los archivos no están en el repositorio. |
| **Quiénes son los usuarios reales** | `user` tiene 3 filas de demostración. Los datos personales no se documentan. |
| **Si el despliegue está configurado bien** | Las variables de entorno de Vercel no están en el repositorio. |
| **Si el dominio está dado de alta en buscadores** | La indexación no se puede comprobar desde el código. |
| **Quién pidió cada funcionalidad** | No hay historial de requisitos ni registro de decisiones. |
| **Si se cumplen requisitos de la organización** | No hay especificación de alcance ni auditoría externa. |
| **Horas de trabajo y coste** | No hay historial de commits por persona ni tasación. |
| **Si el hash ZPL corresponde al logo correcto** | El hash **sí** se verifica contra el repositorio, pero que el logo sea el de marca correcta es una revisión visual. |

---

## 5. Deuda técnica y pendientes Priorizados

### Alta

1. **CSP.** No hay `Content-Security-Policy`. La guía de Next existe, pero
   aplicarla con el service worker y Browser Print requiere pruebas.
2. **Lista de etiquetas generadas para equipos nuevos.** Un equipo nuevo no trae
   etiqueta; hay que ir a `/labels` a emitirla. Podría sugerirse al crearlo.
3. **Restaurar un equipo archivado.** Hoy se hace editando el equipo a mano desde
   la ficha; merece una acción propia con su registro en `history`.

### Media

4. **Analítica** de uso, si se decide que interesa medir.
5. **Dar de alta el dominio** en Google Search Console y Bing Webmaster Tools, y
   enviar el `sitemap.xml`.
6. **Limpiar los SVG de plantilla** sin usar de `public/` (`next.svg`,
   `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`).
7. **Renombrar `public/brands/pizza-hut.jpg`**, que es un AVIF con extensión `.jpg`.
   No es un error funcional: se deja hasta que haya un momento tranquilo.
8. **Consolidar la documentación del QR**: hoy está en el README, en
   `docs/ETIQUETAS-Y-QR.md` y en los comentarios de `security_labels`. Conviene
   que el README apunte y no repita.
9. **Prueba de extremo a extremo real de impresión** en una ZD230, más allá de los
   tests de la cola.

### Baja

10. **Asset cuadrado del logo corporativo.** El actual es un lockup 2.79:1 con
    fondo horneado; dentro de un círculo se ve como una banda compacta.
11. **Auditoría de accesos denegados.**
12. **Búsqueda global.**
13. **Roles configurables**, si algún día hacen falta más de tres.
14. **Verificación automática en CI.** Los comandos existen
    (`typecheck`, `lint`, `test`, `build`), pero no hay flujo que los ejecute
    automáticamente en cada cambio.

---

## 6. Lo que se decidió NO hacer (y por qué)

| Decisión | Motivo |
|---|---|
| **No borrar equipos** | El libro de movimientos y el historial son auditoría. Un borrado destruiría la trazabilidad. En su lugar, archivar a `RETIRED`. |
| **No meter los agregados en `equipment`** | Una fila de `DNS19.xlsx` son N unidades de un rubro. Duplicarla perdería el valor del documento y daría identidad falsa a filas que no son un equipo. |
| **No poner PH01 como unidad por defecto** | Ya no existe. El script de consolidación exige `--source` y `--target` explícitos, así que ninguna ejecución puede asumir que exista. |
| **No "limpiar" los datos de origen** | `source_*` guarda el documento **verbatim**. Normalizar el código corto o la fecha sería inventar información. |
| **No editable el ZPL sin motivo** | Está congelado por hash porque cambia bytes de una etiqueta ya validada. |
| **No confiar en el cliente para el alcance** | `restaurantId` enviado por el formulario se ignora: el alcance sale de la sesión. |
| **No indexar el panel** | Es una aplicación interna. Se expone **una** landing, y el resto se cierra con `robots.txt` y `noindex`. |
| **No inventar una clave de verificación** | El código de Search Console se obtiene al dar de alta el dominio. Se deja el hueco preparado, no rellenado con un valor inventado. |
| **No añadir dependencias** | Todo lo necesario ya estaba: Radix, `qrcode`, `zebra-browser-print-wrapper`, `recharts`, `zod`, `streamdown`. El drawer se hizo con `@radix-ui/react-dialog` en vez de añadir otra librería. |

---

## 7. Una nota sobre `AGENTS.md`

`AGENTS.md` es el archivo de reglas del repositorio para asistentes de IA. Al
auditarlo se encontraron **desajustes con el código real**:

| Dice `AGENTS.md` | Realidad |
|---|---|
| Roles `admin`, `restaurant`, `it_manager` | `ADMIN`, `RESTAURANT_USER`, `IT_MANAGER` |
| Estados `pending → approved → purchased → delivered` | `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED` |
| Tabla `request_status_history` | `request_history` |
| Campo `publicToken` | `security_labels.token` |
| Tipos de solicitud con columna `kind` | No hay columna: `currentEquipmentId` nulo = compra |
| `replacesEquipmentId` | `currentEquipmentId` |
| Better Auth con plugin `admin` | Roles propios (`input: false`), sin plugin |
| `AI_PROVIDER_API_KEY` | `OPENROUTER_API_KEY` |

Cada regla de seguridad y de convención de `AGENTS.md` **se ha respetado** en esta
fase: no se tocó autenticación, roles, esquema, migraciones ni los flujos de
movimientos, y la base de datos solo se leyó.
