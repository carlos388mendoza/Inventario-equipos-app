"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  createUserAction,
  deleteUserAction,
  toggleUserActiveAction,
  updateUserAction,
} from "@/app/(dashboard)/users/actions";
import type { UserDto, RestaurantOption } from "@/app/(dashboard)/users/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { SortableHeader, useTableSort } from "@/components/ui/sortable";
import {
  ROLES,
  ROLE_LABELS,
  asUserRole,
  isTechnicianRole,
} from "@/lib/db/enums";
import { useMutationSync } from "@/lib/sync/use-tab-sync";

const ROLE_OPTIONS = Object.values(ROLES) as (keyof typeof ROLE_LABELS)[];

interface FormState {
  name: string;
  email: string;
  password: string;
  role: string;
  restaurantId: string;
  restaurantIds: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  role: ROLES.RESTAURANT_USER,
  restaurantId: "",
  restaurantIds: [],
};

type ConfirmAction =
  | { type: "toggle"; user: UserDto }
  | { type: "delete"; user: UserDto };

export function UserManager({
  users: initial,
  restaurants,
  currentUserId,
}: {
  users: UserDto[];
  restaurants: RestaurantOption[];
  currentUserId: string;
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserDto | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [confirm, setConfirm] = React.useState<ConfirmAction | null>(null);
  const { sort, toggle, sortRows } = useTableSort();
  const restaurantNameById = React.useMemo(
    () => new Map(restaurants.map((r) => [r.id, r.name])),
    [restaurants]
  );

  const [submitting, startSubmit] = useTransition();
  const { refreshAndBroadcast } = useMutationSync();

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
      restaurantIds: user.assignedRestaurantIds ?? [],
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
        restaurantIds: form.restaurantIds,
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
      refreshAndBroadcast();
    });
  }

  function requestToggle(user: UserDto) {
    setConfirm({ type: "toggle", user });
  }

  function requestDelete(user: UserDto) {
    setConfirm({ type: "delete", user });
  }

  /** Ejecuta la acción confirmada (activar/desactivar o eliminar). */
  function runConfirmed() {
    const action = confirm;
    if (!action) return;
    startSubmit(async () => {
      const result =
        action.type === "delete"
          ? await deleteUserAction({ id: action.user.id })
          : await toggleUserActiveAction({
              id: action.user.id,
              active: !action.user.active,
            });

      setConfirm(null);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo completar la acción.");
        return;
      }
      if (action.type === "delete") {
        toast.success("Usuario eliminado.");
      } else {
        toast.success(
          action.user.active ? "Usuario desactivado." : "Usuario activado."
        );
      }
      refreshAndBroadcast();
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

  const sorted = React.useMemo(
    () =>
      sortRows(filtered, (u, key) => {
        switch (key) {
          case "name":
            return u.name;
          case "email":
            return u.email;
          case "role":
            return u.role;
          case "restaurant":
            return u.restaurantName ?? null;
          case "active":
            return u.active ? 1 : 0;
          default:
            return null;
        }
      }),
    [filtered, sortRows]
  );

  // El rol de restaurante queda atado a un restaurante (regla del servidor).
  // La UI lo refleja: sin restaurante no se permite guardar.
  const restaurantRequired = form.role === ROLES.RESTAURANT_USER;
  const technicianRole = isTechnicianRole(asUserRole(form.role));

  const confirmTitle = confirm
    ? confirm.type === "delete"
      ? "Eliminar usuario"
      : confirm.user.active
        ? "Desactivar usuario"
        : "Activar usuario"
    : "";
  const confirmDescription = confirm
    ? confirm.type === "delete"
      ? `Se dará de baja a ${confirm.user.name}. No se borra el historial (solicitudes, equipos y movimientos) y se cerrará su sesión: no podrá iniciar sesión ni reactivarse desde aquí.`
      : confirm.user.active
        ? `¿Desactivar a ${confirm.user.name}? Se cerrará su sesión. Conserva su rol y su restaurante asignado.`
        : `¿Activar a ${confirm.user.name}? Podrá iniciar sesión de nuevo.`
    : "";

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
                  <SortableHeader
                    label="Nombre"
                    sortKey="name"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Email"
                    sortKey="email"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Rol"
                    sortKey="role"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Restaurante"
                    sortKey="restaurant"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Estado"
                    sortKey="active"
                    sort={sort}
                    onToggle={toggle}
                  />
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
                {sorted.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
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
                        {isTechnicianRole(asUserRole(u.role))
                          ? u.assignedRestaurantIds.length > 0
                            ? u.assignedRestaurantIds
                                .map((id) => restaurantNameById.get(id) ?? id)
                                .join(", ")
                            : "Sin asignar"
                          : u.restaurantName ?? "—"}
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
                            disabled={submitting || isSelf}
                            title={
                              isSelf
                                ? "No puedes cambiar el estado de tu propia cuenta"
                                : undefined
                            }
                            onClick={() => requestToggle(u)}
                          >
                            {u.active ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={submitting || isSelf}
                            title={
                              isSelf
                                ? "No puedes eliminar tu propia cuenta"
                                : undefined
                            }
                            onClick={() => requestDelete(u)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              {technicianRole ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Marca los restaurantes que este técnico puede atender.
                  </p>
                  <MultiSelect
                    options={restaurants.map((r) => ({
                      value: r.id,
                      label: `${r.name} (${r.code})`,
                    }))}
                    selected={form.restaurantIds}
                    onChange={(restaurantIds) =>
                      setForm((f) => ({ ...f, restaurantIds }))
                    }
                    placeholder="Selecciona restaurantes"
                    searchPlaceholder="Buscar restaurante…"
                    emptyLabel="No hay restaurantes activos."
                  />
                </>
              ) : (
                <>
                  <Select
                    value={form.restaurantId}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, restaurantId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          restaurantRequired
                            ? "Selecciona un restaurante"
                            : "Sin restaurante"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {!restaurantRequired && (
                        <SelectItem value="">Sin restaurante</SelectItem>
                      )}
                      {restaurants.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {restaurantRequired && (
                    <p className="text-xs text-muted-foreground">
                      Requerido para el rol de restaurante: sin él no podrá crear
                      solicitudes.
                    </p>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={submitting || (restaurantRequired && !form.restaurantId)}
              >
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              className={
                confirm?.type === "delete"
                  ? buttonVariants({ variant: "destructive" })
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                runConfirmed();
              }}
            >
              {confirm?.type === "delete"
                ? "Eliminar"
                : confirm?.user.active
                  ? "Desactivar"
                  : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
