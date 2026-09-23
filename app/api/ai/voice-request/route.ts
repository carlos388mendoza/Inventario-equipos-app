import { z } from "zod";
import { generateText, tool, zodSchema } from "ai";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import {
  resolveScope,
  assertRestaurantAccess,
  type AccessScope,
} from "@/lib/equipment/scope";
import { db } from "@/lib/db";
import { equipment, equipmentTypes } from "@/lib/db/schema";
import { REQUEST_KINDS, requestInputSchema } from "@/lib/validation/requests";
import { ALL_REQUEST_PRIORITY } from "@/lib/db/enums";
import { ROLES } from "@/lib/db/enums";
import { getOpenRouterModel } from "@/lib/ai/openrouter";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";

const voiceRequestSchema = z.object({
  text: z.string().trim().min(1, "No hay texto que analizar.").max(4000),
  restaurantId: z.string().optional(),
});

/** Esquema de la extracción que el modelo DEBE devolver. */
const extractSchema = z.object({
  kind: z.enum(REQUEST_KINDS),
  equipmentTypeName: z.string().min(1),
  currentEquipmentAssetCode: z.string().nullable().optional(),
  priority: z.enum(ALL_REQUEST_PRIORITY),
  reason: z.string().min(5).max(500),
  description: z.string().max(2000).nullable().optional(),
});

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function POST(req: Request) {
  await requireRole(
    ROLES.ADMIN,
    ROLES.IT_MANAGER,
    ROLES.RESTAURANT_USER
  );
  const scope = await resolveScope();

  const parsed = voiceRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Envíe el texto dictado en el cuerpo de la petición." },
      { status: 400 }
    );
  }

  const text = parsed.data.text;

  let targetRestaurantId = scope.restaurantId;
  if (scope.isGlobal) {
    if (!parsed.data.restaurantId) {
      return NextResponse.json(
        { ok: false, error: "Selecciona el restaurante de la solicitud." },
        { status: 400 }
      );
    }
    requireRestaurantAccessFor(scope, parsed.data.restaurantId);
    targetRestaurantId = parsed.data.restaurantId;
  }
  if (!targetRestaurantId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tu usuario no está asociado a un restaurante.",
      },
      { status: 400 }
    );
  }

  const model = getOpenRouterModel();
  if (!model) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "La asistencia por voz no está disponible en este momento (falta la clave del proveedor de IA).",
      },
      { status: 503 }
    );
  }

  const [typeRows, equipmentRows] = await Promise.all([
    db
      .select({ id: equipmentTypes.id, name: equipmentTypes.name })
      .from(equipmentTypes)
      .where(eq(equipmentTypes.active, true))
      .orderBy(asc(equipmentTypes.name)),
    db
      .select({
        id: equipment.id,
        assetCode: equipment.assetCode,
        equipmentTypeId: equipment.equipmentTypeId,
      })
      .from(equipment)
      .where(eq(equipment.restaurantId, targetRestaurantId)),
  ]);

  const typesCatalog = typeRows.map((t) => t.name);
  const assetsCatalog = equipmentRows.map((e) => e.assetCode);

  try {
    const result = await generateText({
      model,
      system: [
        "Eres un asistente que convierte la petición hablada de un usuario de restaurante",
        "en los datos de una solicitud de equipo del sistema de inventario.",
        "Solo puedes usar el equipo/hardware que aparece en el catálogo proporcionado.",
        "",
        "Tipos de equipo disponibles (usa exactamente uno de estos nombres):",
        typesCatalog.length > 0 ? typesCatalog.join(", ") : "(sin tipos activos)",
        "",
        "Equipos actuales del restaurante (usa exactamente uno de estos códigos solo",
        "si la persona pide un REEMPLAZO de un equipo existente):",
        assetsCatalog.length > 0 ? assetsCatalog.join(", ") : "(sin equipos)",
      ].join("\n"),
      prompt:
        text +
        "\n\nDevuelve los datos de la solicitud. Si el usuario no menciona algo," +
        " usa valores razonables y describe en 'reason' y 'description' lo necesario.",
      toolChoice: { type: "tool", toolName: "extract_request_draft" },
      tools: {
        extract_request_draft: tool({
          description:
            "Extrae los datos estructurados de una solicitud de equipo a partir del dictado del usuario.",
          inputSchema: zodSchema(extractSchema),
        }),
      },
    });

    const call = result.toolCalls[0];
    if (!call) {
      return NextResponse.json(
        { ok: false, error: "No se pudo interpretar la solicitud." },
        { status: 422 }
      );
    }
    const extracted = extractSchema.parse(call.input);

    const typeMatch = typeRows.find(
      (t) => normalize(t.name) === normalize(extracted.equipmentTypeName)
    );
    if (!typeMatch) {
      return NextResponse.json(
        {
          ok: false,
          error: `No encontré el tipo de equipo "${extracted.equipmentTypeName}". Tipos disponibles: ${typesCatalog.join(", ")}.`,
        },
        { status: 422 }
      );
    }

    let currentEquipmentId: string | undefined;
    if (extracted.kind === "replacement") {
      const code = extracted.currentEquipmentAssetCode;
      if (!code) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Es un reemplazo pero no se identificó el equipo actual. Indica el código del equipo a reemplazar.",
          },
          { status: 422 }
        );
      }
      const assetMatch = equipmentRows.find(
        (e) => normalize(e.assetCode) === normalize(code)
      );
      if (!assetMatch) {
        return NextResponse.json(
          {
            ok: false,
            error: `No encontré el equipo "${code}" en este restaurante. Equipos: ${assetsCatalog.join(", ")}.`,
          },
          { status: 422 }
        );
      }
      currentEquipmentId = assetMatch.id;
    }

    const draft = {
      equipmentTypeId: typeMatch.id,
      kind: extracted.kind,
      currentEquipmentId: currentEquipmentId ?? "",
      priority: extracted.priority,
      reason: extracted.reason,
      description: extracted.description ?? "",
      restaurantId: targetRestaurantId ?? "",
    };

    const validated = requestInputSchema.safeParse(draft);
    if (!validated.success) {
      const first = validated.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: `La solicitud interpretada no es válida: ${first?.message ?? "revisa los datos."}`,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      draft: {
        equipmentTypeId: draft.equipmentTypeId,
        kind: draft.kind,
        currentEquipmentId: draft.currentEquipmentId,
        priority: draft.priority,
        reason: draft.reason,
        description: draft.description,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado al analizar la solicitud.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function requireRestaurantAccessFor(scope: AccessScope, restaurantId: string) {
  assertRestaurantAccess(scope, restaurantId);
}