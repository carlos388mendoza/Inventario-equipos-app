import { z } from "zod";

export const equipmentTypeInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede superar 100 caracteres"),
  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede superar 500 caracteres")
    .optional()
    .or(z.literal("")),
  usefulLifeMonths: z
    .number()
    .int("Debe ser un número entero")
    .min(1, "La vida útil debe ser de al menos 1 mes")
    .max(600, "La vida útil no puede superar 600 meses"),
});

export type EquipmentTypeInput = z.infer<typeof equipmentTypeInputSchema>;

export const equipmentTypeUpdateSchema = equipmentTypeInputSchema.extend({
  id: z.string().min(1),
});

export type EquipmentTypeUpdateInput = z.infer<typeof equipmentTypeUpdateSchema>;

export const equipmentTypeToggleSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});