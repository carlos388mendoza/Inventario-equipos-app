"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { getNavItemsForRole } from "@/lib/ui/command-palette";
import { ROLE_LABELS, type UserRole } from "@/lib/db/enums";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CommandPaletteTrigger } from "@/components/dashboard/command-palette-trigger";
import { useCommandPalette } from "@/components/dashboard/command-palette-provider";
import {
  BrandMark,
  SidebarNav,
  SignOutButton,
  UserSummary,
} from "@/components/dashboard/sidebar-parts";

/**
 * Encabezado superior del panel.
 *
 * Reúne los accesos de búsqueda y de menú en un solo sitio, para no tener que
 * descubrirlos en el sidebar:
 *
 *  - Escritorio (`lg`): un acceso de búsqueda compacto. Al activarlo se despliega
 *    la paleta; no ocupa espacio de forma permanente.
 *  - Tablet y móvil (`< lg`): el logo y la identidad del sistema junto al botón
 *    de menú (a la izquierda) y un botón de búsqueda táctil (a la derecha). El
 *    menú abre un drawer con las secciones, el usuario y el cierre de sesión.
 *
 * Los dos accesos de búsqueda abren EXACTAMENTE la misma paleta a través de
 * `useCommandPalette`, así que no hay una segunda búsqueda. El drawer comparte
 * las piezas del sidebar, con los mismos enlaces y permisos.
 */
export function DashboardTopBar({
  role,
  name,
  email,
}: {
  role: UserRole;
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const { openPalette } = useCommandPalette();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const items = getNavItemsForRole(role);

  // El drawer se cierra al cambiar de ruta: si no, al navegar seguiría tapando
  // la página de destino. Se ajusta durante el render en vez de con un efecto,
  // para no provocar un render en cascada; los enlaces además lo cierran al
  // pulsarlos. `openedAt` se mantiene siempre al día (aunque el drawer esté
  // cerrado), para que abrirlo tras navegar no lo cierre por un valor obsoleto.
  const [openedAt, setOpenedAt] = React.useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card px-3 sm:px-4">
      {/* Tablet y móvil: menú + marca. */}
      <div className="flex min-w-0 items-center gap-1.5 lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menú"
              aria-expanded={drawerOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <div className="flex items-center border-b px-4 py-3">
              <BrandMark />
            </div>
            <SidebarNav
              items={items}
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
            />
            <div className="border-t p-3">
              <UserSummary
                name={name}
                email={email}
                roleLabel={ROLE_LABELS[role]}
              />
              <div className="mt-3">
                <SignOutButton />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <BrandMark />
      </div>

      {/* Escritorio: acceso de búsqueda compacto a la izquierda. */}
      <div className="hidden flex-1 items-center lg:flex">
        <CommandPaletteTrigger variant="desktop" onOpen={openPalette} />
      </div>

      {/* Empuja el botón de búsqueda a la derecha en tablet y móvil. */}
      <div className="flex-1 lg:hidden" />

      {/* Tablet y móvil: búsqueda táctil. */}
      <div className="flex items-center lg:hidden">
        <CommandPaletteTrigger variant="mobile" onOpen={openPalette} />
      </div>
    </header>
  );
}
