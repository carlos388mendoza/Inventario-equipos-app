"use client";

import * as React from "react";

import {
  commandPaletteReducer,
  COMMAND_PALETTE_INITIAL_STATE,
  isCommandPaletteShortcut,
} from "@/lib/ui/command-palette";

interface CommandPaletteContextValue {
  /** Si la paleta está abierta. */
  open: boolean;
  /** Cambia el estado (lo usa el propio diálogo al abrirse/cerrarse). */
  setOpen: (open: boolean) => void;
  /** Abre la paleta: lo que ejecutan el botón de escritorio y el de móvil. */
  openPalette: () => void;
}

const CommandPaletteContext =
  React.createContext<CommandPaletteContextValue | null>(null);

/**
 * Estado compartido de la paleta de comandos (issue #19).
 *
 * El estado y el atajo Cmd/Ctrl+K viven aquí, en un único punto, para que
 * cualquier botón de la interfaz (escritorio o móvil) pueda abrir EXACTAMENTE la
 * misma paleta sin duplicar lógica. El atajo sigue funcionando igual que antes.
 */
export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = React.useReducer(
    commandPaletteReducer,
    COMMAND_PALETTE_INITIAL_STATE
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isCommandPaletteShortcut(event)) {
        event.preventDefault();
        dispatch({ type: "toggle" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = React.useMemo<CommandPaletteContextValue>(
    () => ({
      open: state.open,
      setOpen: (next) => dispatch({ type: next ? "open" : "close" }),
      openPalette: () => dispatch({ type: "open" }),
    }),
    [state.open]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette debe usarse dentro de CommandPaletteProvider"
    );
  }
  return context;
}
