"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { changeRequestStatus } from "@/app/(dashboard)/requests/actions";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import type {
  EquipmentSelectOption,
  RequestDto,
  RestaurantSelectOption,
} from "@/app/(dashboard)/requests/types";
import { RequestForm } from "@/components/requests/request-form";
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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVE_REQUEST_STATUS,
  CLOSED_REQUEST_STATUS,
  ALL_REQUEST_STATUS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  type RequestStatus,
} from "@/lib/db/enums";
import { formatDateTime } from "@/lib/utils";

function statusBadgeVariant(status: RequestStatus) {
  switch (status) {
    case "REJECTED":
      return "destructive" as const;
    case "PENDING":
    case "CANCELLED":
      return "secondary" as const;
    default:
      return "default" as const;
  }
}

export function RequestManager({
  requests,
  isManager,
  currentRestaurantId,
  restaurantOptions,
  typeOptions,
  equipmentOptions,
}: {
  requests: RequestDto[];
  isManager: boolean;
  currentRestaurantId?: string;
  restaurantOptions: RestaurantSelectOption[];
  typeOptions: { id: string; name: string }[];
  equipmentOptions: EquipmentSelectOption[];
}) {
  const [tab, setTab] = React.useState<"active" | "history">("active");
  const [query, setQuery] = React.useState("");
  const [restaurantId, setRestaurantId] = React.useState("ALL");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [statusTarget, setStatusTarget] = React.useState<RequestDto | null>(
    null
  );
  const [newStatus, setNewStatus] = React.useState<RequestStatus | "">("");
  const [comment, setComment] = React.useState("");
  const [submitting, startSubmit] = useTransition();

  const isGlobalFilter = restaurantOptions.length > 1;

  const normalized = query.trim().toLowerCase();
  const filtered = requests.filter((r) => {
    const isActive = ACTIVE_REQUEST_STATUS.includes(r.status);
    const matchesTab =
      tab === "active" ? isActive : CLOSED_REQUEST_STATUS.includes(r.status);
    const matchesRestaurant =
      restaurantId === "ALL" || r.restaurantId === restaurantId;
    const matchesQuery =
      !normalized ||
      [r.equipmentTypeName, r.restaurantName, r.requestedByName, r.reason]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(normalized));
    return matchesTab && matchesRestaurant && matchesQuery;
  });

  function openStatusChange(r: RequestDto) {
    setStatusTarget(r);
    setNewStatus("");
    setComment("");
  }

  function handleStatusChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!statusTarget) return;
    startSubmit(async () => {
      const result = await changeRequestStatus({
        id: statusTarget.id,
        newStatus,
        comment,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo cambiar el estado.");
        return;
      }
      toast.success("Estado actualizado.");
      setStatusTarget(null);
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Solicitudes de equipos</CardTitle>
            <CardDescription>
              {requests.length} solicitud(es) registrada(s) en el sistema.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Nueva solicitud</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={
                  tab === "active"
                    ? "font-semibold text-foreground"
                    : "hover:text-foreground"
                }
              >
                Activas
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => setTab("history")}
                className={
                  tab === "history"
                    ? "font-semibold text-foreground"
                    : "hover:text-foreground"
                }
              >
                Históricas
              </button>
            </div>
            <Input
              placeholder="Buscar por tipo, restaurante, solicitante o motivo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-xs"
            />
            {isGlobalFilter && (
              <Select value={restaurantId} onValueChange={setRestaurantId}>
                <SelectTrigger className="sm:max-w-[220px]">
                  <SelectValue placeholder="Restaurante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los restaurantes</SelectItem>
                  {restaurantOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Restaurante</th>
                  <th className="px-4 py-2 text-left font-medium">Prioridad</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-left font-medium">Solicitante</th>
                  <th className="px-4 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No hay solicitudes que coincidan.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {r.equipmentTypeName}
                      {r.currentEquipmentAssetCode && (
                        <span className="block text-xs text-muted-foreground">
                          Reemplazo de {r.currentEquipmentAssetCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <RestaurantIdentity
                        restaurant={{
                          name: r.restaurantName,
                          brand: r.restaurantBrand,
                          sector: r.restaurantSector,
                          logo: r.restaurantLogo,
                        }}
                        size="sm"
                        showSector={false}
                      />
                    </td>
                    <td className="px-4 py-2">
                      {REQUEST_PRIORITY_LABELS[r.priority] ?? r.priority}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={statusBadgeVariant(r.status)}>
                        {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.requestedByName}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isManager && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStatusChange(r)}
                        >
                          Cambiar estado
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de equipo</DialogTitle>
            <DialogDescription>
              La solicitud quedará registrada como pendiente para su revisión.
            </DialogDescription>
          </DialogHeader>
          <RequestForm
            restaurantOptions={restaurantOptions}
            typeOptions={typeOptions}
            equipmentOptions={equipmentOptions}
            currentRestaurantId={currentRestaurantId}
            onDone={() => {
              setCreateOpen(false);
              window.location.reload();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado de la solicitud</DialogTitle>
            <DialogDescription>
              El cambio de estado quedará registrado en el historial.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStatusChange} className="space-y-4">
            <div className="space-y-2">
              <Label>Nuevo estado</Label>
              <Select
                value={newStatus}
                onValueChange={(v) => setNewStatus(v as RequestStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_REQUEST_STATUS.filter(
                    (s) => s !== statusTarget?.status
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {REQUEST_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-status-comment">Comentario (opcional)</Label>
              <Textarea
                id="req-status-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ej. Aprobada, se gestiona la compra."
                maxLength={1000}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusTarget(null)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || newStatus === ""}
              >
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}