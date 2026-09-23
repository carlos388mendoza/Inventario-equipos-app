import { z } from "zod";
import { generateText, tool, zodSchema, isStepCount } from "ai";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { resolveScope } from "@/lib/equipment/scope";
import { db } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { ROLES } from "@/lib/db/enums";
import { getOpenRouterModel } from "@/lib/ai/openrouter";
import {
  requestsByType,
  requestsRankingByRestaurant,
  restaurantsByReplacementRequests,
  equipmentTypeLifespan,
  equipmentByType,
  requestsByStatus,
  totalRequests,
} from "@/lib/db/queries/stats";

export const runtime = "nodejs";

const statsAgentSchema = z.object({
  question: z.string().trim().min(1, "Escribe una pregunta.").max(1000),
});

/**
 * Convierte una consulta de estadísticas en la respuesta del agente.
 * Las tools ejecutan consultas predefinidas (Drizzle) contra la base real;
 * el modelo NO genera SQL y solo responde con datos observados.
 */
export async function POST(req: Request) {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);
  const scope = await resolveScope();

  const parsed = statsAgentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Escribe una pregunta válida." },
      { status: 400 }
    );
  }

  const model = getOpenRouterModel();
  if (!model) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "El asistente de estadísticas no está disponible en este momento (falta la clave del proveedor de IA).",
      },
      { status: 503 }
    );
  }

  // El alcance de este endpoint es global (ADMIN/IT_MANAGER), pero aplicamos
  // resolveScope igual que el resto del sistema como defensa en profundidad:
  // si un rol de restaurante llegara a usarlo, solo vería su restaurante.
  const restaurantId = scope.isGlobal ? undefined : (scope.restaurantId ?? undefined);

  try {
    const result = await generateText({
      model,
      system: [
        "Eres el asistente de estadísticas de Grupo Comidas (inventario de equipos).",
        "Respondes preguntas en español con datos REALES obtenidos SOLO mediante las tools provistas.",
        "No inventes cifras: si una tool devuelve cero filas, dilo.",
        "Si te piden un rango de fechas que no está, usa los últimos 12 meses.",
        "Responde de forma breve, clara y con palabras en español.",
      ].join("\n"),
      prompt: parsed.data.question,
      stopWhen: isStepCount(5),
      tools: {
        total_requests: tool({
          description:
            "Cuenta el total de solicitudes de equipo registradas en el sistema. Opcionalmente se puede filtrar por restaurante.",
          inputSchema: zodSchema(
            z.object({
              restaurantCode: z
                .string()
                .optional()
                .describe("Código del restaurante (ej. PZ01). Si no se sabe, omitir."),
            })
          ),
          async execute({ restaurantCode }) {
            const rows = restaurantCode
              ? await dbRequestsRankingFiltered(restaurantCode)
              : undefined;
            const total = await totalRequests(rows?.restaurantId ?? undefined);
            return { total, restaurantCode: restaurantCode ?? null };
          },
        }),
        requests_by_type_in_range: tool({
          description:
            "Escribe el número de solicitudes por tipo de equipo dentro de un rango de fechas [desde, hasta).",
          inputSchema: zodSchema(
            z.object({
              from: z.string().describe("Fecha inicial ISO 8601 (YYYY-MM-DD)."),
              to: z.string().describe("Fecha final ISO 8601 (YYYY-MM-DD, exclusiva)."),
            })
          ),
          async execute({ from, to }) {
            const rows = await requestsByType({
              from: new Date(from),
              to: new Date(to),
              restaurantId,
            });
            return rows.map((r) => ({
              typeName: r.typeName,
              totalRequests: r.totalRequests,
            }));
          },
        }),
        requests_ranking: tool({
          description:
            "Ranking de restaurantes por número total de solicitudes de equipo registradas.",
          inputSchema: zodSchema(z.object({})),
          async execute() {
            const rows = await requestsRankingByRestaurant();
            const codes = await getRestaurantCodes();
            return rows.map((r) => ({
              restaurantName: r.restaurantName,
              restaurantCode: codes.get(r.restaurantId) ?? r.restaurantId,
              totalRequests: r.totalRequests,
            }));
          },
        }),
        requests_by_status: tool({
          description:
            "Solicitudes agrupadas por estado actual (PENDING, IN_REVIEW, APPROVED, REJECTED, COMPLETED, CANCELLED).",
          inputSchema: zodSchema(z.object({})),
          async execute() {
            const rows = await requestsByStatus(restaurantId);
            return rows.map((r) => ({
              status: r.status,
              totalRequests: r.totalRequests,
            }));
          },
        }),
        equipment_by_type: tool({
          description:
            "Equipos del inventario agrupados por tipo, con cantidad y vida útil de catálogo en meses.",
          inputSchema: zodSchema(z.object({})),
          async execute() {
            const rows = await equipmentByType(restaurantId);
            return rows.map((r) => ({
              typeName: r.typeName,
              equipmentCount: r.equipmentCount,
              usefulLifeMonths: r.usefulLifeMonths,
            }));
          },
        }),
        equipment_lifespan: tool({
          description:
            "Tipos de equipo ordenados por menor vida útil de catálogo, con cantidad de equipos registrados.",
          inputSchema: zodSchema(z.object({})),
          async execute() {
            const rows = await equipmentTypeLifespan();
            return rows.map((r) => ({
              typeName: r.typeName,
              usefulLifeMonths: r.usefulLifeMonths,
              equipmentCount: r.equipmentCount,
            }));
          },
        }),
        replacement_requests: tool({
          description:
            "Restaurantes con más solicitudes de reemplazo de equipos actuales (las que indican currentEquipmentId).",
          inputSchema: zodSchema(z.object({})),
          async execute() {
            const rows = await restaurantsByReplacementRequests(10);
            return rows.map((r) => ({
              restaurantName: r.restaurantName,
              totalRequests: r.totalRequests,
            }));
          },
        }),
      },
    });

    return NextResponse.json({ ok: true, answer: result.text.trim() });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error inesperado al consultar las estadísticas.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function getRestaurantCodes() {
  const rows = await db
    .select({ id: restaurants.id, code: restaurants.code })
    .from(restaurants);
  return new Map(rows.map((r) => [r.id, r.code]));
}

async function dbRequestsRankingFiltered(code: string) {
  const [restaurantRow] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.code, code))
    .limit(1);
  if (restaurantRow) return { restaurantId: restaurantRow.id };

  const rows = await requestsRankingByRestaurant();
  const norm = code.trim().toLowerCase();
  const found = rows.find(
    (r) =>
      r.restaurantId.toLowerCase() === norm ||
      r.restaurantName.toLowerCase().includes(norm)
  );
  return found ? { restaurantId: found.restaurantId } : undefined;
}