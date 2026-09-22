import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  QrCode,
  ReceiptText,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { ROLES, type UserRole } from "@/lib/db/enums";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles que pueden ver/entrar a la sección. */
  roles: UserRole[];
}

/**
 * Secciones del dashboard y roles autorizados.
 * La visibilidad aquí es solo de UX: la autorización real se hace en cada
 * página/acción con requireRole.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Panel",
    icon: LayoutDashboard,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER],
  },
  {
    href: "/equipment",
    label: "Inventario",
    icon: PackageSearch,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER],
  },
  {
    href: "/requests",
    label: "Solicitudes",
    icon: ClipboardList,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER],
  },
  {
    href: "/my-requests",
    label: "Mis solicitudes",
    icon: ReceiptText,
    roles: [ROLES.RESTAURANT_USER],
  },
  {
    href: "/statistics",
    label: "Estadísticas",
    icon: BarChart3,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER],
  },
  {
    href: "/labels",
    label: "Etiquetas / QR",
    icon: QrCode,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER],
  },
  {
    href: "/restaurants",
    label: "Restaurantes",
    icon: Store,
    roles: [ROLES.ADMIN],
  },
  {
    href: "/equipment-types",
    label: "Tipos de equipo",
    icon: Tags,
    roles: [ROLES.ADMIN],
  },
  {
    href: "/users",
    label: "Usuarios",
    icon: Users,
    roles: [ROLES.ADMIN],
  },
];