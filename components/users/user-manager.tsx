"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  createUserAction,
  toggleUserActiveAction,
  updateUserAction,
} from "@/app/(dashboard)/users/actions";
import type { UserDto, RestaurantOption } from "@/app/(dashboard)/users/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ROLES, ROLE_LABELS } from "@/lib/db/enums";

const ROLE_OPTIONS = Object.values(ROLES) as (keyof typeof ROLE_LABELS)[];

interface FormState {
  name: string;
  email: string;
  password: string;
  role: string;
  restaurantId: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  role: ROLES.RESTAURANT_USER,
  restaurantId: "",
  active: true,
};

export function UserManager({
  users: initial,
  restaurants,
}: {
  users: UserDto[];
  restaurants: RestaurantOption[];
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserDto | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [submitting, startSubmit] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(user: UserDto) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      restaurantId: user.restaurantId ?? "",
      active: user.active,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        restaurantId: form.restaurantId || null,
        active: form.active,
        ...(editing ? { id: editing.id } : { password: form.password }),
      };
      const result = editing
        ? await updateUserAction(payload)
        : await createUserAction(payload);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar el usuario.");
        return;
      }
      toast.success(editing ? "Usuario actualizado." : "Usuario creado.");
      setDialogOpen(false);
      window.location.reload();
    });
  }

  function handleToggle(user: UserDto) {
    startSubmit(async () => {
      const result = await toggleUserActiveAction({
        id: user.id,
        active: !user.active,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo cambiar el estado.");
        return;
      }
      toast.success(
        user.active ? "Usuario desactivado." : "Usuario activado."
      );
      window.location.reload();
    });
  }

  const normalized = query.trim().toLowerCase();
  const filtered = initial.filter((u) => {
    const matchesQuery =
      !normalized ||
      u.name.toLowerCase().includes(normalized) ||
      u.email.toLowerCase().includes(normalized);
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && u.active) ||
      (filter === "inactive" && !u.active);
    return matchesQuery && matchesFilter;
  });

  const counts = {
    total: initial.length,
    active: initial.filter((u) => u.active).length,
    inactive: initial.filter((u) => !u.active).length,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Usuarios</CardTitle>
            <CardDescription>
              Administra las cuentas del sistema y sus restaurantes.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>Nuevo usuario</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Buscar por nombre o email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {(["all", "active", "inactive"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={
                    filter === key
                      ? "font-semibold text-foreground"
                      : "hover:text-foreground"
                  }
                >
                  {key === "all" && `Todos (${counts.total})`}
                  {key === "active" && `Activos (${counts.active})`}
                  {key === "inactive" && `Inactivos (${counts.inactive})`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nombre</th>
                  <th className="px-4 py-2 text-left font-medium">Email</th>
                  <th className="px-4 py-2 text-left font-medium">Rol</th>
                  <th className="px-4 py-2 text-left font-medium">Restaurante</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No hay usuarios que coincidan.
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{u.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">
                        {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ??
                          u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {u.restaurantName ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={u.active ? "default" : "secondary"}>
                        {u.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(u)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant={u.active ? "secondary" : "outline"}
                          size="sm"
                          disabled={submitting}
                          onClick={() => handleToggle(u)}
                        >
                          {u.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar usuario" : "Nuevo usuario"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nombre</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ej. María Pérez"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="maria@grupo.com"
                maxLength={254}
                required
              />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="user-password">Contraseña</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  maxLength={100}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Restaurante</Label>
              <Select
                value={form.restaurantId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, restaurantId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin restaurante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin restaurante</SelectItem>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="user-active"
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
                className="h-4 w-4"
              />
              <Label htmlFor="user-active">Cuenta activa</Label>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
