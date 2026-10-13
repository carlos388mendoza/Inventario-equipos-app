"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { moveActiveIndex, resolveActiveIndex } from "@/lib/ui/roving-index";

export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * Selector múltiple con búsqueda, "seleccionar todo" y borrado por etiqueta
 * (issue #17). Sin dependencias externas: el desplegable es un panel propio que
 * se cierra al hacer clic fuera o con Escape, igual que `Combobox`.
 *
 * Es controlado: el padre es dueño de `selected` y recibe los cambios por
 * `onChange`. Se usa para asignar los restaurantes de un técnico.
 *
 * Accesibilidad (revisión): no hay controles interactivos anidados. El campo es
 * un contenedor no interactivo que aloja las etiquetas —cada una con su propio
 * botón de quitar— y un botón aparte que abre la lista. Dentro de la lista, las
 * opciones son elementos `role="option"` (no botones) y la navegación con
 * flechas, Inicio/Fin y Enter se maneja desde el buscador con
 * `aria-activedescendant`.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyLabel = "Sin resultados.",
  selectAllLabel = "Seleccionar todo",
  clearLabel = "Limpiar",
  className,
  id,
  disabled = false,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  selectAllLabel?: string;
  clearLabel?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const listboxId = React.useId();

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(normalized) ||
          option.value.toLowerCase().includes(normalized)
      )
    : options;

  const selectedOptions = options.filter((option) =>
    selectedSet.has(option.value)
  );

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((option) => selectedSet.has(option.value));

  const activePosition = resolveActiveIndex(activeIndex, filtered.length);
  const activeOption =
    activePosition >= 0 ? filtered[activePosition] : undefined;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

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

  // Mantiene visible la opción activa al navegar con las flechas.
  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activePosition]);

  function toggleOpen() {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    setOpen((current) => !current);
  }

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function remove(value: string) {
    onChange(selected.filter((item) => item !== value));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      onChange(
        selected.filter((value) => !filtered.some((o) => o.value === value))
      );
    } else {
      const next = new Set(selected);
      for (const option of filtered) next.add(option.value);
      onChange([...next]);
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) =>
          moveActiveIndex(index, filtered.length, 1)
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) =>
          moveActiveIndex(index, filtered.length, -1)
        );
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(filtered.length - 1);
        break;
      case "Enter":
        event.preventDefault();
        if (activeOption) toggle(activeOption.value);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {selectedOptions.map((option) => (
          <Badge key={option.value} variant="secondary" className="gap-1">
            {option.label}
            <button
              type="button"
              aria-label={`Quitar ${option.label}`}
              disabled={disabled}
              onClick={() => remove(option.value)}
              className="rounded-sm outline-none hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={
            selectedOptions.length === 0
              ? placeholder
              : `${selectedOptions.length} seleccionado(s)`
          }
          onClick={toggleOpen}
          onKeyDown={(event) => {
            if (!disabled && event.key === "ArrowDown" && !open) {
              event.preventDefault();
              toggleOpen();
            }
          }}
          className="flex min-w-[3rem] flex-1 items-center gap-1 self-stretch rounded-sm bg-transparent text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
        >
          {selectedOptions.length === 0 && (
            <span className="truncate px-0.5 text-muted-foreground">
              {placeholder}
            </span>
          )}
          <ChevronsUpDown
            className="ml-auto size-4 shrink-0 opacity-50"
            aria-hidden="true"
          />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[12rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeOption ? optionId(activePosition) : undefined
              }
              className="h-8 w-full rounded-sm bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5 text-xs">
            <button
              type="button"
              onClick={toggleAllVisible}
              disabled={filtered.length === 0}
              className="rounded-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {allVisibleSelected ? "Deseleccionar todo" : selectAllLabel}
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="rounded-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {clearLabel}
            </button>
          </div>
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-60 overflow-y-auto p-1"
          >
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </li>
            )}
            {filtered.map((option, index) => {
              const isSelected = selectedSet.has(option.value);
              const isActive = index === activePosition;
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isActive ? "true" : undefined}
                  onClick={() => toggle(option.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input",
                      isSelected &&
                        "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                  <span className="line-clamp-1">{option.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
