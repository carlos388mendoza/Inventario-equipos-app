# Despliegue

Documento para desarrollador. El proyecto está preparado para Vercel con Turso.

---

## 1. Arquitectura de despliegue

```
Vercel (Next.js 16, serverless)  ──►  Turso (libSQL, remoto)
        │
        └── El navegador del usuario ──► Zebra Browser Print ──► Impresora
```

Dos consecuencias que conviene tener presentes:

1. **La base de datos no está en el despliegue.** Está en Turso, accesible por
   `libsql://` + token. Un serverless function no tiene disco persistente.
2. **La impresión no pasa por el servidor.** El ZPL viaja del navegador al Zebra
   Browser Print instalado en el PC de quien imprime. Vercel no participa.

---

## 2. Variables de entorno en Vercel

En **Project → Settings → Environment Variables**:

| Variable | Entorno | Obligatoria |
|---|---|:--:|
| `TURSO_DATABASE_URL` | Production, Preview, Development | ✅ |
| `TURSO_AUTH_TOKEN` | Production, Preview | ✅ (remoto) |
| `BETTER_AUTH_SECRET` | Production, Preview | ✅ |
| `BETTER_AUTH_URL` | Production | ✅ |
| `NEXT_PUBLIC_APP_URL` | Production, Preview | ✅ |
| `OPENROUTER_API_KEY` | Production | Opcional (sin ella no hay IA) |
| `AI_MODEL` | Production | Opcional |

`NEXT_PUBLIC_*` se **incorpora al bundle del cliente en tiempo de build**. Si se
cambia en producción, hay que **re-desplegar** para que el cambio surta efecto: no
basta con guardar la variable.

`BETTER_AUTH_SECRET` sin valor hace que la aplicación **no arranque** (es
deliberado: `lib/auth/server.ts` lanza un error en producción).

---

## 3. Primer despliegue

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

1. Subir el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel: **Add New → Project** → importar el repositorio.
3. Vercel detecta Next.js y el framework. No cambiar el comando de build.
4. Añadir las variables de entorno.
5. **Deploy**.

---

## 4. Migraciones

**No forman parte del build.** Vercel ejecuta `next build`, no `drizzle-kit
migrate`. Aplicar las migraciones es un paso manual y deliberado:

```bash
# En local, con las variables de producción cargadas
$env:TURSO_DATABASE_URL = "libsql://..."
$env:TURSO_AUTH_TOKEN  = "..."
npx.cmd drizzle-kit migrate
```

Reglas:

- **Migrar antes de desplegar** el código que necesita la migración nueva. Si
  despliegas primero, el código nuevo consulta columnas que no existen.
- **No editar una migración ya aplicada.** Generar una nueva con
  `npm run db:generate`.
- Verificar antes y después con una consulta de solo lectura.

---

## 5. Verificación tras desplegar

```bash
# 1. La app responde y redirige
curl -sI https://inventario-equipos-app.vercel.app | Select-String -i "location|HTTP"

# 2. robots.txt con la URL de producción
curl -s https://inventario-equipos-app.vercel.app/robots.txt

# 3. sitemap.xml
curl -s https://inventario-equipos-app.vercel.app/sitemap.xml

# 4. La landing existe y es indexable
curl -s https://inventario-equipos-app.vercel.app/inicio | Select-String -i "canonical|og:title"

# 5. El panel NO se indexa
curl -sI https://inventario-equipos-app.vercel.app/dashboard

# 6. Una etiqueta inexistente da 404, no 500
curl -sI https://inventario-equipos-app.vercel.app/e/token-inexistente
```

Lo que debería pasar:

| Comprobación | Resultado esperado |
|---|---|
| `/` | Redirección a `/login` (o a `/dashboard` si hay sesión) |
| `/inicio` | 200, con canonical absoluto y etiquetas `og:` |
| `/robots.txt` | 200, con `Sitemap:` apuntando a producción |
| `/sitemap.xml` | 200, con una sola `<loc>` |
| `/dashboard` | Redirección a `/login` |
| `/e/<token-inexistente>` | 404 |
| `/manifest.webmanifest` | 200 |

---

## 6. Antes de exponerlo

- [ ] `BETTER_AUTH_SECRET` generado de verdad, no el de desarrollo.
- [ ] `BETTER_AUTH_URL` con el dominio real.
- [ ] `NEXT_PUBLIC_APP_URL` con el dominio real (**y re-desplegar**).
- [ ] `TURSO_AUTH_TOKEN` con los permisos mínimos de la base.
- [ ] Migraciones aplicadas.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` en verde.
- [ ] Hash de `lib/zpl/graphics.generated.ts` intacto.
- [ ] Un usuario `ADMIN` real y una contraseña de 8+ caracteres.
- [ ] `BETTER_AUTH_SECRET` y los tokens **no** están en el repositorio.
- [ ] Probado el login con los tres roles.
- [ ] Probada una impresión real en la Zebra ZD230.

---

## 7. Problemas frecuentes en producción

**La app no arranca y dice que falta `BETTER_AUTH_SECRET`**
La variable no está definida en ese entorno. Es intencionado: en producción no hay
secreto de desarrollo.

**El QR lleva `localhost`**
`NEXT_PUBLIC_APP_URL` no está definida, o el build se hizo sin esa variable. Hay
que definirla y **volver a desplegar** (las `NEXT_PUBLIC_*` se congelan en el
build).

**Better Auth rechaza el dominio**
`BETTER_AUTH_URL` no coincide con el dominio por el que se entra.

**Las migraciones no aparecen aplicadas**
`drizzle-kit migrate` no se ejecutó, o se ejecutó contra otra base de datos.

**La impresión no encuentra impresoras**
Zebra Browser Print no está instalado en ese equipo, o el navegador lo bloquea.
Recordar que es una instalación **por equipo**, no por despliegue.

**Un cambio en `NEXT_PUBLIC_*` no surte efecto**
Vercel no reinstala: hay que re-desplegar.

---

## 8. Copias de seguridad

La base está en Turso, que gestiona su propia retención y replicación. Lo que sí
depende de este repositorio es el **código** y las **migraciones**.

Recomendación: antes de una migración que cambie o elimine columnas, exportar el
contenido de las tablas afectadas. La política del proyecto es que las escrituras
sean mínimas y siempre a través de migraciones (`drizzle-kit generate` +
`migrate`), nunca `db:push` contra producción.
