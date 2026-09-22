"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { NAV_ITEMS } from "@/lib/navigation";
import { ROLE_LABELS, type UserRole } from "@/lib/db/enums";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const router = useRouter();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  function handleSignOut() {
    void signOut();
    router.push("/login");
    router.refresh();
  }

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <aside className="flex shrink-0 flex-col border-b bg-card lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 border-b px-4 py-3 lg:flex-col lg:items-center lg:gap-0 lg:py-4">
        <div className="flex shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-grupo-comidas.png"
            alt="Grupo Comidas"
            className="h-8 w-auto drop-shadow-sm lg:h-10"
          />
        </div>
        <div className="min-w-0 lg:mt-2 lg:w-full">
          <p className="truncate text-sm font-semibold leading-tight lg:text-center">
            Inventario Equipos
          </p>
          <p className="hidden text-[11px] font-medium text-gold sm:block lg:text-center">
            Grupo Comidas
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 overflow-x-auto p-2 lg:flex-1 lg:overflow-y-auto lg:overflow-x-visible">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "border-gold bg-primary font-medium text-primary-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t p-3">
        <ThemeToggle className="w-full" />

        <Card className="hidden lg:block">
          <CardHeader className="p-3">
            <CardTitle className="truncate text-sm">{name}</CardTitle>
            <CardDescription className="truncate text-xs">
              {email} · {ROLE_LABELS[role]}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ROLE_LABELS[role]}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label="Cerrar sesión"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}