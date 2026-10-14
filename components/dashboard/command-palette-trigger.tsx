import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCommandPaletteTrigger,
  type CommandPaletteTriggerId,
} from "@/lib/ui/command-palette";

/**
 * Acceso a la búsqueda global (issue #19, reubicado al encabezado).
 *
 * Dos variantes, una por breakpoint, que llaman EXACTAMENTE a la misma acción
 * (`onOpen` → `openPalette`), así que no hay una segunda búsqueda: ambas abren
 * la misma paleta.
 *
 *  - `desktop`: botón compacto con el icono y la palabra «Buscar». Es el acceso
 *    del encabezado en computadora. A propósito NO muestra la pista `Ctrl K`:
 *    el atajo sigue funcionando en segundo plano, pero la interfaz queda limpia.
 *  - `mobile`: botón táctil con solo el icono (nombre accesible «Buscar»), sin
 *    depender del teclado.
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
        variant="ghost"
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
        "h-9 justify-start gap-2 rounded-full px-3.5 font-normal text-muted-foreground",
        className
      )}
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span>{trigger.label}</span>
    </Button>
  );
}
