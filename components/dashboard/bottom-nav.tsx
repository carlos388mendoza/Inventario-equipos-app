"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type UserRole } from "@/lib/db/enums";
import { cn } from "@/lib/utils";
import { getBottomNavItems } from "@/lib/ui/bottom-nav";
import { isActiveRoute } from "@/components/dashboard/sidebar-parts";

/**
 * Barra de navegación inferior para móvil y tablet (por debajo de `lg`).
 *
 * Ofrece los tres destinos de uso más frecuente (Panel, Inventario y
 * Solicitudes), elegidos en `lib/ui/bottom-nav.ts`. Los destinos son los mismos
 * enlaces del sidebar y respetan el mismo filtro por rol, así que no duplica
 * rutas ni permisos. El resto de secciones sigue accesible desde el menú
 * lateral (hamburguesa).
 *
 * Se oculta en escritorio (`lg:hidden`) para no mostrar dos barras: en `lg` la
 * navegación es el sidebar. Es `fixed` con relleno de área segura para no tapar
 * la barra de gestos del dispositivo; el layout reserva espacio inferior para
 * que no cubra contenido.
 */
export function DashboardBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = getBottomNavItems(role);
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex w-full max-w-7xl items-stretch">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("h-5 w-5", active && "text-gold")}
                  aria-hidden="true"
                />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
