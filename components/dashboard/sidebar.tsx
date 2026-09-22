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

  return (
    <aside className="flex shrink-0 flex-col border-b bg-card lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-grupo-comidas.png"
          alt="Grupo Comidas"
          className="h-7 w-auto shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            Inventario Equipos
          </p>
          <p className="text-[11px] text-muted-foreground">Grupo Comidas</p>
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
                "flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-muted font-medium text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Card>
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
      </div>
    </aside>
  );
}