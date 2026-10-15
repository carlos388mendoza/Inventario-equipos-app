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
  ALL_REQUEST_PRIORITY,
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  formatDestinationArea,
  type RequestStatus,
} from "@/lib/db/enums";
import { useMutationSync } from "@/lib/sync/use-tab-sync";
import { Combobox } from "@/components/ui/combobox";
import { SortableHeader, useTableSort } from "@/components/ui/sortable";
import { formatDateTime } from "@/lib/utils";

const PRIORITY_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

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
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [priorityFilter, setPriorityFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [statusTarget, setStatusTarget] = React.useState<RequestDto | null>(
    null
  );
  const [newStatus, setNewStatus] = React.useState<RequestStatus | "">("");
  const [comment, setComment] = React.useState("");

const [submitting, startSubmit] = useTransition();
  const { refreshAndBroadcast } = useMutationSync();
  const { sort, toggle, sortRows } = useTableSort();

  const isGlobalFilter = restaurantOptions.length > 1;

  const normalized = query.trim().toLowerCase();
  // Límites de fecha (día completo) para el filtro por rango de creación.
  const fromTime = dateFrom
    ? new Date(`${dateFrom}T00:00:00`).getTime()
    : null;
  const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
  const filtered = requests.filter((r) => {
    const isActive = ACTIVE_REQUEST_STATUS.includes(r.status);
    const matchesTab =
      tab === "active" ? isActive : CLOSED_REQUEST_STATUS.includes(r.status);
    const matchesRestaurant =
      restaurantId === "ALL" || r.restaurantId === restaurantId;
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchesPriority =
      priorityFilter === "ALL" || r.priority === priorityFilter;
    const matchesType = typeFilter === "ALL" || r.equipmentTypeId === typeFilter;
    const createdTime = new Date(r.createdAt).getTime();
    const matchesFrom = fromTime === null || createdTime >= fromTime;
    const matchesTo = toTime === null || createdTime <= toTime;
    const matchesQuery =
      !normalized ||
      [r.equipmentTypeName, r.restaurantName, r.requestedByName, r.reason]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(normalized));
    return (
      matchesTab &&
      matchesRestaurant &&
      matchesStatus &&
      matchesPriority &&
      matchesType &&
      matchesFrom &&
      matchesTo &&
      matchesQuery
    );
  });

  const hasExtraFilters =
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearExtraFilters() {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setTypeFilter("ALL");
    setDateFrom("");
    setDateTo("");
  }

  const sorted = React.useMemo(
    () =>
      sortRows(filtered, (r, key) => {
        switch (key) {
          case "date":
            return r.createdAt;
          case "type":
            return r.equipmentTypeName;
          case "restaurant":
            return r.restaurantName;
          case "priority":
            return PRIORITY_RANK[r.priority] ?? 0;
          case "status":
            return r.status;
          case "requester":
            return r.requestedByName;
          default:
            return null;
        }
      }),
    [filtered, sortRows]
  );

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
      refreshAndBroadcast();
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
              <Combobox
                value={restaurantId}
                onValueChange={setRestaurantId}
                placeholder="Restaurante"
                searchPlaceholder="Buscar restaurante…"
                className="sm:max-w-[220px]"
                options={[
                  { value: "ALL", label: "Todos los restaurantes" },
                  ...restaurantOptions.map((r) => ({
                    value: r.id,
                    label: r.name,
                    detail: r.code,
                  })),
                ]}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px]" aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {ALL_REQUEST_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {REQUEST_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger
                className="w-[180px]"
                aria-label="Filtrar por prioridad"
              >
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las prioridades</SelectItem>
                {ALL_REQUEST_PRIORITY.map((p) => (
                  <SelectItem key={p} value={p}>
                    {REQUEST_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="w-[200px]"
                aria-label="Filtrar por tipo de equipo"
              >
                <SelectValue placeholder="Tipo de equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {typeOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Creadas desde"
                className="w-full sm:w-[160px]"
              />
              <span className="hidden text-muted-foreground sm:inline">–</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Creadas hasta"
                className="w-full sm:w-[160px]"
              />
            </div>
            {hasExtraFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearExtraFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
<tr>
                  <SortableHeader
                    label="Fecha"
                    sortKey="date"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Tipo"
                    sortKey="type"
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
                    label="Prioridad"
                    sortKey="priority"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Estado"
                    sortKey="status"
                    sort={sort}
                    onToggle={toggle}
                  />
<SortableHeader
                    label="Solicitante"
                    sortKey="requester"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <th className="px-4 py-2 font-medium">Área</th>
                  <th className="px-4 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No hay solicitudes que coincidan.
                    </td>
                  </tr>
                )}
                {sorted.map((r) => (
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
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDestinationArea(r.destinationArea)}
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

          <ul className="space-y-3 md:hidden">
            {sorted.length === 0 && (
              <li className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
                No hay solicitudes que coincidan.
              </li>
            )}
            {sorted.map((r) => (
              <li key={r.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.equipmentTypeName}</p>
                    {r.currentEquipmentAssetCode && (
                      <p className="text-xs text-muted-foreground">
                        Reemplazo de {r.currentEquipmentAssetCode}
                      </p>
                    )}
                  </div>
                  <Badge variant={statusBadgeVariant(r.status)}>
                    {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{formatDateTime(r.createdAt)}</span>
                  <span>
                    {REQUEST_PRIORITY_LABELS[r.priority] ?? r.priority}
                  </span>
                </div>
                <div className="mt-2">
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
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt>Solicitante</dt>
                    <dd className="truncate text-foreground">
                      {r.requestedByName}
                    </dd>
                  </div>
                  <div>
                    <dt>Área</dt>
                    <dd className="truncate text-foreground">
                      {formatDestinationArea(r.destinationArea)}
                    </dd>
                  </div>
                </dl>
                {isManager && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => openStatusChange(r)}
                  >
                    Cambiar estado
                  </Button>
                )}
              </li>
            ))}
          </ul>
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
              refreshAndBroadcast();
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
