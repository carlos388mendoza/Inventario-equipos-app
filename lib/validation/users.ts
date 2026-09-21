import { z } from "zod";
import { ALL_ROLES, type UserRole } from "@/lib/db/enums";

/**
 * Schemas Zod de gestión de usuarios (solo admin).
 * Los roles se derivan de `ALL_ROLES` para no duplicar la lista en dos sitios.
 */

export const createUserSchema = z.object({
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
    errorMap: () => ({ message: "Rol no válido" }),
  }),
  restaurantId: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().default(true),
});

export type CreateUser = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
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
    errorMap: () => ({ message: "Rol no válido" }),
  }),
  restaurantId: z.string().trim().min(1).nullable().optional(),
  active: z.boolean(),
});

export type UpdateUser = z.infer<typeof updateUserSchema>;

export const toggleUserActiveSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});
