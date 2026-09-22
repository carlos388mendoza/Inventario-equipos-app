"use client";

import * as React from "react";
import { Monitor, Moon, Rows3, Rows4, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
] as const;

const DENSITY_OPTIONS = [
  { value: "compact", label: "Compacta", Icon: Rows3 },
  { value: "normal", label: "Normal", Icon: Rows4 },
  { value: "comfortable", label: "Cómoda", Icon: Rows4 },
] as const;

const DENSITY_KEY = "table-density";

export function SettingsForm({ userName }: { userName: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [density, setDensity] = React.useState<"compact" | "normal" | "comfortable">("normal");
  
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const stored = window.localStorage.getItem(DENSITY_KEY) as 
      | "compact"
      | "normal"
      | "comfortable"
      | null;
    if (stored && DENSITY_OPTIONS.some((o) => o.value === stored)) {
      setDensity(stored);
    }
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    if (density === "normal") {
      delete document.documentElement.dataset.density;
    } else {
      document.documentElement.dataset.density = density;
    }
    window.localStorage.setItem(DENSITY_KEY, density);
  }, [density, mounted]);

  function changeDensity(next: (typeof DENSITY_OPTIONS)[number]["value"]) {
    setDensity(next);
  }

  if (!mounted) {
    return <div className="h-40 animate-pulse rounded-xl bg-card" aria-hidden />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tema</CardTitle>
          <CardDescription className="text-sm">
            Modo de color de la interfaz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-flex w-full items-center gap-1 rounded-lg border bg-muted p-1" role="group" aria-label="Tema">
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const isActive = mounted && theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Densidad de tablas</CardTitle>
          <CardDescription className="text-sm">
            Cuánta información cabe en cada fila.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {DENSITY_OPTIONS.map(({ value, label, Icon }) => {
            const isActive = mounted && density === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => changeDensity(value)}
                aria-pressed={isActive}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  isActive ? "border-gold bg-accent" : "hover:bg-accent/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                </span>
                {isActive && <span className="text-xs font-semibold text-gold">Activo</span>}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Cuenta: {userName} · Preferencias guardadas localmente en este dispositivo.
      </p>
    </div>
  );
}
