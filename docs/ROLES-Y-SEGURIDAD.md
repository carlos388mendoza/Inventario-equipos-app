# Roles y seguridad

Documento para profesor y desarrollador. Explica quién puede hacer qué, cómo se
valida en el servidor, y qué protege (y qué no) cada mecanismo.

---

## 1. Los tres roles

El rol vive en `user.role`, declarado en `lib/db/enums.ts`:

```ts
export const ROLES = {
  ADMIN: "ADMIN",
  RESTAURANT_USER: "RESTAURANT_USER",
  IT_MANAGER: "IT_MANAGER",
} as const;
```

| Valor | Etiqueta en la interfaz | Alcance |
|---|---|---|
| `ADMIN` | Administrador | Global. Además administra usuarios, restaurantes y tipos. |
| `IT_MANAGER` | IT Manager | Global. Gestiona inventario, solicitudes, movimientos y etiquetas, pero **no** usuarios ni restaurantes. |
| `RESTAURANT_USER` | Usuario de restaurante | Solo su `user.restaurantId`. |

**Los valores van en mayúsculas.** Los valores por defecto se normalizan con
`asUserRole()`, que cae en `RESTAURANT_USER` ante un valor desconocido: un rol
 corrupto no abre permisos, los cierra.

---

## 2. La matriz de permisos

| Capacidad | ADMIN | IT_MANAGER | RESTAURANT_USER |
|---|:--:|:--:|:--:|
| Ver los datos de su restaurante | ✅ | ✅ | ✅ |
| Ver los datos de todos los restaurantes | ✅ | ✅ | ❌ |
| Crear una solicitud | ✅ | ✅ | ✅ (propias) |
| Ver todas las solicitudes | ✅ | ✅ | ❌ |
| Cambiar el estado de una solicitud | ✅ | ✅ | ❌ |
| Ver su propio historial de solicitudes | ✅ | ✅ | ✅ |
| Crear y editar equipos | ✅ | ✅ | ❌ |
| Cambiar el estado de un equipo | ✅ | ✅ | ❌ |
| Mover, copiar, sustituir o archivar | ✅ | ✅ | ❌ |
| Emitir e imprimir etiquetas | ✅ | ✅ | ❌ |
| Ver estadísticas | ✅ | ✅ | ❌ |
| Asistente de estadísticas (IA) | ✅ | ✅ | ❌ |
| Crear solicitud por voz (IA) | ✅ | ✅ | ✅ (dentro de su alcance) |
| Gestionar restaurantes | ✅ | ❌ | ❌ |
| Gestionar tipos de equipo | ✅ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ |
| Ajustes del dispositivo | ✅ | ✅ | ✅ |

---

## 3. Tres capas, y la última es la que importa

### Capa 1 — La navegación (UX)

`lib/navigation.ts` declara, para cada sección, los roles que la ven. El sidebar
filtra con esa lista. **Esto es solo comodidad**: si alguien navega a una URL que
no le corresponde, la siguiente capa lo detiene.

### Capa 2 — La página

Cada página del panel llama a `requireUser()` y, si hace falta, a `requireRole()`:

```ts
// app/(dashboard)/layout.tsx
const user = await requireUser();     // todo el grupo exige sesión

// app/(dashboard)/restaurants/page.tsx
await requireRole(ROLES.ADMIN);       // y además este rol
```

`requireUser()` redirige a `/login` si no hay sesión. `requireRole()` redirige a
`/dashboard` si el rol no vale.

### Capa 3 — La acción y la consulta (la que protege el dato)

Cada server action vuelve a comprobar el rol, y cada consulta se filtra por el
alcance. **Esta es la capa que importa**, porque es la única que se ejecuta aunque
alguien manipule la petición.

---

## 4. El alcance: `resolveScope()`

```ts
// lib/equipment/scope.ts
{
  user,               // SessionUser
  role: UserRole,
  isGlobal: boolean,  // true para ADMIN e IT_MANAGER
  restaurantId: string | null,
}
```

`canAccessGlobal()` define el alcance global, y `assertRestaurantAccess()`
lanza si se pide un restaurante que está fuera de él:

```ts
export function canAccessRestaurant(scope, restaurantId) {
  return scope.isGlobal || scope.restaurantId === restaurantId;
}
```

**Por qué esto importa:** si una acción confiara en el `restaurantId` que envía el
formulario, un `RESTAURANT_USER` podría cambiarlo en las herramientas del
navegador y ver los datos de otra unidad. Como el alcance se resuelve en el
servidor a partir de la **sesión**, el cliente no tiene nada que manipular.

`app/(dashboard)/requests/actions.ts` lo aplica incluso sobre el equipo a
reemplazar: si `row.restaurantId !== restaurantId`, la acción devuelve
*"El equipo a reemplazar pertenece a otro restaurante"*.

---

## 5. El rol no lo elige el cliente

En `lib/auth/server.ts`, los tres campos propios del usuario se declaran con
`input: false`:

```ts
user: {
  additionalFields: {
    role:         { type: "string", input: false, defaultValue: ROLES.RESTAURANT_USER },
    restaurantId: { type: "string", input: false },
    active:       { type: "boolean", input: false, defaultValue: true },
  },
},
```

Better Auth **ignora** cualquier valor que el cliente mande para esos campos. Solo
cambian desde `app/(dashboard)/users/actions.ts`, que exige `ADMIN`.

---

## 6. Sesiones

- Correo y contraseña, con mínimo 8 caracteres.
- `disableSignUp: true`: **no hay registro público**. Las cuentas las crea un
  ADMIN desde `/users`.
- La sesión dura 7 días y se renueva cada 24 horas.
- `BETTER_AUTH_SECRET` es **obligatoria en producción**: si falta, la aplicación
  lanza un error al arrancar, en vez de arrancar con un secreto de prueba.
- Desactivar una cuenta (`active = false`) cierra sus sesiones. Además,
  `isAccountActive()` lo comprueba como barrera adicional.

---

## 7. La ficha pública: el único punto sin sesión

`app/e/[token]/page.tsx` es deliberadamente la única ruta sin autenticación,
porque tiene que funcionar escaneando un QR con cualquier cámara, sin que nadie
tenga una cuenta.

Lo que la hace segura:

| Decisión | Por qué |
|---|---|
| El token es un UUID aleatorio, no el `id` del equipo | No se puede enumerar el inventario. |
| La búsqueda es por `token`, jamás por `id` | Un `id` adivinado no serviría de nada. |
| El `SELECT` lista los campos uno a uno | Una columna nueva no se expone por accidente. |
| No incluye serie, notas ni usuarios | Lo que no se consulta, no se puede filtrar. |
| `robots: noindex, follow` | Las etiquetas no entren en el índice de búsqueda. |

El riesgo asumido es el inherente a un QR físico: quien lo fotografíe podrá ver
esa etiqueta. Por eso la etiqueta **no contiene nada sensible** por diseño.

---

## 8. La IA no ejecuta SQL

Las dos funciones de IA usan **tools con consultas predefinidas** escritas a mano
con Drizzle. El modelo elige qué tool llamar y con qué argumentos validados por
Zod; nunca escribe una consulta.

Además, cada función resuelve el alcance antes de responder, así que el asistente
de un `RESTAURANT_USER` solo puede hablar de su restaurante.

Si falta `OPENROUTER_API_KEY`, las funciones se ocultan y la app sigue
funcionando. Ver [`IA.md`](IA.md).

---

## 9. Qué protege cada mecanismo

| Mecanismo | Protege contra | No protege contra |
|---|---|---|
| Filtro del sidebar | El usuario que busca un módulo que no le toca | Nada: es solo UX |
| `requireUser()` / `requireRole()` en la página | Entrar a una URL sin sesión o sin rol | Manipular la petición si la acción no repite la comprobación |
| `requireRole()` en cada server action | **Manipular la petición** | Un fallo de lógica en la propia acción |
| `resolveScope()` + `assertRestaurantAccess()` | Ver o modificar datos de otro restaurante | — |
| `input: false` en Better Auth | Auto-concederse rol o restaurante | Un ADMIN que lo cambie |
| Token opaco del QR | Enumerar el inventario | Quien fotografíe el QR |
| `noindex` en la ficha pública | Que las etiquetas aparezcan en buscadores | Que alguien con la URL la abra |
| `robots.txt` | Que un crawler recorra el panel | Acceso sin sesión (eso lo hace `requireUser`) |
| Transacciones | Escrituras parciales | Entradas inválidas (eso lo evita Zod) |

---

## 10. Debilidades conocidas y aceptadas

- **No hay CSP.** La guía `content-security-policy` de Next existe, pero aplicar
  el *nonce* en un despliegue con service worker y Browser Print requiere pruebas
  que no se han hecho. Se deja pendiente.
- **`BETTER_AUTH_URL` es la única defensa de origen.** No hay lista
  `trustedOrigins` configurada; si el despliegue cambia de dominio hay que
  actualizar esa variable.
- **El hash de secreto de desarrollo está en el código**
  (`dev-secret-inseguro-...`). Solo se usa cuando `NODE_ENV !== "production"`, y en
  producción la app se niega a arrancar sin `BETTER_AUTH_SECRET`. Aun así, conviene
  no ejecutar el repositorio con `NODE_ENV=production` en un entorno compartido.
- **El alcance depende de la sesión, no de una política por tabla.** Cada consulta
  nueva debe acordarse de usar `resolveScope()`. No hay una barrera que lo impida
  automáticamente; lo cubren la revisión y los tests de autorización.
- **No hay registro de auditoría de accesos.** Se registra qué usuario hizo cada
  cambio de estado, cada movimiento y cada etiqueta, pero no los intentos
  denegados.

---

## 11. Cómo verificar una autorización

Los tests de autorización son la red de seguridad:

```bash
npm run test -- lib/equipment/movements-auth.test.ts
```

`movements-auth.test.ts` comprueba que un `RESTAURANT_USER` no puede ejecutar
ninguna de las cinco acciones de movimiento. Al añadir una acción nueva, **añade
su caso ahí**: una acción sin test de denegación es una acción sin probar.
