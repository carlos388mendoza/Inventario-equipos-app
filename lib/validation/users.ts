import { z } from "zod";
import { ALL_ROLES, ROLES, type UserRole } from "@/lib/db/enums";

/**
 * Schemas Zod de gestión de usuarios (solo admin).
 * Los roles se derivan de `ALL_ROLES` para no duplicar la lista en dos sitios.
 */

/**
 * Un usuario de rol restaurante queda atado a `user.restaurantId`: no puede
 * crear solicitudes sin restaurante. Es regla de dominio, así que se exige a
 * nivel de schema, igual que el resto de restricciones que el servidor hace
 * cumplir (la UI solo la refleja).
 */
function doesRequireRestaurant(
  data: { role: string; restaurantId?: string | null }
): boolean {
  return (
    data.role === ROLES.RESTAURANT_USER &&
    (data.restaurantId === null ||
      data.restaurantId === undefined ||
      data.restaurantId.trim() === "")
  );
}

function addRestaurantRequiredIssue(ctx: z.RefinementCtx) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["restaurantId"],
    message: "El rol de restaurante requiere un restaurante asignado.",
  });
}

export const createUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre no puede superar 100 caracteres"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El email no es válido")
      .max(254, "El email no puede superar 254 caracteres"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(100, "La contraseña no puede superar 100 caracteres"),
    role: z.enum(ALL_ROLES as [UserRole, ...UserRole[]], {
      message: "Rol no válido",
    }),
    restaurantId: z.string().trim().min(1).nullable().optional(),
    active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (doesRequireRestaurant(data)) addRestaurantRequiredIssue(ctx);
  });

export type CreateUser = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    id: z.string().min(1),
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre no puede superar 100 caracteres"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El email no es válido")
      .max(254, "El email no puede superar 254 caracteres"),
    role: z.enum(ALL_ROLES as [UserRole, ...UserRole[]], {
      message: "Rol no válido",
    }),
    restaurantId: z.string().trim().min(1).nullable().optional(),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (doesRequireRestaurant(data)) addRestaurantRequiredIssue(ctx);
  });

export type UpdateUser = z.infer<typeof updateUserSchema>;

export const toggleUserActiveSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});
