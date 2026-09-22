"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  createEquipmentType,
  toggleEquipmentTypeActive,
  updateEquipmentType,
} from "@/app/(dashboard)/equipment-types/actions";
import type { EquipmentTypeDto } from "@/app/(dashboard)/equipment-types/types";
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

const EMPTY_FORM = { name: "", description: "", usefulLifeMonths: 36 };

export function EquipmentTypeManager({
  equipmentTypes: initial,
}: {
  equipmentTypes: EquipmentTypeDto[];
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "active" | "inactive">(
    "all"
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EquipmentTypeDto | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, startSubmit] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(type: EquipmentTypeDto) {
    setEditing(type);
    setForm({
      name: type.name,
      description: type.description ?? "",
      usefulLifeMonths: type.usefulLifeMonths,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const payload = {
        name: form.name,
        description: form.description,
        usefulLifeMonths: Number(form.usefulLifeMonths),
      };
      const result = editing
        ? await updateEquipmentType(editing.id, payload)
        : await createEquipmentType(payload);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar el tipo de equipo.");
        return;
      }
      toast.success(
        editing ? "Tipo de equipo actualizado." : "Tipo de equipo creado."
      );
      setDialogOpen(false);
      window.location.reload();
    });
  }

  function handleToggle(type: EquipmentTypeDto) {
    startSubmit(async () => {
      const result = await toggleEquipmentTypeActive({
        id: type.id,
        active: !type.active,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo actualizar el estado.");
        return;
      }
      toast.success(
        type.active ? "Tipo desactivado." : "Tipo activado."
      );
      window.location.reload();
    });
  }

  const normalized = query.trim().toLowerCase();
  const filtered = initial.filter((t) => {
    const matchesQuery =
      !normalized ||
      t.name.toLowerCase().includes(normalized) ||
      (t.description ?? "").toLowerCase().includes(normalized);
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && t.active) ||
      (filter === "inactive" && !t.active);
    return matchesQuery && matchesFilter;
  });

  const counts = {
    total: initial.length,
    active: initial.filter((t) => t.active).length,
    inactive: initial.filter((t) => !t.active).length,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Tipos de equipo</CardTitle>
            <CardDescription>
              Catálogo de equipos: televisores, HME, impresoras, tomapedidos, etc.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>Nuevo tipo</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Buscar por nombre o descripción…"
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
                  <th className="px-4 py-2 text-left font-medium">Descripción</th>
                  <th className="px-4 py-2 text-left font-medium">Vida útil</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-left font-medium">Creado</th>
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
                      No hay tipos de equipo que coincidan.
                    </td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {t.description ?? "—"}
                    </td>
                    <td className="px-4 py-2">{t.usefulLifeMonths} meses</td>
                    <td className="px-4 py-2">
                      <Badge variant={t.active ? "default" : "secondary"}>
                        {t.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(t)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant={t.active ? "secondary" : "outline"}
                          size="sm"
                          disabled={submitting}
                          onClick={() => handleToggle(t)}
                        >
                          {t.active ? "Desactivar" : "Activar"}
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
              {editing ? "Editar tipo de equipo" : "Nuevo tipo de equipo"}
            </DialogTitle>
            <DialogDescription>
              La vida útil se usa para calcular el estado del inventario.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="et-name">Nombre</Label>
              <Input
                id="et-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Televisión"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-life">Vida útil (meses)</Label>
              <Input
                id="et-life"
                type="number"
                min={1}
                max={600}
                value={form.usefulLifeMonths}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    usefulLifeMonths: Number(e.target.value),
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-desc">Descripción</Label>
              <Textarea
                id="et-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Opcional"
                maxLength={500}
                rows={3}
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