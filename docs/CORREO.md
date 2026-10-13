# Correo y notificaciones

Documento para desarrollador. Explica cómo envía correo el sistema, por qué hay
un **modo de prueba** y cómo pasar a producción cuando el dominio esté
verificado. El código vive en `lib/email/send.ts`; el flujo de notificaciones,
en `lib/requests/notifications.ts`.

---

## 1. Cómo se envía

El envío está desacoplado del proveedor y usa **Resend por HTTP** (`fetch`), sin
añadir dependencias al `package.json`:

```
accion / cron  →  recordNotifications()  →  request_notifications (bandeja de salida)
                                              └─► sendEmail()  →  Resend
```

- Cada correo se **registra primero** en `request_notifications` con su estado.
- Sin `RESEND_API_KEY` la app **no falla**: los correos quedan en `SKIPPED`.
- `sendEmail()` devuelve uno de tres estados:

| Estado | Significado |
|---|---|
| `SENT` | El proveedor aceptó el mensaje (HTTP 2xx). Marca `sentAt`. |
| `SKIPPED` | NO se intentó: falta configuración o el destinatario no está autorizado. |
| `FAILED` | Se intentó y falló (HTTP no-2xx o error de red). Permite reintento. |

---

## 2. Modos: `MAIL_MODE`

Para que una **demostración** o un entorno de pruebas no envíe correos reales a
los empleados, el modo por defecto es `test`.

| `MAIL_MODE` | Remitente | Destinatarios |
|---|---|---|
| `production` | `MAIL_FROM` (dominio verificado) | cualquiera |
| cualquier otro valor **o ausente** | sandbox `onboarding@resend.dev` | **solo** `MAIL_TEST_RECIPIENTS` |

En modo `test`, cualquier destinatario fuera de la allowlist queda `SKIPPED`
**antes** de tocar la red: no hay forma de que un empleado reciba un correo por
accidente. El cron de seguimiento, al no quedar ningún correo en `SENT`, libera
su reclamación y reintenta más adelante: **no marca nada como enviado**.

> El sandbox de Resend (`onboarding@resend.dev`) solo puede entregar al correo
> **propietario de la cuenta**. En este proyecto el único destinatario de prueba
> válido es el de esa cuenta.

---

## 3. Variables de entorno

| Variable | Para qué | Si falta |
|---|---|---|
| `RESEND_API_KEY` | Habilita el envío. | Todo queda `SKIPPED`; la app sigue funcionando. |
| `MAIL_MODE` | `production` activa el envío real; si no, modo `test`. | Modo `test` (seguro). |
| `MAIL_TEST_RECIPIENTS` | Allowlist de correo en modo `test`, separados por comas. | Ningún destinatario autorizado; todo `SKIPPED`. |
| `MAIL_TEST_FROM` | Remitente del modo `test`. | `Inventario de Equipos <onboarding@resend.dev>`. |
| `MAIL_FROM` | Remitente verificado (solo `production`). | Respaldo `no-reply@inventario-equipos.local` (Resend lo rechazará). |
| `REQUEST_APPROVER_EMAILS` | Avisos de aprobación (Damaris). Si falta, se avisa a los ADMIN activos. | — |
| `CRON_SECRET` | Protege el cron y el endpoint de prueba. | Ambos responden `401`. |

Estos valores **nunca** se suben al repositorio (`.env*` está ignorado).

---

## 4. Probar el envío (demostración)

Endpoint seguro de prueba: envía un mensaje de ejemplo **solo** a la allowlist.
No toca la base de datos.

```
GET /api/email/test-send
Header: x-cron-secret: <CRON_SECRET>       (o Authorization: Bearer <CRON_SECRET>)
```

| Situación | Respuesta |
|---|---|
| Sin secreto o incorrecto | `401` |
| Modo `production` | `409` (deshabilitado) |
| Sin `RESEND_API_KEY` | `200 { skipped: true, reason: "email-not-configured" }` |
| Sin `MAIL_TEST_RECIPIENTS` | `400` |
| Correcto | `200 { mode: "test", results: [{ to, status, provider }] }` |

Ejemplo real (una vez desplegado, con el correo del propietario en la
allowlist):

```bash
curl -s https://inventario-equipos-app.vercel.app/api/email/test-send `
  -H "x-cron-secret: <CRON_SECRET>"
```

Se espera `status: "SENT"` para el destinatario autorizado.

---

## 5. Pasar a producción

Se hace cuando **Grupo Comidas** tenga el dominio verificado en Resend. Hasta
entonces, el modo `test` es el correcto.

1. Verificar el dominio en Resend (añadir los registros DNS que indique el panel:
   SPF, DKIM). Requiere acceso al DNS del dominio.
2. Crear el remitente verificado, p. ej. `no-reply@inventarioequipos.com`.
3. En Vercel (Production) definir:
   - `MAIL_FROM=Inventario de Equipos <no-reply@inventarioequipos.com>`
   - `MAIL_MODE=production`
   - `REQUEST_APPROVER_EMAILS=<correo real de aprobación>`
4. **Re-desplegar** (las variables se toman en el arranque del despliegue).
5. Quitar `MAIL_TEST_RECIPIENTS` (ya no se usa) o dejarlo: en `production` no
   limita nada.
6. Probar con un envío real a una dirección interna antes de anunciarlo.

En producción, `MAIL_MODE=production` **deshabilita** `/api/email/test-send`: los
envíos salen por los flujos reales (solicitud creada, aprobación, seguimiento).

---

## 6. Problemas frecuentes

**Los correos quedan en `SKIPPED` y no salen**
Falta `RESEND_API_KEY`, o el destinatario no está en `MAIL_TEST_RECIPIENTS` (modo
`test`). Es el comportamiento esperado fuera de producción.

**Resend responde 403/422 "domain not verified"**
`MAIL_FROM` apunta a un dominio sin verificar. En modo `test` no debería ocurrir
(el remitente es el sandbox); en `production`, verifica el dominio primero.

**El seguimiento del cron nunca queda enviado**
Normal en modo `test`: ningún destinatario autorizado recibe, así que la
reclamación se libera y se reintenta. Se resolverá al pasar a `production`.

**El endpoint de prueba responde 409**
Estás en `MAIL_MODE=production`. Es deliberado: en producción no hay atajo de
prueba.
