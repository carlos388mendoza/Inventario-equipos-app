"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

export type SortValue = string | number | Date | null | undefined;

/**
 * Ordenamiento por columnas para las tablas del panel.
 *
 * Es estado local del componente: al recargar la página la tabla vuelve a su
 * orden original. Tercer clic vuelve al orden inicial (sin ordenar), y las
 * celdas vacías siempre van al final. Se reutiliza en las vistas de equipos,
 * movimientos, etiquetas, solicitudes, usuarios, restaurantes, tipos e
 * inventario.
 */
export function useTableSort() {
  const [sort, setSort] = React.useState<SortState | null>(null);

  const toggle = React.useCallback((key: string) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);

  const sortRows = React.useCallback(
    <T,>(rows: T[], valueOf: (row: T, key: string) => SortValue): T[] => {
      if (!sort) return rows;
      const dir = sort.direction === "asc" ? 1 : -1;
      return [...rows].sort((a, b) => {
        const va = valueOf(a, sort.key);
        const vb = valueOf(b, sort.key);
        const na = va === null || va === undefined || va === "";
        const nb = vb === null || vb === undefined || vb === "";
        if (na && nb) return 0;
        if (na) return 1;
        if (nb) return -1;
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * dir;
        }
        if (va instanceof Date && vb instanceof Date) {
          return (va.getTime() - vb.getTime()) * dir;
        }
        return (
          String(va).localeCompare(String(vb), "es", { numeric: true }) * dir
        );
      });
    },
    [sort]
  );

  return { sort, toggle, sortRows } as const;
}

/** Encabezado ordenable: clic alterna orden ascendente/descendente. */
export function SortableHeader({
  label,
  sortKey,
  sort,
  onToggle,
  align = "left",
  className,
}: {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onToggle: (key: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = active
    ? sort?.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;

  return (
    <th
      aria-sort={
        active
          ? sort?.direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={cn(
        "px-4 py-2 whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded font-medium transition-colors hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {label}
        <Icon
          className={cn(
            "h-3 w-3 shrink-0",
            active ? "text-foreground" : "text-muted-foreground/60"
          )}
        />
      </button>
    </th>
  );
}