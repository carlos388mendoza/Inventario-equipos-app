import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import type { UserRole } from "@/lib/db/enums";

/**
 * Lógica pura de la paleta de comandos (issue #19): atajo de teclado, estado de
 * apertura, disparadores (botón de escritorio y de móvil) y el filtrado de la
 * navegación por rol.
 *
 * Vive fuera de los componentes para poder probarse en Node sin DOM (el
 * proyecto no tiene jsdom/testing-library) y para que la paleta, el sidebar y
 * los botones compartan una única definición, sin duplicar reglas.
 */

/** Forma mínima de un evento de teclado que necesita el detector del atajo. */
export interface ShortcutKeyboardEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * ¿El evento corresponde a Ctrl+K o Cmd+K? Se compara en minúsculas para
 * aceptar también `K` con Mayús. Se ignora si hay Alt (en macOS Cmd+Alt+K
 * produce otro carácter y no debe abrir la paleta).
 */
export function isCommandPaletteShortcut(
  event: ShortcutKeyboardEvent
): boolean {
  if (event.altKey === true) return false;
  return (
    event.key.toLowerCase() === "k" &&
    (event.ctrlKey === true || event.metaKey === true)
  );
}

export type CommandPaletteTriggerId = "desktop" | "mobile";

export interface CommandPaletteTriggerDescriptor {
  id: CommandPaletteTriggerId;
  /** Texto visible del botón. */
  label: string;
  /** Nombre accesible del botón. */
  ariaLabel: string;
}

/**
 * Los dos botones que abren la MISMA paleta. Son dos por breakpoint (uno vive en
 * el sidebar de escritorio y otro en la barra superior de móvil), no una
 * duplicación: cada uno aparece en un único breakpoint y ambos ejecutan la
 * misma acción `open`.
 */
export const COMMAND_PALETTE_TRIGGERS: readonly CommandPaletteTriggerDescriptor[] =
  [
    { id: "desktop", label: "Buscar", ariaLabel: "Buscar" },
    { id: "mobile", label: "Buscar", ariaLabel: "Buscar" },
  ];

export function getCommandPaletteTrigger(
  id: CommandPaletteTriggerId
): CommandPaletteTriggerDescriptor {
  const trigger = COMMAND_PALETTE_TRIGGERS.find((item) => item.id === id);
  if (!trigger) {
    throw new Error(`Disparador de paleta desconocido: ${id}`);
  }
  return trigger;
}

export interface CommandPaletteState {
  open: boolean;
}

export const COMMAND_PALETTE_INITIAL_STATE: CommandPaletteState = {
  open: false,
};

/**
 * Estado de apertura de la paleta. `open` lo usan los dos botones, `toggle` lo
 * usa el atajo de teclado (Cmd/Ctrl+K) y `close` el cierre del diálogo.
 */
export type CommandPaletteAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "toggle" };

export function commandPaletteReducer(
  state: CommandPaletteState,
  action: CommandPaletteAction
): CommandPaletteState {
  switch (action.type) {
    case "open":
      return { open: true };
    case "close":
      return { open: false };
    case "toggle":
      return { open: !state.open };
    default:
      return state;
  }
}

/**
 * Secciones visibles para un rol. Es la MISMA fuente que usa el sidebar y que
 * usa la paleta, así que ninguna ofrece una ruta que el usuario no pueda abrir.
 */
export function getNavItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
