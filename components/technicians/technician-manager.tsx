"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { setTechnicianAssignmentsAction } from "@/app/(dashboard)/users/actions";
import type {
  RestaurantOptionDto,
  TechnicianDto,
} from "@/app/(dashboard)/technicians/types";
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
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { AssignedRestaurantsSummary } from "@/components/restaurants/assigned-restaurants-summary";
import { ROLE_LABELS } from "@/lib/db/enums";
import { useMutationSync } from "@/lib/sync/use-tab-sync";

export function TechnicianManager({
  technicians,
  restaurants,
  currentUserId,
  canEditSelf,
}: {
  technicians: TechnicianDto[];
  restaurants: RestaurantOptionDto[];
  currentUserId: string;
  /**
   * Si el usuario actual puede editar sus PROPIAS asignaciones. Lo tienen el
   * administrador y, desde el issue #18, el jefe de técnicos.
   */
  canEditSelf: boolean;
}) {
  const [editing, setEditing] = React.useState<TechnicianDto | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [submitting, startSubmit] = useTransition();
  const { refreshAndBroadcast } = useMutationSync();

  const restaurantNameById = new Map(restaurants.map((r) => [r.id, r.name]));

  function openEdit(technician: TechnicianDto) {
    setEditing(technician);
    setSelected([...technician.assignedRestaurantIds]);
  }

  function save() {
    if (!editing) return;
    startSubmit(async () => {
      const result = await setTechnicianAssignmentsAction({
        userId: editing.id,
        restaurantIds: selected,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudieron guardar las asignaciones.");
        return;
      }
      toast.success("Asignaciones actualizadas.");
      setEditing(null);
      refreshAndBroadcast();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Técnicos y jefes de técnicos</CardTitle>
          <CardDescription>
            {canEditSelf
              ? "Asigna los restaurantes que cada técnico debe atender."
              : "Asigna los restaurantes que cada técnico debe atender. No puedes editar tus propias asignaciones."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {technicians.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay técnicos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nombre</th>
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-left font-medium">Rol</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Restaurantes asignados
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {technicians.map((t) => {
                    const own = t.id === currentUserId;
                    const lock = own && !canEditSelf;
                    return (
                      <tr key={t.id} className="border-t">
                        <td className="px-4 py-2 font-medium">
                          {t.name}
                          {own && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (tú)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {t.email}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">
                            {ROLE_LABELS[t.role as keyof typeof ROLE_LABELS] ??
                              t.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          <AssignedRestaurantsSummary
                            names={t.assignedRestaurantIds.map(
                              (id) => restaurantNameById.get(id) ?? id
                            )}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          {lock ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(t)}
                            >
                              Editar asignaciones
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Asignaciones de {editing?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Marca los restaurantes que este técnico puede atender.
            </p>
            <MultiSelect
              options={restaurants.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.code})`,
              }))}
              selected={selected}
              onChange={setSelected}
              placeholder="Selecciona restaurantes"
              searchPlaceholder="Buscar restaurante…"
              emptyLabel="No hay restaurantes activos."
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={save} disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}