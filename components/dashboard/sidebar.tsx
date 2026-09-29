"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { ROLE_LABELS, type UserRole } from "@/lib/db/enums";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { GrupoComidasMark } from "@/components/brand/grupo-comidas-mark";

/**
 * Navegación del dashboard.
 *
 * `lg` (1024px) es el breakpoint que ya usaba el resto de la aplicación, así que
 * se reutiliza en vez de inventar uno nuevo:
 *
 *   - desde `lg`: sidebar fijo de 256px, como estaba.
 *   - por debajo de `lg`: solo una barra superior con el botón de menú; las
 *     opciones viven en un panel lateral. Antes el menú se desplegaba como una
 *     tira horizontal con scroll, que dejaba el contenido squeezed y sin access
 *     a las secciones del final sin descubrirlas.
 *
 * Las dos pinturas leen la MISMA lista filtrada por rol y el mismo `NAV_ITEMS`,
 * así que no hay opciones duplicadas ni una ruta que se pierda: la barra móvil
 * solo sustituye a la presentación.
 */
export function DashboardSidebar({
  role,
  name,
  email,
}: {
  role: UserRole;
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // El panel se cierra al cambiar de ruta: si no, al navegar con el drawer
  // abierto seguiría tapando la página de destino. Se ajusta durante el render en
  // lugar de con un efecto, para no provocar un render en cascada; los enlaces
  // del panel además lo cierran al pulsarlos.
  const [openedAt, setOpenedAt] = React.useState(pathname);
  if (open && openedAt !== pathname) {
    setOpen(false);
    setOpenedAt(pathname);
  }

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  function isActiveRoute(item: NavItem) {
    return (
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
    );
  }

  return (
    <>
      {/* Sidebar de escritorio: intacto, a partir de lg. */}
      <aside className="hidden shrink-0 border-r bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col">
        <div className="flex flex-col items-center gap-0 border-b px-4 py-4">
          <div className="flex shrink-0 items-center justify-center">
            <GrupoComidasMark size={56} />
          </div>
          <div className="mt-2 w-full">
            <p className="truncate text-center text-sm font-semibold leading-tight">
              Inventario Equipos
            </p>
            <p className="text-center text-[11px] font-medium text-gold">
              Grupo Comidas
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActiveRoute(item)} />
          ))}
        </nav>

        <div className="border-t p-3">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0 p-3">
              <GrupoComidasMark size={36} />
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{name}</CardTitle>
                <CardDescription className="truncate text-xs">
                  {email} · {ROLE_LABELS[role]}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <SignOutButton />
            </CardContent>
          </Card>
        </div>
      </aside>

      {/* Barra móvil: marca a la izquierda, menú a la derecha. */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-card px-4 py-2.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <GrupoComidasMark size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              Inventario Equipos
            </p>
            <p className="truncate text-[11px] font-medium text-gold">
              Grupo Comidas
            </p>
          </div>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Abrir menú"
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <div className="flex items-center gap-2.5 border-b px-4 py-3">
              <GrupoComidasMark size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">
                  Inventario Equipos
                </p>
                <p className="truncate text-[11px] font-medium text-gold">
                  Grupo Comidas
                </p>
              </div>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActiveRoute(item)}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </nav>

            <div className="border-t p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROLE_LABELS[role]}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <SignOutButton />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

/**
 * Botón de cierre de sesión con confirmación.
 *
 * Antes de la confirmación, un toque en "Cerrar sesión" cerraba la sesión al
 * instante; un toque accidental obligaba a volver a entrar. Ahora pide un
 * segundo paso explícito que además evita el signOut en mitad de un flujo.
 */
function SignOutButton() {
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
          <AlertDialogDescription>
            Volverás a la pantalla de acceso y tendrás que iniciar sesión de
            nuevo para entrar.
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

/** Enlace de navegación, compartido por el sidebar y el panel lateral. */
function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "border-gold bg-primary font-medium text-primary-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}
