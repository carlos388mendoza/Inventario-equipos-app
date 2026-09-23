"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  createRestaurant,
  toggleRestaurantActive,
  updateRestaurant,
} from "@/app/(dashboard)/restaurants/actions";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import type { RestaurantDto } from "@/app/(dashboard)/restaurants/types";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

const EMPTY_FORM = { name: "", code: "", address: "" };

export function RestaurantManager({
  restaurants: initial,
}: {
  restaurants: RestaurantDto[];
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "active" | "inactive">(
    "all"
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RestaurantDto | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, startSubmit] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(restaurant: RestaurantDto) {
    setEditing(restaurant);
    setForm({
      name: restaurant.name,
      code: restaurant.code,
      address: restaurant.address ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const result = editing
        ? await updateRestaurant(editing.id, form)
        : await createRestaurant(form);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar el restaurante.");
        return;
      }
      toast.success(editing ? "Restaurante actualizado." : "Restaurante creado.");
      setDialogOpen(false);
      window.location.reload();
    });
  }

  function handleToggle(restaurant: RestaurantDto) {
    startSubmit(async () => {
      const result = await toggleRestaurantActive({
        id: restaurant.id,
        active: !restaurant.active,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo actualizar el estado.");
        return;
      }
      toast.success(restaurant.active ? "Restaurante desactivado." : "Restaurante activado.");
      window.location.reload();
    });
  }

  const normalized = query.trim().toLowerCase();
  const filtered = initial.filter((r) => {
    const matchesQuery =
      !normalized ||
      r.name.toLowerCase().includes(normalized) ||
      r.code.toLowerCase().includes(normalized) ||
      (r.address ?? "").toLowerCase().includes(normalized);
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && r.active) ||
      (filter === "inactive" && !r.active);
    return matchesQuery && matchesFilter;
  });

  const counts = {
    total: initial.length,
    active: initial.filter((r) => r.active).length,
    inactive: initial.filter((r) => !r.active).length,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Restaurantes</CardTitle>
            <CardDescription>
              Administra las unidades de negocio de Grupo Comidas.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>Nuevo restaurante</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Buscar por nombre, código o dirección…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {(["all", "active", "inactive"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={filter === key ? "font-semibold text-foreground" : "hover:text-foreground"}
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
                  <th className="px-4 py-2 text-left font-medium">Código</th>
                  <th className="px-4 py-2 text-left font-medium">Dirección</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-left font-medium">Creado</th>
                  <th className="px-4 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No hay restaurantes que coincidan.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">
                      <RestaurantIdentity restaurant={r} size="sm" showSector />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.address ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={r.active ? "default" : "secondary"}>
                        {r.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                          Editar
                        </Button>
                        <Button
                          variant={r.active ? "secondary" : "outline"}
                          size="sm"
                          disabled={submitting}
                          onClick={() => handleToggle(r)}
                        >
                          {r.active ? "Desactivar" : "Activar"}
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
              {editing ? "Editar restaurante" : "Nuevo restaurante"}
            </DialogTitle>
            <DialogDescription>
              Los restaurantes permiten asociar equipos, solicitudes y usuarios.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant-name">Nombre</Label>
              <Input
                id="restaurant-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Sucursal Centro"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-code">Código</Label>
              <Input
                id="restaurant-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Ej. CENTRO01"
                maxLength={20}
                className="font-mono uppercase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-address">Dirección</Label>
              <Textarea
                id="restaurant-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Opcional"
                maxLength={250}
                rows={2}
              />
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