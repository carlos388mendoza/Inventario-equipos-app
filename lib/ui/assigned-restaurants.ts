/**
 * Resumen de restaurantes asignados (issue de navegación, sección 7).
 *
 * Donde hoy se listan TODOS los restaurantes de un técnico (una lista que crece
 * sin control y ensancha la celda), se muestran un máximo de dos y el resto
 * queda detrás de un discreto botón de tres puntos. El usuario siempre puede ver
 * la lista completa, así que el resumen nunca oculta información de forma
 * engañosa: el botón solo aparece cuando de verdad hay restaurantes de más.
 *
 * Es lógica pura, sin DOM, para poder probarse en Node.
 */

/** Cuántos nombres se muestran antes de resumir el resto. */
export const ASSIGNED_RESTAURANTS_VISIBLE = 2;

export interface AssignedRestaurantsSummary {
  /** Nombres que se muestran siempre. */
  visible: string[];
  /** Nombres que quedan detrás del botón de tres puntos. */
  hidden: string[];
  /** Número real de nombres restantes (longitud de `hidden`). */
  hiddenCount: number;
  /** Si hay algo que resumir (`hiddenCount > 0`). */
  hasOverflow: boolean;
}

/**
 * Reparte una lista de nombres en la parte visible y la resumida.
 *
 * - 0 nombres → nada visible, sin botón.
 * - 1 o 2 nombres → se muestran tal cual, sin botón.
 * - 3 o más → los dos primeros visibles y `hiddenCount` = el resto.
 *
 * No filtra ni deduplica: respeta exactamente lo recibido para no cambiar lo que
 * el usuario cree que tiene asignado.
 */
export function summarizeAssignedRestaurants(
  names: readonly string[],
  maxVisible: number = ASSIGNED_RESTAURANTS_VISIBLE
): AssignedRestaurantsSummary {
  const limit = Math.max(0, Math.trunc(maxVisible));
  const visible = names.slice(0, limit);
  const hidden = names.slice(limit);
  return {
    visible,
    hidden,
    hiddenCount: hidden.length,
    hasOverflow: hidden.length > 0,
  };
}
