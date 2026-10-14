import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/lib/auth/client", () => ({ signOut: () => {} }));

import { SidebarSecondaryMenu } from "@/components/dashboard/sidebar-parts";
import { getNavItemsForRole } from "@/lib/ui/command-palette";
import { getSecondaryNavItems } from "@/lib/ui/sidebar";
import { ROLES } from "@/lib/db/enums";

/**
 * Menú de opciones secundarias del sidebar. El contenido del `DropdownMenu` de
 * Radix solo se monta al abrir, así que en el HTML del servidor se comprueba el
 * disparador (expandido y contraído) y el caso sin secundarias. Qué secciones
 * contiene se verifica en `lib/ui/sidebar.test.ts` sobre `getSecondaryNavItems`.
 */
const secondary = getSecondaryNavItems(getNavItemsForRole(ROLES.ADMIN));

function render(collapsed: boolean, items = secondary) {
  return renderToStaticMarkup(
    React.createElement(SidebarSecondaryMenu, { items, collapsed })
  );
}

describe("SidebarSecondaryMenu", () => {
  it("expandido: un único botón de tres puntos con etiqueta y menú", () => {
    const html = render(false);
    expect((html.match(/<button/g) ?? []).length).toBe(1);
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
    expect(html).toContain('aria-label="Más opciones"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain("lucide-ellipsis");
    expect(html).toContain(">Más opciones</span>");
  });

  it("contraído: el mismo botón, solo icono (con nombre accesible y tooltip)", () => {
    const html = render(true);
    expect((html.match(/<button/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-label="Más opciones"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain("lucide-ellipsis");
    // Sin texto visible: el acceso es el icono más el tooltip.
    expect(html).not.toContain(">Más opciones</span>");
  });

  it("sin secundarias no dibuja nada (ni botón ni menú vacío)", () => {
    expect(render(false, [])).toBe("");
  });
});
