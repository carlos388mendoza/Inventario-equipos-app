import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  PackageSearch,
  QrCode,
  ReceiptText,
  Settings,
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
    // Vista de los documentos de inventario de origen. Es aditiva: convive con
    // `/equipment` (equipos operativos) y no lo reemplaza.
    href: "/inventory",
    label: "Inventario por documento",
    icon: FileSpreadsheet,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER],
  },
  {
    // Traslado, copia, jalado, préstamo, devolución, sustitución y el libro de
    // todo eso. Solo para quien gestiona inventario: un usuario de restaurante
    // puede ver dónde está un equipo, pero no moverlo.
    href: "/movements",
    label: "Movimientos",
    icon: ArrowLeftRight,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER],
  },
  {
    href: "/requests",
    label: "Solicitudes",
    icon: ClipboardList,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER],
  },  {
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
  {
    href: "/settings",
    label: "Ajustes",
    icon: Settings,
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER],
  },
];