import { z } from "zod";

export const generateLabelSchema = z.object({
  equipmentId: z.string().min(1, "Selecciona el equipo."),
});

export type GenerateLabelInput = z.infer<typeof generateLabelSchema>;