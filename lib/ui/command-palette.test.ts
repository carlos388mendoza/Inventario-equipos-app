import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/lib/navigation";
import { ROLES } from "@/lib/db/enums";
import {
  COMMAND_PALETTE_INITIAL_STATE,
  COMMAND_PALETTE_TRIGGERS,
  commandPaletteReducer,
  getCommandPaletteTrigger,
  getNavItemsForRole,
  isCommandPaletteShortcut,
} from "@/lib/ui/command-palette";

/**
 * Lógica pura de la paleta de comandos (issue #19): atajo de teclado, estado de
 * apertura y filtrado por rol. Se prueba en Node, sin DOM.
 */
describe("isCommandPaletteShortcut", () => {
  it("reconoce Ctrl+K", () => {
    expect(isCommandPaletteShortcut({ key: "k", ctrlKey: true })).toBe(true);
  });

  it("reconoce Cmd+K (metaKey) en macOS", () => {
    expect(isCommandPaletteShortcut({ key: "k", metaKey: true })).toBe(true);
  });

  it("acepta K con Mayús", () => {
    expect(isCommandPaletteShortcut({ key: "K", ctrlKey: true })).toBe(true);
    expect(isCommandPaletteShortcut({ key: "K", metaKey: true })).toBe(true);
  });

  it("ignora la tecla sin modificador", () => {
    expect(isCommandPaletteShortcut({ key: "k" })).toBe(false);
  });

  it("ignora otras combinaciones", () => {
    expect(isCommandPaletteShortcut({ key: "enter", ctrlKey: true })).toBe(
      false
    );
    expect(isCommandPaletteShortcut({ key: "j", metaKey: true })).toBe(false);
  });

  it("ignora Ctrl/Cmd+Alt+K (en macOS produce otro carácter)", () => {
    expect(
      isCommandPaletteShortcut({ key: "k", ctrlKey: true, altKey: true })
    ).toBe(false);
    expect(
      isCommandPaletteShortcut({ key: "k", metaKey: true, altKey: true })
    ).toBe(false);
  });
});

describe("commandPaletteReducer", () => {
  it("empieza cerrada", () => {
    expect(COMMAND_PALETTE_INITIAL_STATE.open).toBe(false);
  });

  it("abre con la acción que disparan los botones", () => {
    expect(commandPaletteReducer({ open: false }, { type: "open" }).open).toBe(
      true
    );
    // Abrir cuando ya está abierta es idempotente.
    expect(commandPaletteReducer({ open: true }, { type: "open" }).open).toBe(
      true
    );
  });

  it("cierra con la acción del diálogo", () => {
    expect(commandPaletteReducer({ open: true }, { type: "close" }).open).toBe(
      false
    );
  });

  it("alterna con el atajo de teclado, en ambos sentidos", () => {
    expect(
      commandPaletteReducer({ open: false }, { type: "toggle" }).open
    ).toBe(true);
    expect(commandPaletteReducer({ open: true }, { type: "toggle" }).open).toBe(
      false
    );
  });
});

describe("COMMAND_PALETTE_TRIGGERS", () => {
  it("define exactamente un botón de escritorio y uno de móvil, sin duplicados", () => {
    expect(COMMAND_PALETTE_TRIGGERS).toHaveLength(2);
    const ids = COMMAND_PALETTE_TRIGGERS.map((trigger) => trigger.id);
    expect(ids).toEqual(["desktop", "mobile"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada botón tiene etiqueta y nombre accesible no vacíos", () => {
    for (const trigger of COMMAND_PALETTE_TRIGGERS) {
      expect(trigger.label.trim().length).toBeGreaterThan(0);
      expect(trigger.ariaLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it("getCommandPaletteTrigger devuelve el descriptor de cada variante", () => {
    expect(getCommandPaletteTrigger("desktop").id).toBe("desktop");
    expect(getCommandPaletteTrigger("mobile").id).toBe("mobile");
  });
});

describe("getNavItemsForRole", () => {
  it("devuelve la misma lista que el sidebar (una sola fuente de verdad)", () => {
    for (const role of Object.values(ROLES)) {
      expect(getNavItemsForRole(role)).toEqual(
        NAV_ITEMS.filter((item) => item.roles.includes(role))
      );
    }
  });

  it("el admin ve las rutas solo-admin", () => {
    const hrefs = getNavItemsForRole(ROLES.ADMIN).map((item) => item.href);
    expect(hrefs).toContain("/users");
    expect(hrefs).toContain("/restaurants");
    expect(hrefs).toContain("/movements");
  });

  it("un usuario de restaurante no ve las rutas de administración", () => {
    const hrefs = getNavItemsForRole(ROLES.RESTAURANT_USER).map(
      (item) => item.href
    );
    expect(hrefs).not.toContain("/users");
    expect(hrefs).not.toContain("/restaurants");
    expect(hrefs).not.toContain("/movements");
    // Pero sí ve lo suyo.
    expect(hrefs).toContain("/my-requests");
    expect(hrefs).toContain("/requests");
  });

  it("ningún elemento visible queda fuera del rol consultado", () => {
    for (const role of Object.values(ROLES)) {
      for (const item of getNavItemsForRole(role)) {
        expect(item.roles).toContain(role);
      }
    }
  });
});
