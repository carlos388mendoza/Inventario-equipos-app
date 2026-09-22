"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
] as const;

/**
 * Selector de tema estilo Google: control segmentado con
 * Claro / Oscuro / Sistema usando next-themes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // next-themes: el tema solo se conoce tras la hidratación en el cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Evita diferencias de hidratación: el tema solo se conoce tras montar.
  const active = (value: (typeof OPTIONS)[number]["value"]) =>
    mounted && theme === value;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border bg-muted p-1",
        className
      )}
      role="group"
      aria-label="Cambiar tema"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = active(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={`Tema ${label}`}
            aria-pressed={isActive}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}