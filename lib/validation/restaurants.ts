import { z } from "zod";

/** Datos de restaurante tal y como se envían desde los formularios. */
export const restaurantInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede superar 100 caracteres"),
  code: z
    .string()
    .trim()
    .min(2, "El código debe tener al menos 2 caracteres")
    .max(20, "El código no puede superar 20 caracteres")
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, "El código solo puede contener letras, números, guiones y guiones bajos"),
  address: z
    .string()
    .trim()
    .max(250, "La dirección no puede superar 250 caracteres")
    .optional()
    .or(z.literal("")),
});

export type RestaurantInput = z.infer<typeof restaurantInputSchema>;

export const restaurantUpdateSchema = restaurantInputSchema.extend({
  id: z.string().min(1),
});

export type RestaurantUpdateInput = z.infer<typeof restaurantUpdateSchema>;

export const restaurantToggleSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});