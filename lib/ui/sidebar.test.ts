import { describe, expect, it } from "vitest";

import { NAV_GROUPS, NAV_ITEMS } from "@/lib/navigation";
import { ROLES } from "@/lib/db/enums";
import { getNavItemsForRole } from "@/lib/ui/command-palette";
import {
  getPrimaryNavItems,
  getSecondaryNavItems,
  groupNavItems,
} from "@/lib/ui/sidebar";

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
    // Ve General (Panel), Inventario, Solicitudes y Sistema (Ajustes), pero no
    // Administración.
    expect(ids).toContain("general");
    expect(ids).toContain("inventory");
    expect(ids).toContain("requests");
    expect(ids).toContain("settings");
    expect(ids).not.toContain("administration");
  });

  it("Ajustes queda al final, en su propio bloque", () => {
    const grouped = groupNavItems(getNavItemsForRole(ROLES.ADMIN));
    const lastGroup = grouped[grouped.length - 1];
    expect(lastGroup.id).toBe("settings");
    expect(lastGroup.items.map((item) => item.href)).toEqual(["/settings"]);
  });

  it("el administrador ve todos los grupos declarados", () => {
    const grouped = groupNavItems(getNavItemsForRole(ROLES.ADMIN));
    expect(grouped.map((group) => group.id)).toEqual(
      NAV_GROUPS.map((group) => group.id)
    );
  });
});

/**
 * Reparto entre navegación principal y menú de tres puntos. Se prueba en Node,
 * sin DOM. La clave: el reparto debe ser una partición exacta (ni pérdidas ni
 * duplicados) y no debe tocar permisos ni el agrupado existente.
 */
describe("reparto primario / secundario", () => {
  const DAILY_HREFS = [
    "/dashboard",
    "/equipment",
    "/inventory",
    "/movements",
    "/requests",
    "/technicians",
    "/users",
    "/settings",
  ];

  it("principal + secundarias = todas, sin pérdidas ni duplicados", () => {
    for (const role of Object.values(ROLES)) {
      const items = getNavItemsForRole(role);
      const primary = getPrimaryNavItems(items);
      const secondary = getSecondaryNavItems(items);
      expect(primary.length + secondary.length).toBe(items.length);
      const all = [...primary, ...secondary];
      for (const item of items) {
        expect(all.filter((x) => x.href === item.href)).toHaveLength(1);
      }
    }
  });

  it("las secciones secundarias conservan grupo y permisos", () => {
    for (const item of getSecondaryNavItems(NAV_ITEMS)) {
      const original = NAV_ITEMS.find((x) => x.href === item.href);
      expect(item.group).toBe(original?.group);
      expect(item.roles).toEqual(original?.roles);
    }
  });

  it("la navegación cotidiana y Ajustes nunca son secundarias", () => {
    const secondaryHrefs = getSecondaryNavItems(NAV_ITEMS).map(
      (item) => item.href
    );
    for (const href of DAILY_HREFS) {
      expect(secondaryHrefs).not.toContain(href);
    }
    // Ajustes además permanece al final de la principal.
    const primary = getPrimaryNavItems(getNavItemsForRole(ROLES.ADMIN));
    expect(primary[primary.length - 1]?.href).toBe("/settings");
  });

  it("el usuario de restaurante no tiene secundarias (no ve el botón)", () => {
    expect(
      getSecondaryNavItems(getNavItemsForRole(ROLES.RESTAURANT_USER))
    ).toHaveLength(0);
  });

  it("el administrador ve las cuatro secciones secundarias", () => {
    const secondary = getSecondaryNavItems(getNavItemsForRole(ROLES.ADMIN));
    expect(secondary.map((item) => item.href)).toEqual([
      "/statistics",
      "/labels",
      "/restaurants",
      "/equipment-types",
    ]);
  });
});
