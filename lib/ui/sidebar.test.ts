import { describe, expect, it } from "vitest";

import { NAV_GROUPS, NAV_ITEMS } from "@/lib/navigation";
import { ROLES } from "@/lib/db/enums";
import { getNavItemsForRole } from "@/lib/ui/command-palette";
import { groupNavItems } from "@/lib/ui/sidebar";

/**
 * Agrupación del sidebar. Se prueba en Node, sin DOM.
 *
 * Lo importante es que agrupar sea SOLO presentación: no debe perder ni
 * duplicar secciones y debe respetar los permisos por rol.
 */
describe("groupNavItems", () => {
  it("no pierde ni duplica secciones para ningún rol", () => {
    for (const role of Object.values(ROLES)) {
      const items = getNavItemsForRole(role);
      const grouped = groupNavItems(items);
      const flattened = grouped.flatMap((group) => group.items);
      // Agrupar reordena (por bloque), pero no debe perder ni duplicar.
      expect(flattened).toHaveLength(items.length);
      for (const item of items) {
        expect(flattened.filter((x) => x.href === item.href)).toHaveLength(1);
      }
    }
  });

  it("solo devuelve grupos con contenido, en el orden de NAV_GROUPS", () => {
    const grouped = groupNavItems(getNavItemsForRole(ROLES.ADMIN));
    for (const group of grouped) {
      expect(group.items.length).toBeGreaterThan(0);
    }
    const ids = grouped.map((group) => group.id);
    const expectedOrder = NAV_GROUPS.map((group) => group.id).filter((id) =>
      ids.includes(id)
    );
    expect(ids).toEqual(expectedOrder);
  });

  it("cada sección cae en el grupo que declara", () => {
    for (const group of groupNavItems(NAV_ITEMS)) {
      for (const item of group.items) {
        expect(item.group).toBe(group.id);
      }
    }
  });

  it("el usuario de restaurante no ve grupos sin secciones suyas", () => {
    const grouped = groupNavItems(getNavItemsForRole(ROLES.RESTAURANT_USER));
    const ids = grouped.map((group) => group.id);
    // Ve General (Panel/Ajustes), Inventario y Solicitudes, pero no Administración.
    expect(ids).toContain("general");
    expect(ids).toContain("inventory");
    expect(ids).toContain("requests");
    expect(ids).not.toContain("administration");
  });

  it("el administrador ve todos los grupos declarados", () => {
    const grouped = groupNavItems(getNavItemsForRole(ROLES.ADMIN));
    expect(grouped.map((group) => group.id)).toEqual(
      NAV_GROUPS.map((group) => group.id)
    );
  });
});
