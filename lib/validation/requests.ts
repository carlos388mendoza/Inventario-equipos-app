import { z } from "zod";
import {
  ALL_REQUEST_PRIORITY,
  ALL_REQUEST_STATUS,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/db/enums";

export const REQUEST_KINDS = ["purchase", "replacement"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  purchase: "Compra (equipo nuevo)",
  replacement: "Reemplazo de equipo actual",
};

/**
 * Datos de una nueva solicitud.
 * - `kind = "replacement"` exige `currentEquipmentId` (equipo a reemplazar).
 * - `kind = "purchase"` NO lleva equipo actual (equipo nuevo).
 * - `restaurantId` solo aplica para roles globales; el usuario de restaurante
 *   queda fijado a su restaurante en el servidor.
 */
export const requestInputSchema = z
  .object({
    equipmentTypeId: z.string().min(1, "Selecciona un tipo de equipo."),
    priority: z.enum(
      ALL_REQUEST_PRIORITY as [RequestPriority, ...RequestPriority[]],
      { message: "Prioridad no válida." }
    ),
    kind: z.enum(REQUEST_KINDS, { message: "Tipo de solicitud no válido." }),
    currentEquipmentId: z.string().optional().or(z.literal("")),
    reason: z
      .string()
      .trim()
      .min(5, "El motivo debe tener al menos 5 caracteres.")
      .max(500, "El motivo no puede superar 500 caracteres."),
    description: z
      .string()
      .trim()
      .max(2000, "La descripción no puede superar 2000 caracteres.")
      .optional()
      .or(z.literal("")),
    restaurantId: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "replacement" && !data.currentEquipmentId) {
      ctx.addIssue({
        code: "custom",
        path: ["currentEquipmentId"],
        message: "Selecciona el equipo que se reemplaza.",
      });
    }
  });

export type RequestInput = z.infer<typeof requestInputSchema>;

export const requestStatusChangeSchema = z.object({
  id: z.string().min(1),
  newStatus: z.enum(
    ALL_REQUEST_STATUS as [RequestStatus, ...RequestStatus[]],
    { message: "Estado no válido." }
  ),
  comment: z
    .string()
    .trim()
    .max(1000, "El comentario no puede superar 1000 caracteres.")
    .optional()
    .or(z.literal("")),
});

export type RequestStatusChange = z.infer<typeof requestStatusChangeSchema>;