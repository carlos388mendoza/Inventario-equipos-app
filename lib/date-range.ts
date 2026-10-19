import { endOfDay, startOfDay } from "date-fns";

import { formatDate } from "@/lib/utils";

/**
 * Rango de fechas del filtro de solicitudes (issue #33).
 *
 * DayPicker trabaja con `{ from?, to? }` y admite un rango abierto por
 * cualquiera de los dos lados. Estas funciones concentran la lógica pura
 * (normalizado, límites del día y formato del botón) para poder probarla sin DOM
 * y para que el componente no repita cuentas de fechas ni zonas horarias.
 *
 * Los límites se calculan sobre la fecha LOCAL con `startOfDay`/`endOfDay`
 * (00:00:00.000 a 23:59:59.999), igual que la semántica anterior de los dos
 * campos nativos.
 */
export interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Corrige un rango invertido (`from > to`) intercambiando los extremos. Un rango
 * con un solo extremo se devuelve tal cual. Evita resultados silenciosamente
 * vacíos cuando el usuario termina de elegir al revés.
 */
export function normalizeRange(range: DateRange): DateRange {
  const { from, to } = range;
  if (from && to && from.getTime() > to.getTime()) {
    return { from: to, to: from };
  }
  return range;
}

/**
 * Límites inclusivos del rango en milisegundos, o `null` si ese extremo está
 * libre. El extremo inicial cae al inicio del día y el final al fin del día.
 */
export function rangeBounds(range: DateRange): {
  from: number | null;
  to: number | null;
} {
  const normalized = normalizeRange(range);
  return {
    from: normalized.from ? startOfDay(normalized.from).getTime() : null,
    to: normalized.to ? endOfDay(normalized.to).getTime() : null,
  };
}

export function isRangeEmpty(range: DateRange): boolean {
  return !range.from && !range.to;
}

/**
 * `true` si el instante cae dentro del rango, incluidos el día inicial y el
 * final completos. Un rango vacío no filtra nada.
 */
export function isWithinRange(time: number, range: DateRange): boolean {
  const { from, to } = rangeBounds(range);
  if (from !== null && time < from) return false;
  if (to !== null && time > to) return false;
  return true;
}

/**
 * Texto legible del rango para el botón, o `null` si no hay fechas (para usar el
 * placeholder). Reutiliza `formatDate` del proyecto para mantener el formato.
 */
export function formatRangeLabel(range: DateRange): string | null {
  const { from, to } = normalizeRange(range);
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `Desde ${formatDate(from)}`;
  if (to) return `Hasta ${formatDate(to)}`;
  return null;
}
