# Inteligencia artificial

Documento para desarrollador. Explica las dos funciones de IA, cómo están
construidas y por qué son seguras.

---

## 1. Qué hay

Dos funciones, en `app/api/ai/`:

| Función | Ruta | Quién puede usarla | Qué hace |
|---|---|---|---|
| **Asistente de estadísticas** | `POST /api/ai/stats-agent` | ADMIN, IT_MANAGER | Responde preguntas sobre inventario y solicitudes con datos reales. |
| **Solicitud por voz** | `POST /api/ai/voice-request` | ADMIN, IT_MANAGER, RESTAURANT_USER | Convierte lo que dicta una persona en los campos de una solicitud. |

---

## 2. Proveedor

`lib/ai/openrouter.ts`:

```ts
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function getOpenRouterModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;              // ← la app sigue funcionando
  const provider = createOpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  return provider(process.env.AI_MODEL?.trim() || "openai/gpt-4o-mini");
}
```

El módulo tiene `import "server-only"`, así que la clave **nunca** llega al
navegador.

**Si falta `OPENROUTER_API_KEY`, la función devuelve `null` y la ruta responde
explicando que la IA está deshabilitada.** La aplicación no se rompe: el resto del
sistema funciona con normalidad. Esa es una decisión explícita, no un descuido.

---

## 3. El patrón de seguridad: tools, no SQL

Las dos funciones usan el mismo patrón, y es lo importante:

> **El modelo nunca escribe una consulta. Elige entre herramientas ya escritas.**

Las tools son funciones de Drizzle definidas en el propio archivo de la ruta, cada
una con su esquema Zod como parámetro (`zodSchema`). El modelo devuelve argumentos
que **pasan por Zod** antes de tocar la base.

```
Pregunta del usuario
        │
        ▼
   Modelo (elige tool + argumentos)
        │
        ▼
   Zod valida los argumentos
        │
        ▼
   Query Drizzle predefinida     ← el SQL ya estaba escrito
        │
        ▼
   ¿La respuesta cabe en el alcance del usuario? (resolveScope)
        │
        ▼
   Respuesta en markdown (Streamdown)
```

Añadir una tool nueva significa escribir una función Drizzle. **No existe ninguna
forma de que el modelo envíe SQL.**

---

## 4. Tools del asistente de estadísticas

Definidas con `lib/db/queries/stats.ts`:

| Tool | Qué responde |
|---|---|
| `totalRequests` | Cuántas solicitudes hay |
| `requestsByStatus` | Reparto por estado |
| `requestsByType` | Reparto por tipo de equipo |
| `requestsRankingByRestaurant` | Qué restaurantes más piden |
| `restaurantsByReplacementRequests` | Qué equipos más se reemplazan |
| `equipmentTypeLifespan` | Vida útil por tipo |
| `equipmentByType` | Reparto del inventario por tipo |

La ruta valida la pregunta con `statsAgentSchema` (1 a 1000 caracteres), exige
`requireRole(ADMIN, IT_MANAGER)` y resuelve el alcance antes de responder.

---

## 5. La solicitud por voz

`voiceRequestSchema`:

```ts
{
  text: string,           // 1..4000 caracteres
  restaurantId?: string,  // solo para roles globales
}
```

El modelo debe devolver exactamente este esquema:

```ts
{
  kind: "purchase" | "replacement",
  equipmentTypeName: string,
  currentEquipmentAssetCode: string | null,
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT",
  reason: string,          // 5..500
  description: string | null,
}
```

La función **no crea la solicitud**: normaliza el texto (minúsculas, sin acentos)
para comparar el tipo de equipo con el catálogo, y devuelve los campos ya
rellenados para que la persona los **revise y confirme** en el formulario. Crear la
solicitud sigue pasando por `createRequest()`, con su Zod, su alcance y su
transacción.

Si la persona ya está en un restaurante, el destino se fuerza a su
`restaurantId` y el que envía el formulario no puede cambiarlo.

---

## 6. Alcance

Ambas rutas hacen esto antes de tocar nada:

```ts
await requireRole(...);
const scope = await resolveScope();
```

- El asistente de estadísticas es solo para roles globales, así que `isGlobal` es
  `true` y responde sobre todos los restaurantes.
- La solicitud por voz respeta el alcance: un `RESTAURANT_USER` solo puede crear
  para su restaurante, y el `restaurantId` que envíe el cliente no lo cambia.

---

## 7. Renderizado de la respuesta

Las respuestas se renderizan con **Streamdown**, que muestra el markdown
(escribiendo progresivamente). El modelo devuelve texto con tablas y listas, y la
interfaz lo presenta sin `dangerouslySetInnerHTML`: no se inyecta HTML.

---

## 8. Verificación de la salida

Cada tool devuelve el resultado de una consulta, y la respuesta del modelo se
construye **sobre esos datos observados**. Si una tool falla, la ruta lo indica en
lugar de inventar una cifra.

---

## 9. Limitaciones conocidas

- **Depende de un servicio externo.** Sin red o sin cuota de OpenRouter, las
  funciones no responden.
- **La facturación va a OpenRouter.** `AI_MODEL` decide el modelo y, con él, el
  coste. El valor por defecto (`openai/gpt-4o-mini`) es el más barato de los
  habituales.
- **No hay memoria entre conversaciones.** Cada pregunta es independiente.
- **El asistente no escribe.** Puede informar; cambiar estados de solicitudes lo
  hace una persona, con su validación y su registro en el historial.
- **La voz es de transcripción, no de audio.** Recibe texto ya dictado por el
  navegador (`SpeechRecognition`); no procesa audio en el servidor.
- **Sin reintentos ni cola.** Si el proveedor falla, la persona ve el error y
  reintenta.
- **El texto del usuario viaja al proveedor externo.** Quien dicta una solicitud
  está enviando ese texto a OpenRouter. Conviene decirlo en la interfaz.
