import { NAV_GROUPS, type NavGroupId, type NavItem } from "@/lib/navigation";

/**
 * Lógica pura del sidebar (navegación lateral).
 *
 * Centraliza la única regla que necesita prueba sin DOM: cómo se reparten las
 * secciones visibles en bloques. Vive fuera del componente para poder probarse
 * en Node (el proyecto no tiene jsdom) y para que el sidebar de escritorio y el
 * panel móvil compartan exactamente la misma agrupación.
 */

/** Clave de localStorage donde se recuerda si el sidebar está contraído. */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

export interface NavGroup {
  id: NavGroupId;
  label: string;
  items: NavItem[];
}

/**
 * Reparte las secciones en sus bloques, en el orden declarado en `NAV_GROUPS`.
 *
 * Nunca descarta ni duplica secciones: cada `item` cae en el grupo que declara
 * su campo `group`. Los grupos que quedan vacíos para el rol actual no se
 * devuelven, así que el sidebar no muestra encabezados sin contenido. El orden
 * interno de cada bloque es el de la lista recibida (el de `NAV_ITEMS`).
 */
export function groupNavItems(items: readonly NavItem[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}
