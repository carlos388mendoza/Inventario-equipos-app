"use client";

import * as React from "react";
import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EquipmentMovementActions } from "./equipment-movement-dialogs";
import type {
  MovableEquipmentOption,
  RestaurantOption,
} from "@/app/(dashboard)/movements/types";

/**
 * Acciones de una fila de equipo en la vista de Movimientos.
 *
 * Los movimientos van siempre visibles porque son la operación principal. Archivar
 * va en un menú aparte porque es lo que reemplaza a eliminar: un equipo nunca se
 * borra, se retira, y el motivo queda escrito en el historial.
 */
export function RowActions({
  equipment,
  restaurants,
  onArchive,
}: {
  equipment: MovableEquipmentOption;
  restaurants: RestaurantOption[];
  onArchive: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <EquipmentMovementActions equipment={equipment} restaurants={restaurants} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Más acciones">
            Más
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onArchive}>
            <Archive className="h-4 w-4" />
            Archivar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
