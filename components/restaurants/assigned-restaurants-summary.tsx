"use client";

import { MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { summarizeAssignedRestaurants } from "@/lib/ui/assigned-restaurants";
import { cn } from "@/lib/utils";

/**
 * Resumen de restaurantes asignados (sección 7).
 *
 * En vez de volcar todos los nombres en una celda que crece sin control, muestra
 * hasta dos y resume el resto en un indicador `+N`. Al pulsarlo se abre un menú
 * accesible con la lista completa, de modo que la información nunca se oculta:
 * el contador sale del número real de restaurantes restantes y siempre se puede
 * consultar la lista entera.
 *
 * Es una sola implementación reutilizada por todos los sitios que resumen
 * asignaciones (ficha de técnicos y tabla de usuarios), para no duplicar el
 * criterio visual.
 */
export function AssignedRestaurantsSummary({
  names,
  className,
  emptyLabel = "Sin asignar",
}: {
  names: readonly string[];
  className?: string;
  emptyLabel?: string;
}) {
  const { visible, hiddenCount } = summarizeAssignedRestaurants(names);

  if (names.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="min-w-0 truncate">{visible.join(", ")}</span>
      {hiddenCount > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            aria-label={`Ver los ${names.length} restaurantes asignados`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MoreHorizontal className="h-3 w-3" aria-hidden="true" />
            <span className="tabular-nums">+{hiddenCount}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
            <DropdownMenuLabel>
              Restaurantes asignados ({names.length})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ul className="px-1 py-1">
              {names.map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  className="truncate rounded-sm px-2 py-1.5 text-sm"
                >
                  {name}
                </li>
              ))}
            </ul>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}
