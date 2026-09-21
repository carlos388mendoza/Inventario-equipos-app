import { z } from "zod";
import { ALL_EQUIPMENT_STATUS, type EquipmentStatus } from "@/lib/db/enums";

export const equipmentInputSchema = z.object({
  assetCode: z
    .string()
    .trim()
    .min(2, "El código de activo debe tener al menos 2 caracteres")
    .max(40, "El código de activo no puede superar 40 caracteres")
    .toUpperCase()
    .regex(/^[A-Z0-9.-]+$/, "Código de activo inválido"),
  serialNumber: z
    .string()
    .trim()
    .max(60, "El número de serie no puede superar 60 caracteres")
    .optional()
    .or(z.literal("")),
  equipmentTypeId: z.string().min(1, "Selecciona un tipo de equipo"),
  restaurantId: z.string().min(1, "Selecciona un restaurante"),
  brand: z
    .string()
    .trim()
    .max(60, "La marca no puede superar 60 caracteres")
    .optional()
    .or(z.literal("")),
  model: z
    .string()
    .trim()
    .max(80, "El modelo no puede superar 80 caracteres")
    .optional()
    .or(z.literal("")),
  /** Fecha en formato YYYY-MM-DD o vacío. */
  purchaseDate: z.string().optional().or(z.literal("")),
  installationDate: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(1000, "Las notas no pueden superar 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type EquipmentInput = z.infer<typeof equipmentInputSchema>;

export const equipmentUpdateSchema = equipmentInputSchema.extend({
  id: z.string().min(1),
});

export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;

export const equipmentStatusChangeSchema = z.object({
  id: z.string().min(1),
  newStatus: z.enum(ALL_EQUIPMENT_STATUS as [EquipmentStatus, ...EquipmentStatus[]]),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type EquipmentStatusChangeInput = z.infer<typeof equipmentStatusChangeSchema>;

export const equipmentNoteSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().min(1, "La nota no puede estar vacía").max(1000),
});

export type EquipmentNoteInput = z.infer<typeof equipmentNoteSchema>;

/** Convierte una fecha 'YYYY-MM-DD' (o '') en Date | null. */
export function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}