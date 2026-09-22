"use client";

import * as React from "react";
import { toast } from "sonner";
import { getMyRequestHistory } from "@/app/(dashboard)/my-requests/actions";
import type {
  RequestDto,
  RequestHistoryDto,
} from "@/app/(dashboard)/requests/types";
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
import {
  ACTIVE_REQUEST_STATUS,
  CLOSED_REQUEST_STATUS,
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

export function MyRequestsManager({
  requests,
}: {
  requests: RequestDto[];
}) {
  const [tab, setTab] = React.useState<"active" | "history">("active");
  const [historyFor, setHistoryFor] = React.useState<RequestDto | null>(null);
  const [history, setHistory] = React.useState<RequestHistoryDto[] | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);

  const active = requests.filter((r) =>
    ACTIVE_REQUEST_STATUS.includes(r.status)
  );
  const closed = requests.filter((r) =>
    CLOSED_REQUEST_STATUS.includes(r.status)
  );
  const shown = tab === "active" ? active : closed;

  async function openHistory(r: RequestDto) {
    setHistoryFor(r);
    setHistory(null);
    setLoading(true);
    const result = await getMyRequestHistory(r.id);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error ?? "No se pudo cargar el historial.");
      return;
    }
    setHistory(result.history);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis solicitudes</CardTitle>
        <CardDescription>
          Solicitudes de equipo de tu restaurante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            Activas ({active.length})
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
            Históricas ({closed.length})
          </button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-left font-medium">Prioridad</th>
                <th className="px-4 py-2 text-left font-medium">Estado</th>
                <th className="px-4 py-2 text-left font-medium">Motivo</th>
                <th className="px-4 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No hay solicitudes{" "}
                    {tab === "active" ? "activas" : "históricas"}.
                  </td>
                </tr>
              )}
              {shown.map((r) => (
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
                    {REQUEST_PRIORITY_LABELS[r.priority] ?? r.priority}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={statusBadgeVariant(r.status)}>
                      {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-2 text-muted-foreground">
                    {r.reason}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openHistory(r)}
                    >
                      Ver historial
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog
        open={historyFor !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de la solicitud</DialogTitle>
            <DialogDescription>
              {historyFor
                ? `${historyFor.equipmentTypeName} · ${formatDateTime(
                    historyFor.createdAt
                  )}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {loading && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cargando historial…
            </p>
          )}
          {!loading && history && history.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin cambios de estado registrados.
            </p>
          )}
          {!loading && history && (
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm">
                      {h.oldStatus
                        ? REQUEST_STATUS_LABELS[h.oldStatus] ?? h.oldStatus
                        : "Creada"}{" "}
                      → {REQUEST_STATUS_LABELS[h.newStatus] ?? h.newStatus}
                    </p>
                    {h.comment && (
                      <p className="text-sm text-muted-foreground">
                        {h.comment}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)} · {h.performedByName ?? "Sistema"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}