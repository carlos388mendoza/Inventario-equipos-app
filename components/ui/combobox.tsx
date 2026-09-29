"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  detail?: string;
}

/**
 * Selector con búsqueda. Útil cuando la lista tiene muchos elementos (p. ej.
 * más de 100 restaurantes) y no conviene desplazarse. No usa dependencias
 * externas: el desplegable es un panel propio que se cierra al hacer clic
 * fuera o con Escape.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar…",
  emptyLabel = "Sin resultados.",
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? options.filter((option) =>
        [option.label, option.detail, option.value]
          .filter(Boolean)
          .some((text) => text!.toLowerCase().includes(normalized))
      )
    : options;

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function toggleOpen() {
    setQuery("");
    setOpen((current) => !current);
  }

  function select(optionValue: string) {
    onValueChange(optionValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      >
        <span
          className={cn(
            "line-clamp-1 text-left",
            !selected && "text-muted-foreground"
          )}
        >
          {selected ? selected.label : placeholder}
          {selected?.detail && (
            <span className="text-muted-foreground"> ({selected.detail})</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[12rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-sm bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </li>
            )}
            {filtered.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => select(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      active && "bg-accent/50"
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        active ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="line-clamp-1">
                      {option.label}
                      {option.detail && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({option.detail})
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}