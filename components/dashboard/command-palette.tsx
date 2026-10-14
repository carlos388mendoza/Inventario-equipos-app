"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Search, Sun } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { type UserRole } from "@/lib/db/enums";
import { getNavItemsForRole } from "@/lib/ui/command-palette";
import { moveActiveIndex, resolveActiveIndex } from "@/lib/ui/roving-index";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/components/dashboard/command-palette-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const THEME_OPTIONS = [
  { value: "light", label: "Tema claro", Icon: Sun },
  { value: "dark", label: "Tema oscuro", Icon: Moon },
  { value: "system", label: "Tema del sistema", Icon: Monitor },
] as const;

type Section = "Navegación" | "Apariencia" | "Cuenta";

const SECTION_ORDER: Section[] = ["Navegación", "Apariencia", "Cuenta"];

interface Command {
  id: string;
  label: string;
  section: Section;
  keywords: string;
  Icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

/**
 * Paleta de comandos (issue #19).
 *
 * Se abre con Cmd/Ctrl+K, con el botón «Buscar» del sidebar (escritorio) o con
 * el botón de búsqueda de la barra superior (móvil). Los tres caminos abren esta
 * misma paleta: el estado de apertura y el atajo viven en
 * `CommandPaletteProvider`, no aquí. Permite saltar a cualquier sección permitida
 * por el rol, cambiar el tema o cerrar sesión sin usar el ratón. La navegación se
 * construye con los MISMOS `NAV_ITEMS` y roles que el sidebar, así que nunca
 * ofrece una ruta que el usuario no pueda abrir.
 *
 * No añade dependencias: reutiliza el `Dialog` de Radix que ya tiene el
 * proyecto y gestiona el teclado y el foco a mano.
 */
export function CommandPalette({ role }: { role: UserRole }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const commands = React.useMemo<Command[]>(() => {
    const navigation: Command[] = getNavItemsForRole(role).map((item) => ({
      id: `nav:${item.href}`,
      label: item.label,
      section: "Navegación",
      keywords: item.href,
      Icon: item.icon,
      run: () => router.push(item.href),
    }));

    const appearance: Command[] = THEME_OPTIONS.map((option) => ({
      id: `theme:${option.value}`,
      label: option.label,
      section: "Apariencia",
      keywords: "tema apariencia color",
      Icon: option.Icon,
      run: () => setTheme(option.value),
    }));

    const account: Command[] = [
      {
        id: "account:signout",
        label: "Cerrar sesión",
        section: "Cuenta",
        keywords: "salir logout cuenta",
        Icon: LogOut,
        run: () => {
          void signOut();
          router.push("/login");
          router.refresh();
        },
      },
    ];

    return [...navigation, ...appearance, ...account];
  }, [role, router, setTheme]);

  const normalized = query.trim().toLowerCase();
  const filtered = commands.filter((command) =>
    normalized
      ? `${command.label} ${command.keywords}`
          .toLowerCase()
          .includes(normalized)
      : true
  );

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    items: filtered
      .map((command, index) => ({ command, index }))
      .filter((entry) => entry.command.section === section),
  })).filter((group) => group.items.length > 0);

  // El índice activo se recalcula acotado a la lista filtrada para que escribir
  // o filtrar nunca deje un índice fuera de rango (robustez de la revisión).
  const activePosition = resolveActiveIndex(activeIndex, filtered.length);
  const activeId =
    activePosition >= 0 ? filtered[activePosition]?.id : undefined;

  // Atajo global Cmd/Ctrl+K y estado de apertura: viven en
  // `CommandPaletteProvider` para compartirlos con los botones de la interfaz.

  // Al abrir, el foco va al buscador para poder escribir de inmediato.
  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Mantiene visible el comando activo al navegar con las flechas.
  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);

  function runCommand(command: Command) {
    setOpen(false);
    command.run();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => moveActiveIndex(index, filtered.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => moveActiveIndex(index, filtered.length, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = filtered[activePosition];
      if (command) runCommand(command);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActiveIndex(0);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[48%] gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <DialogDescription className="sr-only">
          Busca una sección, cambia el tema o cierra sesión.
        </DialogDescription>

        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas y acciones…"
            aria-label="Buscar páginas y acciones"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            Esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Sin resultados.
            </li>
          )}
          {grouped.map((group) => (
            <li key={group.section}>
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {group.section}
              </p>
              <ul>
                {group.items.map(({ command, index }) => {
                  const isActive = command.id === activeId;
                  const Icon = command.Icon;
                  return (
                    <li key={command.id}>
                      <button
                        type="button"
                        data-active={isActive ? "true" : undefined}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => runCommand(command)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {command.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
