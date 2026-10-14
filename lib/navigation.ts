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

/**
 * Agrupación visual de las secciones del panel.
 *
 * Es solo presentación: no cambia rutas, permisos ni orden de negocio. Sirve
 * para que el sidebar expandido del administrador (que tiene muchas secciones)
 * se lea por bloques en vez de como una lista plana y saturada. Un grupo que no
 * tenga secciones visibles para el rol actual no se dibuja.
 */
export type NavGroupId = "general" | "inventory" | "requests" | "administration";

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "inventory", label: "Inventario" },
  { id: "requests", label: "Solicitudes" },
  { id: "administration", label: "Administración" },
];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles que pueden ver/entrar a la sección. */
  roles: UserRole[];
  /** Bloque visual al que pertenece la sección dentro del sidebar. */
  group: NavGroupId;
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
    group: "general",
    roles: [
      ROLES.ADMIN,
      ROLES.IT_MANAGER,
      ROLES.RESTAURANT_USER,
      ROLES.TECHNICIAN,
      ROLES.HEAD_TECHNICIAN,
    ],
  },
  {
    href: "/equipment",
    label: "Inventario",
    icon: PackageSearch,
    group: "inventory",
    roles: [
      ROLES.ADMIN,
      ROLES.IT_MANAGER,
      ROLES.RESTAURANT_USER,
      ROLES.TECHNICIAN,
      ROLES.HEAD_TECHNICIAN,
    ],
  },
  {
    // Vista de los documentos de inventario de origen. Es aditiva: convive con
    // `/equipment` (equipos operativos) y no lo reemplaza.
    href: "/inventory",
    label: "Inventario por documento",
    icon: FileSpreadsheet,
    group: "inventory",
    roles: [
      ROLES.ADMIN,
      ROLES.IT_MANAGER,
      ROLES.RESTAURANT_USER,
      ROLES.TECHNICIAN,
      ROLES.HEAD_TECHNICIAN,
    ],
  },
  {
    // Traslado, copia, jalado, préstamo, devolución, sustitución y el libro de
    // todo eso. Solo para quien gestiona inventario: un usuario de restaurante
    // puede ver dónde está un equipo, pero no moverlo.
    href: "/movements",
    label: "Movimientos",
    icon: ArrowLeftRight,
    group: "inventory",
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER],
  },
  {
    href: "/requests",
    label: "Solicitudes",
    icon: ClipboardList,
    group: "requests",
    roles: [
      ROLES.ADMIN,
      ROLES.IT_MANAGER,
      ROLES.RESTAURANT_USER,
      ROLES.TECHNICIAN,
      ROLES.HEAD_TECHNICIAN,
    ],
  },
  {
    href: "/my-requests",
    label: "Mis solicitudes",
    icon: ReceiptText,
    group: "requests",
    roles: [ROLES.RESTAURANT_USER],
  },
  {
    href: "/technicians",
    label: "Técnicos",
    icon: Users,
    group: "administration",
    roles: [ROLES.ADMIN, ROLES.HEAD_TECHNICIAN],
  },
  {
    href: "/statistics",
    label: "Estadísticas",
    icon: BarChart3,
    group: "administration",
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER],
  },
  {
    href: "/labels",
    label: "Etiquetas / QR",
    icon: QrCode,
    group: "inventory",
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER],
  },
  {
    href: "/restaurants",
    label: "Restaurantes",
    icon: Store,
    group: "administration",
    roles: [ROLES.ADMIN],
  },
  {
    href: "/equipment-types",
    label: "Tipos de equipo",
    icon: Tags,
    group: "administration",
    roles: [ROLES.ADMIN],
  },
  {
    href: "/users",
    label: "Usuarios",
    icon: Users,
    group: "administration",
    roles: [ROLES.ADMIN],
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: Settings,
    group: "general",
    roles: [ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER],
  },
];