import { z } from "zod";

import {
  ALL_EQUIPMENT_MOVEMENT_TYPES,
  type EquipmentMovementType,
} from "@/lib/db/enums";

/**
 * Validación de entrada de los movimientos de inventario.
 *
 * Solo se valida la FORMA y el RANGO de los valores. Las reglas que dependen del
 * estado real de un equipo (¿está prestado?, ¿está en la unidad destino?, ¿el
 * código está libre?) no se pueden expresar aquí porque requieren leer la base
 * de datos: viven en `lib/equipment/movements.ts` y se aplican dentro de la
 * transacción, contra los datos recién leídos y no contra lo que envió el
 * cliente.
 *
 * Igual que en el resto del módulo, los identificadores de restaurante y de
 * equipo NUNCA se aceptan como autoridad: se usan para leer, y la
 * autorización se comprueba en el servidor con `assertRestaurantAccess`.
 */

const movementTypeSchema = z.enum(
  ALL_EQUIPMENT_MOVEMENT_TYPES as [EquipmentMovementType, ...EquipmentMovementType[]]
);

const assetCodeSchema = z
  .string()
  .trim()
  .min(2, "El código de activo debe tener al menos 2 caracteres")
  .max(40, "El código de activo no puede superar 40 caracteres")
  .toUpperCase()
  .regex(/^[A-Z0-9.-]+$/, "Código de activo inválido");

const serialNumberSchema = z
  .string()
  .trim()
  .max(60, "El número de serie no puede superar 60 caracteres")
  .optional()
  .or(z.literal(""));

const reasonSchema = z
  .string()
  .trim()
  .max(200, "El motivo no puede superar 200 caracteres")
  .optional()
  .or(z.literal(""));

const notesSchema = z
  .string()
  .trim()
  .max(1000, "Las notas no pueden superar 1000 caracteres")
  .optional()
  .or(z.literal(""));

/** Traslado, jalado, devolución o préstamo de UN equipo. */
export const moveEquipmentSchema = z.object({
  equipmentId: z.string().min(1, "Selecciona un equipo"),
  /** Destino. En una devolución el servidor lo fuerza al propietario. */
  toRestaurantId: z.string().min(1, "Selecciona la unidad destino"),
  type: movementTypeSchema,
  reason: reasonSchema,
  notes: notesSchema,
});

export type MoveEquipmentInput = z.infer<typeof moveEquipmentSchema>;

/** Movimiento de varios equipos a la vez, con un único `batchId`. */
export const bulkMoveEquipmentSchema = z.object({
  equipmentIds: z
    .array(z.string().min(1))
    .min(1, "Selecciona al menos un equipo")
    .max(200, "No se pueden mover más de 200 equipos en una sola operación"),
  toRestaurantId: z.string().min(1, "Selecciona la unidad destino"),
  type: movementTypeSchema,
  reason: reasonSchema,
  notes: notesSchema,
});

export type BulkMoveEquipmentInput = z.infer<typeof bulkMoveEquipmentSchema>;

/** Copia: crea un equipo nuevo a partir de otro. */
export const copyEquipmentSchema = z.object({
  equipmentId: z.string().min(1, "Selecciona el equipo a copiar"),
  /** Unidad donde vivirá la copia. El original no se mueve. */
  toRestaurantId: z.string().min(1, "Selecciona la unidad destino"),
  /** Código de activo OBLIGATORIO de la copia: nunca se reutiliza el original. */
  assetCode: assetCodeSchema,
  /**
   * Serie del equipo NUEVO. Vacía significa "todavía no se conoce", que es lo
   * correcto por defecto: la serie pertenece al objeto físico.
   */
  serialNumber: serialNumberSchema,
  reason: reasonSchema,
  notes: notesSchema,
});

export type CopyEquipmentInput = z.infer<typeof copyEquipmentSchema>;

/** Sustitución: un equipo entra a sustituir a otro. */
export const replaceEquipmentSchema = z.object({
  /** Equipo que sale del servicio. */
  equipmentId: z.string().min(1, "Selecciona el equipo a sustituir"),
  /** Unidad donde queda el sustituto. */
  toRestaurantId: z.string().min(1, "Selecciona la unidad destino"),
  /** Código de activo del equipo NUEVO. */
  assetCode: assetCodeSchema,
  serialNumber: serialNumberSchema,
  reason: reasonSchema,
  notes: notesSchema,
});

export type ReplaceEquipmentInput = z.infer<typeof replaceEquipmentSchema>;

/** Archivado: retira el equipo del servicio sin borrar su historia. */
export const archiveEquipmentSchema = z.object({
  equipmentId: z.string().min(1, "Selecciona un equipo"),
  reason: z.string().trim().min(1, "Indica el motivo").max(1000),
});

export type ArchiveEquipmentInput = z.infer<typeof archiveEquipmentSchema>;
