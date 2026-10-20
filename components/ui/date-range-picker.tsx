"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatRangeLabel, type DateRange } from "@/lib/date-range";

/**
 * Selector de rango de fechas del filtro de solicitudes (issue #33).
 * Compone `Popover` + `Calendar` en modo `range`, siguiendo el Date Picker de
 * shadcn/ui. El botón imita a `Combobox`/`MultiSelect` para mantener la
 * coherencia visual y usa los tokens del tema (incluido el rojo de marca).
 *
 *  - La interacción siempre produce un rango completo: el primer clic fija un
 *    día entero y los siguientes ajustan el extremo inicial o el final, ya
 *    ordenados. No se generan rangos abiertos por un solo lado ni invertidos.
 *  - En móvil muestra un solo mes y en escritorio dos, para no salirse del
 *    viewport.
 *  - "Limpiar" vacía el rango y cierra el popover.
 */
export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

function useResponsiveMonths(): number {
  const [months, setMonths] = React.useState(1);

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const apply = () => setMonths(query.matches ? 2 : 1);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return months;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Rango de fechas",
  className,
  id,
  "aria-label": ariaLabel = "Filtrar por rango de fechas",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const months = useResponsiveMonths();
  const label = formatRangeLabel(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            className
          )}
        >
          <span
            className={cn(
              "line-clamp-1 text-left",
              !label && "text-muted-foreground"
            )}
          >
            {label ?? placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-auto max-w-[calc(100vw-1rem)] overflow-x-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={months}
          selected={value.from ? { from: value.from, to: value.to } : undefined}
          onSelect={(range) => onChange(range ?? {})}
          autoFocus
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-2">
          <span className="px-1 text-xs text-muted-foreground">
            Selecciona el día inicial y el final
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange({});
              setOpen(false);
            }}
            disabled={!value.from && !value.to}
          >
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
