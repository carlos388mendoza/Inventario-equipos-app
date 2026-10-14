import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCommandPaletteTrigger,
  type CommandPaletteTriggerId,
} from "@/lib/ui/command-palette";

/**
 * Botón que abre la paleta de comandos (issue #19).
 *
 * Dos variantes, una por breakpoint, que llaman EXACTAMENTE a la misma acción
 * (`onOpen` → `openPalette`):
 *
 *  - `desktop`: botón con etiqueta «Buscar» y la pista `Ctrl K`. Vive en el
 *    sidebar, que solo se muestra a partir de `lg`.
 *  - `mobile`: botón táctil con solo el icono (nombre accesible «Buscar»). Vive
 *    en la barra superior, sin depender del teclado.
 *
 * Es un componente de presentación sin hooks de Next, para poder verificarlo en
 * las pruebas renderizando el marcado.
 */
export function CommandPaletteTrigger({
  variant,
  onOpen,
  className,
}: {
  variant: CommandPaletteTriggerId;
  onOpen: () => void;
  className?: string;
}) {
  const trigger = getCommandPaletteTrigger(variant);

  if (variant === "mobile") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onOpen}
        aria-label={trigger.ariaLabel}
        data-command-palette-trigger={trigger.id}
        className={className}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onOpen}
      aria-label={trigger.ariaLabel}
      data-command-palette-trigger={trigger.id}
      className={cn(
        "w-full justify-start gap-2 font-normal text-muted-foreground",
        className
      )}
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span>{trigger.label}</span>
      <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        Ctrl K
      </kbd>
    </Button>
  );
}
