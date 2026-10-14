"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { getNavItemsForRole } from "@/lib/ui/command-palette";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/ui/sidebar";
import { ROLE_LABELS, type UserRole } from "@/lib/db/enums";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BrandMark,
  SidebarNav,
  SignOutButton,
  UserSummary,
} from "@/components/dashboard/sidebar-parts";

/**
 * Sidebar de escritorio (a partir de `lg`).
 *
 * Se puede contraer a una versión estrecha que muestra solo los iconos, para
 * liberar espacio de trabajo (patrón tipo ChatGPT). El control para expandir y
 * contraer vive en la propia barra y siempre está visible. La preferencia se
 * recuerda en `localStorage`, siguiendo el mismo patrón que la densidad de
 * tablas de Ajustes: se lee tras montar para no romper la hidratación.
 *
 * El panel móvil (drawer) NO vive aquí: lo aporta `DashboardTopBar`, que es
 * donde está el botón de menú. Ambos comparten las piezas de `sidebar-parts` y
 * la MISMA lista filtrada por rol, así que no hay rutas ni permisos duplicados.
 */
export function DashboardSidebar({
  role,
  name,
  email,
}: {
  role: UserRole;
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const items = getNavItemsForRole(role);

  // Preferencia recordada. Se aplica tras montar (no durante el render) para
  // evitar diferencias de hidratación, igual que el tema en `ThemeToggle`.
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(true);
      }
    } catch {
      // localStorage puede no estar disponible (modo privado estricto).
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_STORAGE_KEY,
          String(next)
        );
      } catch {
        // Sin persistencia disponible: la preferencia solo dura la sesión.
      }
      return next;
    });
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden shrink-0 border-r bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:transition-[width] lg:duration-200",
        collapsed ? "lg:w-[4.75rem]" : "lg:w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center border-b px-2 py-3",
          collapsed ? "flex-col gap-2" : "justify-between gap-2"
        )}
      >
        <BrandMark collapsed={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
          aria-pressed={collapsed}
          className="shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      <SidebarNav items={items} pathname={pathname} collapsed={collapsed} />

      <div className="border-t p-2">
        <div className={cn(collapsed && "flex justify-center")}>
          <UserSummary
            name={name}
            email={email}
            roleLabel={ROLE_LABELS[role]}
            collapsed={collapsed}
          />
        </div>
        <div className={cn("mt-2", collapsed && "flex justify-center")}>
          <SignOutButton compact={collapsed} />
        </div>
      </div>
    </aside>
  );
}
