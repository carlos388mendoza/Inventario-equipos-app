"use client";

import { EquipmentMovementActions } from "./equipment-movement-dialogs";
import type {
  MovableEquipmentOption,
  RestaurantOption,
} from "@/app/(dashboard)/movements/types";

/**
 * Puente entre la ficha del equipo (Server Component) y los diálogos de
 * movimiento (Client Component).
 *
 * Existe para que `app/(dashboard)/equipment/[id]/page.tsx` no tenga que importar
 * un client component con dependencias de Radix: aquí se traduce el DTO del
 * servidor al tipo que espera `EquipmentMovementActions`.
 */
export function DetailMovementActions({
  equipment,
  restaurants,
}: {
  equipment: MovableEquipmentOption;
  restaurants: RestaurantOption[];
}) {
  return <EquipmentMovementActions equipment={equipment} restaurants={restaurants} />;
}
