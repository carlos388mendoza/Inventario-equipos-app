# Arquitectura

Documento para desarrolladores. Describe cómo está construido el sistema y por
dónde tocar sin romper las reglas del proyecto.

---

## 1. Forma general

Una sola aplicación Next.js (App Router) que hace de servidor **y** de cliente:

```
Navegador ──► Next.js (App Router)
                 │
                 ├── Server Components  → leen la BD directamente (Drizzle)
                 ├── Server Actions     → escriben, validan y autorizan
                 └── Client Components  → interacción (Radix + formularios)
                          │
                          ▼
                    Turso (libSQL)
```

No hay API REST para el CRUD: la mutación viaja por **Server Actions** y la
lectura ocurre en el servidor. Las únicas route handlers (`app/api/`) son las de
Better Auth y las dos de IA.

---

## 2. Capas y dónde vive cada cosa

| Capa | Ubicación | Regla |
|---|---|---|
| Rutas y páginas | `app/**/page.tsx` | Server Components por defecto. Resuelven sesión y alcance. |
|acciones de escritura | `app/(dashboard)/*/actions.ts` | `"use server"`. Validan con Zod, autorizan y transaccionan. |
| Lógica de datos | `lib/db/queries/*` | Consultas puras. Reciben el `db` o el scope como parámetro. |
| Esquema | `lib/db/schema/*` | Tablas, índices y relaciones. Fuente de la migraciones. |
| Constantes de negocio | `lib/db/enums.ts` | Estados, roles, prioridades y tipos. **Sin duplicar en la interfaz.** |
| Reglas de dominio | `lib/equipment/*`, `lib/labels/*`, `lib/restaurants/*` | Funciones puras y testeables, sin React. |
| Componentes | `components/**` | Solo presentación e interacción. |
| Utilidades transversales | `lib/revalidate.ts`, `lib/sync/*` | Invalidación de vistas y sincronización entre pestañas. |

**Regla de oro:** la lógica de datos no vive en componentes. Si una regla se
puede escribir como función pura (los movimientos, el ciclo de vida, la
consolidación), se escribe en `lib/` y se testea sin montar nada.

---

## 3. El patrón de una página

Todas las páginas del panel siguen el mismo esqueleto:

```ts
// 1. Autenticación: ¿hay sesión?
const user = await requireUser();

// 2. Rol: ¿este rol puede entrar aquí?
const admin = await requireRole(ROLES.ADMIN);   // solo si aplica

// 3. Alcance: ¿qué datos puede ver?
const scope = await resolveScope();             // global o su restaurante

// 4. Lectura en paralelo
const [a, b] = await Promise.all([queryA(scope), queryB(scope)]);

// 5. Render
return <Vista datos={a} />;
```

`resolveScope()` (`lib/equipment/scope.ts`) es la pieza clave:

```ts
{
  user,               // SessionUser
  role,               // UserRole
  isGlobal: true,     // ADMIN o IT_MANAGER
  restaurantId: null, // el restaurante del usuario, si es RESTAURANT_USER
}
```

Ninguna consulta confía en un `restaurantId` que venga del cliente: el alcance se
resuelve en el servidor y se compara con `assertRestaurantAccess()`.

---

## 4. El patrón de una acción

```ts
"use server";

export async function miAccion(input: unknown) {
  const user = await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);  // 1. rol
  try {
    const parsed = miSchema.parse(input);                        // 2. Zod
    // 3.validar existencia y alcance contra la BD
    // 4. escribir dentro de db.transaction(...)
    // 5. revalidar las vistas afectadas
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeLegible(error) };
  }
}
```

Las acciones **no lanzan excepciones hacia el cliente**: devuelven
`{ ok, error? }`. Los errores de Zod se traducen a mensajes legibles.

---

## 5. Invalidación de vistas

`lib/revalidate.ts` centraliza qué rutas dependen de qué escrituras. Es
deliberado: antes cada acción revalidaba solo su propia ruta, y por eso crear un
equipo dejaba contadores desactualizados en el panel.

```ts
revalidateEquipmentViews(equipmentId?)  // /equipment, /inventory, /dashboard, /statistics
revalidateEquipmentTypeViews()          // + /equipment-types
revalidateRequestViews()                // /requests, /my-requests, /dashboard, /statistics
revalidateLabelViews(equipmentId?)      // /labels, /dashboard, /equipment
revalidateRestaurantViews()             // /restaurants, /equipment, /inventory, /dashboard
revalidateUserViews()                   // /users
revalidateMovementViews(equipmentIds?)  // /movements + las de equipo
```

Todas estas páginas son dinámicas (`force-dynamic`), así que revalidar descarta la
entrada del router cache y la siguiente lectura vuelve a la BD. **Invalidar caché
no es autorizar**: los Server Components siguen aplicando `resolveScope()`.

> Al añadir una vista nueva que dependa de estos datos, hay que añadir su ruta
> aquí. Al revés, no: no extender la invalidación a rutas que no la necesitan.

---

## 6. Sincronización entre pestañas

`revalidatePath` refresca la **pestaña que hizo la mutación**. Las demás pestañas
del mismo navegador siguen con el payload RSC cacheado hasta que se recarga con
F5. `lib/sync/tab-sync.ts` cubre ese hueco:

- Transporte principal: `BroadcastChannel` (solo entre pestañas del mismo origen).
- Respaldo: escritura en `localStorage`, que dispara `storage` en las otras
  pestañas.
- **Privacidad:** el mensaje no lleva datos. Solo versión de protocolo, id del
  emisor y número de secuencia. Nunca códigos de activo, series, tokens, usuarios
  ni solicitudes.
- La pestaña que recibe el aviso **vuelve a pedir su propia ruta**, y es el
  servidor el que aplica el alcance. Por eso el mensaje puede ser vacío de datos
  sin perder seguridad.
- Sin bucles: cada instancia tiene `senderId` y descarta lo que ella misma envió.

El módulo no depende de React ni del DOM (recibe el entorno por inyección), lo
que permite testearlo en Node sin jsdom.

---

## 7. Componentes

- **Server Components por defecto.** `"use client"` solo donde hay estado,
  efectos o eventos.
- La frontera cliente/servidor se cruza con un componente-puente cuando hace
  falta. Ejemplo: `components/movements/detail-movement-actions.tsx` traduce el
  DTO del servidor al tipo que espera el cliente, para que la página no importe
  un client component con dependencias de Radix.
- **Radix UI** aporta el comportamiento (foco, teclado, portal). Tailwind v4 aporta
  el aspecto. `components/ui/` es la capa propia sobre Radix.
- Cuando una lista es larga, los diálogos se **montan solo mientras su operación
  está activa** en vez de renderizarse cerrados. Antes, la vista de 81 equipos
  montaba 243 diálogos y sus hooks, y eso hacía cara cada pulsación de la tabla.
- Las filas de tablas se extraen a un componente memoizado y reciben primitivos
  (`selected: boolean`) en vez de objetos, para no rerenderizar 81 filas al
  escribir en un filtro.

---

## 8. Identidad visual de marcas

`components/restaurants/restaurant-identity.tsx` centraliza cómo se ve una
marca. Cada logo tiene una caja propia, así que se **normaliza por el contenido
real** de la imagen, medido con `sharp` en el momento de escribir el componente:

- SVG: se renderiza y se mide el contenido.
- PNG/JPEG: se mide el área no blanca.

De ahí salen los ajustes por marca (posición y tamaño) que hacen que las cuatro
marcas ocupen una caja consistente sin deformarse ni recortarse. El resultado se
pasa a la BD como `restaurants.logo` y la interfaz nunca decide el tamaño.

---

## 9. Rutas de metadata y SEO

| Archivo | Ruta que sirve |
|---|---|
| `app/layout.tsx` | Metadata base de todo el sitio |
| `app/robots.ts` | `/robots.txt` |
| `app/sitemap.ts` | `/sitemap.xml` |
| `app/manifest.ts` | `/manifest.webmanifest` |
| `app/icon.png` | Favicon e icono de la app |

`lib/site.ts` es la única fuente de la URL canónica y de la lista de rutas
privadas, para que layout, robots y sitemap no puedan desincronizarse.

Las imágenes sociales (Open Graph y Twitter Card) se referencian como rutas
estáticas de `public/` en vez de usar el optimizador de Next: los campos de
metadata necesitan una URL, no un componente, y pasar un archivo ya optimizable
por ese camino añadiría una transformación en el servidor sin ganar nada.

---

## 10. PWA

`components/pwa/service-worker-register.tsx` registra `/sw.js` **solo en
producción**, para no interferir en desarrollo.

`public/sw.js` implementa:
- Navegaciones: red primero, con respaldo en `offline.html` si no hay red.
- Assets estáticos: *stale-while-revalidate*.
- No intercepta `/api/`, ni las peticiones con cabecera `rsc` o
  `next-router-prefetch`, para no cachear payloads del router.

---

## 11. Dónde tocar para cada cosa

| Quiero… | Tocar |
|---|---|
| Añadir un estado de equipo | `lib/db/enums.ts` + `lib/db/schema/app.ts` + `lib/equipment/movements.ts` |
| Añadir un tipo de movimiento | `lib/db/enums.ts` + `MOVEMENT_DEFINITIONS` + un test. **No un diálogo nuevo.** |
| Añadir una sección del panel | `lib/navigation.ts` + `app/(dashboard)/<seccion>/page.tsx` con su `requireRole` |
| Añadir un campo al equipo | `lib/db/schema/app.ts` + `drizzle-kit generate` + `lib/validation/equipment.ts` + el formulario |
| Cambiar una regla de inventario | `lib/equipment/*.ts` (función pura) + su test |
| Cambiar el ZPL | `lib/zpl/*` **y actualizar el hash del lock test**. No lo hagas sin motivo. |
| Cambiar la apariencia de una marca | `components/restaurants/restaurant-identity.tsx`. **No** regenerar el asset. |
| Añadir una variable de entorno | `lib/` o `drizzle.config.ts` + `.env.example` |
| Cambiar el SEO | `lib/site.ts` y solo eso, para el canon; el detalle en `app/robots.ts` y `app/sitemap.ts` |

---

## 12. Convenciones

- Valores en base de datos y en código: **inglés**. Textos de interfaz:
  **español**.
- Server Components por defecto; `"use client"` solo donde hace falta.
- Nada de lógica de datos en componentes.
- Migraciones con `drizzle-kit generate` + `migrate`. **No editar una migración ya
  aplicada.**
- Antes de dar algo por terminado: `npm run typecheck`, `npm run lint` y
  `npm run build` deben pasar.
- No hacer `git commit` ni `git push` sin que se pida.
- No añadir dependencias sin justificar.
