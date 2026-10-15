import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { ROLES, type UserRole } from "@/lib/db/enums";

/**
 * Selección de los tres destinos de la barra inferior (móvil/tablet).
 *
 * Es lógica pura para poder probarse en Node (el proyecto no usa jsdom) y para
 * tener una única fuente de verdad: la barra NO reescribe rutas ni permisos,
 * solo elige tres secciones de `NAV_ITEMS` y las cruza con el rol. Si por lo que
 * sea una sección no fuese visible para el rol, simplemente no aparece; nunca se
 * inventa un enlace que el rol no pueda abrir.
 *
 * Los tres destinos son los de uso más frecuente y disponibles para TODOS los
 * roles: Panel, Inventario y Solicitudes. Para el usuario de restaurante la
 * tercera es «Mis solicitudes», que es exactamente la bandeja de solicitudes que
 * el dashboard ya le enlaza.
 */
const PREFERRED_HREFS = ["/dashboard", "/equipment"] as const;

export function getBottomNavItems(role: UserRole): NavItem[] {
  const requestsHref =
    role === ROLES.RESTAURANT_USER ? "/my-requests" : "/requests";
  const preferred: string[] = [...PREFERRED_HREFS, requestsHref];

  const visible = NAV_ITEMS.filter((item) => item.roles.includes(role));
  return preferred
    .map((href) => visible.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}
