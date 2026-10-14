"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MoreHorizontal } from "lucide-react";

import { signOut } from "@/lib/auth/client";
import { type NavItem } from "@/lib/navigation";
import {
  getInlineNavItems,
  getSecondaryNavItems,
  groupNavItems,
} from "@/lib/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GrupoComidasMark } from "@/components/brand/grupo-comidas-mark";

/**
 * Piezas compartidas de la navegación (sidebar de escritorio y panel móvil).
 *
 * Vive aquí para que las dos pinturas usen EXACTAMENTE los mismos enlaces,
 * agrupación, marca y cierre de sesión. Así no hay una segunda implementación
 * del menú ni riesgo de que una ruta o un permiso se desincronice entre ambas.
 */

/** ¿La ruta actual corresponde a esta sección? */
export function isActiveRoute(pathname: string, item: NavItem): boolean {
  return (
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
  );
}

function initialsFrom(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/** Marca de Grupo Comidas + nombre del sistema. En modo contraído, solo la marca. */
export function BrandMark({
  collapsed = false,
  size,
  className,
}: {
  collapsed?: boolean;
  size?: number;
  className?: string;
}) {
  const markSize = size ?? (collapsed ? 34 : 40);
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        collapsed && "justify-center",
        className
      )}
    >
      <GrupoComidasMark size={markSize} />
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            Inventario Equipos
          </p>
          <p className="truncate text-[11px] font-medium text-gold">
            Grupo Comidas
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Clases de una sección de navegación. Las comparten los enlaces del sidebar y
 * el botón de opciones secundarias (`…`), para que este último tenga EXACTAMENTE
 * la misma alineación, ancho, alto y espaciado que el resto de secciones, tanto
 * expandido como contraído.
 */
const NAV_ITEM_CLASS =
  "flex w-full shrink-0 items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const NAV_ITEM_COLLAPSED_CLASS = "justify-center px-2";

/** Enlace de navegación. En modo contraído muestra solo el icono, con tooltip. */
export function NavLink({
  item,
  active,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        NAV_ITEM_CLASS,
        collapsed && NAV_ITEM_COLLAPSED_CLASS,
        active && "border-gold bg-primary font-medium text-primary-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return <li>{link}</li>;

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    </li>
  );
}

/**
 * Lista de navegación agrupada.
 *
 * Expandida lista TODAS las secciones visibles (principales y secundarias), como
 * antes de agruparlas, para no esconder opciones cuando hay espacio. Contraída
 * lista solo las principales (iconos, con tooltip) y deja las secundarias al
 * menú `…` de la parte inferior, porque ahí no caben sus nombres.
 */
export function SidebarNav({
  items,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const groups = groupNavItems(getInlineNavItems(items, collapsed));
  const secondaryItems = getSecondaryNavItems(items);
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
      {groups.map((group, groupIndex) => {
        const separated = group.id === "settings" && groupIndex > 0;
        return (
          <React.Fragment key={group.id}>
            {collapsed ? (
              groupIndex > 0 && (
                <div className="mx-2 my-1 h-px bg-border" aria-hidden="true" />
              )
            ) : (
              <p
                className={cn(
                  "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  separated && "mt-1 border-t border-border"
                )}
              >
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActiveRoute(pathname, item)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </React.Fragment>
        );
      })}
      <SidebarSecondaryMenu
        items={secondaryItems}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </nav>
  );
}

/**
 * Menú de opciones secundarias del sidebar (botón de tres puntos).
 *
 * Las secciones marcadas como `secondary` en `NAV_ITEMS` son las que ofrece este
 * menú. El botón ocupa la parte inferior del sidebar y tiene EXACTAMENTE la
 * misma alineación, ancho, altura y espaciado que el resto de los elementos de
 * navegación, tanto expandido (icono + texto "Más opciones") como contraído
 * (solo el icono, alineado igual que los demás).
 *
 * Contraído, el acceso conserva su nombre accesible con tooltip. Expandido,
 * cuando hay secciones secundarias visibles para el rol actual, estas también se
 * listan directamente en la navegación (para no esconder opciones tras el menú),
 * pero el botón de "Más opciones" sigue presente en la parte inferior, con su
 * menú. Si el rol no tiene ninguna sección secundaria, no se dibuja nada (ni
 * botón ni menú vacío). Respeta los mismos grupos y permisos, pues usa las
 * secciones ya filtradas por rol.
 */
export function SidebarSecondaryMenu({
  items,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const groups = groupNavItems(items);
  if (groups.length === 0) return null;

  const trigger = (
    <button
      type="button"
      aria-label="Más opciones"
      className={cn(NAV_ITEM_CLASS, collapsed && NAV_ITEM_COLLAPSED_CLASS)}
    >
      <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">Más opciones</span>}
    </button>
  );

  const triggerNode = collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent side="right">Más opciones</TooltipContent>
    </Tooltip>
  ) : (
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
  );

  return (
    <div className="mt-1 border-t pt-2">
      <DropdownMenu>
        <ul className="flex flex-col gap-1">
          <li>{triggerNode}</li>
        </ul>
        <DropdownMenuContent
          side={collapsed ? "right" : "bottom"}
          align="start"
          collisionPadding={8}
          className="w-56"
        >
          {groups.map((group, groupIndex) => (
            <React.Fragment key={group.id}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} onClick={onNavigate}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Resumen del usuario actual (avatar con iniciales + nombre, correo y rol). */
export function UserSummary({
  name,
  email,
  roleLabel,
  collapsed = false,
}: {
  name: string;
  email: string;
  roleLabel: string;
  collapsed?: boolean;
}) {
  const initials = initialsFrom(name);
  if (collapsed) {
    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        title={`${name} · ${roleLabel}`}
      >
        {initials}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {email} · {roleLabel}
        </p>
      </div>
    </div>
  );
}

/**
 * Botón de cierre de sesión con confirmación.
 *
 * Antes de la confirmación, un toque en "Cerrar sesión" cerraba la sesión al
 * instante; un toque accidental obligaba a volver a entrar. Ahora pide un
 * segundo paso explícito que además evita el signOut en mitad de un flujo.
 *
 * `compact` lo reduce a solo el icono (con nombre accesible) para el sidebar
 * contraído.
 */
export function SignOutButton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  function confirmSignOut() {
    void signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {compact ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            className={className}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-full", className)}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
          <AlertDialogDescription>
            Volverás a la pantalla de acceso y tendrás que iniciar sesión de nuevo
            para entrar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmSignOut}>
            Cerrar sesión
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
