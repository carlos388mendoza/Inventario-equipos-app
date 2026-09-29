"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  generateSecurityLabel,
  type GenerateLabelResult,
} from "@/app/(dashboard)/labels/actions";
import type {
  LabelDto,
  LabelEquipmentOption,
  LabelRestaurantOption,
} from "@/app/(dashboard)/labels/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import { LabelPreview } from "@/components/labels/label-preview";
import { PrintPanel, type LabelPrintData } from "@/components/labels/print-panel";
import { PrintQueue } from "@/components/labels/print-queue";
import { useMutationSync } from "@/lib/sync/use-tab-sync";
import { formatDate } from "@/lib/utils";

function toPrintData(input: {
  url: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantSector?: string | null;
  restaurantLogo: string | null;
  installationDate?: string | Date | null;
  createdAt: string | Date;
}): LabelPrintData {
  return {
    url: input.url,
    assetCode: input.assetCode,
    typeName: input.typeName,
    restaurantName: input.restaurantName,
    restaurantSector: input.restaurantSector,
    restaurantLogo: input.restaurantLogo,
    installationDate: input.installationDate,
    createdAt: input.createdAt,
  };
}

export function LabelsManager({
  labels: initial,
  restaurantOptions,
  equipmentOptions,
}: {
  labels: LabelDto[];
  restaurantOptions: LabelRestaurantOption[];
  equipmentOptions: LabelEquipmentOption[];
}) {
  const [restaurantId, setRestaurantId] = React.useState("");
  const [equipmentId, setEquipmentId] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [result, setResult] = React.useState<GenerateLabelResult | null>(null);
  const [rowToPrint, setRowToPrint] = React.useState<LabelPrintData | null>(
    null
  );
  // Selección para imprimir en lote. Guarda ids, no objetos: así un refresh del
  // router no puede dejar seleccionados datos viejos.
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [queueOpen, setQueueOpen] = React.useState(false);

  const [submitting, startSubmit] = useTransition();
  const router = useRouter();
  const { refreshAndBroadcast, broadcastOnly } = useMutationSync();

  // El orden enviado es el orden de la tabla, no el de los clics.
  const queuedLabels = React.useMemo(
    () => initial.filter((l) => selectedIds.has(l.id)).map(toPrintData),
    [initial, selectedIds]
  );
  const allSelected = initial.length > 0 && selectedIds.size === initial.length;

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) =>
      current.size === initial.length ? new Set() : new Set(initial.map((l) => l.id))
    );
  }


  const candidateEquipment = equipmentOptions.filter(
    (e) => !restaurantId || e.restaurantId === restaurantId
  );

  function openDialog() {
    setRestaurantId("");
    setEquipmentId("");
    setResult(null);
    setDialogOpen(true);
  }

  function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const res = await generateSecurityLabel({ equipmentId });
      setResult(res);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo generar la etiqueta.");
        return;
      }
      toast.success("Etiqueta generada.");
      // La server action ya devuelve el RSC actualizado de esta ruta, así que
      // aquí solo se avisa al resto de pestañas. El contador de "Etiquetas QR"
      // del panel se actualiza sin F5.
      broadcastOnly();
    });
  }

  function handleRegenerate(label: LabelDto) {
    startSubmit(async () => {
      const res = await generateSecurityLabel({
        equipmentId: label.equipmentId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo regenerar la etiqueta.");
        return;
      }
      toast.success("Etiqueta regenerada.");
      refreshAndBroadcast();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Etiquetas de seguridad / QR</CardTitle>
            <CardDescription>
              {initial.length} etiqueta(s) generada(s). El QR enlaza a una
              página pública con los datos del equipo.
            </CardDescription>
          </div>
          <Button onClick={openDialog}>Generar etiqueta</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
              disabled={initial.length === 0}
            >
              {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
            </Button>
            <Button
              size="sm"
              onClick={() => setQueueOpen(true)}
              disabled={selectedIds.size === 0}
            >
              <Printer />
              {selectedIds.size === 0
                ? "Imprimir seleccionadas"
                : `Imprimir ${selectedIds.size} etiqueta(s)`}
            </Button>
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} de {initial.length} seleccionada(s)
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-2 text-left font-medium">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las etiquetas"
                      className="h-4 w-4 accent-primary"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Equipo</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Restaurante
                  </th>
                  <th className="px-4 py-2 text-left font-medium">QR</th>
                  <th className="px-4 py-2 text-left font-medium">Generada</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {initial.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Aún no hay etiquetas generadas.
                    </td>
                  </tr>
                )}
                {initial.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        aria-label={`Seleccionar la etiqueta de ${l.assetCode}`}
                        checked={selectedIds.has(l.id)}
                        onChange={() => toggleOne(l.id)}
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs font-medium">
                      {l.assetCode}
                    </td>
                    <td className="px-4 py-2">{l.typeName}</td>
                    <td className="px-4 py-2">
                      <RestaurantIdentity
                        restaurant={{
                          name: l.restaurantName,
                          brand: l.restaurantBrand,
                          sector: l.restaurantSector,
                          logo: l.restaurantLogo,
                        }}
                        size="sm"
                        showSector={false}
                      />
                    </td>
                    <td className="px-4 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={l.qrDataUrl}
                        alt={`QR de ${l.assetCode}`}
                        className="h-12 w-12 rounded border"
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(l.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={l.url} target="_blank" rel="noreferrer">
                            Página pública
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRowToPrint(toPrintData(l))}
                        >
                          <Printer />
                          Imprimir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={submitting}
                          onClick={() => handleRegenerate(l)}
                        >
                          Regenerar
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) router.refresh();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar etiqueta de seguridad</DialogTitle>
            <DialogDescription>
              El QR se genera con la URL pública del equipo y no contiene datos
              sensibles.
            </DialogDescription>
          </DialogHeader>
          {!result?.ok && (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label>Restaurante</Label>
                <Select value={restaurantId} onValueChange={setRestaurantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un restaurante" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurantOptions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Equipo</Label>
                <Select
                  value={equipmentId}
                  onValueChange={setEquipmentId}
                  disabled={candidateEquipment.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        candidateEquipment.length === 0
                          ? "Selecciona primero un restaurante"
                          : "Selecciona el equipo"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateEquipment.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.assetCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || !equipmentId}>
                  {submitting ? "Generando…" : "Generar"}
                </Button>
              </div>
            </form>
          )}

          {result?.ok && (
            <div className="space-y-4">
              <LabelPreview
                data={{
                  qrDataUrl: result.qrDataUrl,
                  assetCode: result.assetCode,
                  typeName: result.typeName,
                  restaurantName: result.restaurantName,
                  restaurantLogo: result.restaurantLogo,
                  installationDate: result.installationDate,
                  createdAt: result.createdAt,
                }}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={result.url} target="_blank" rel="noreferrer">
                    Abrir página pública
                  </a>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setRowToPrint(toPrintData(result))}
                >
                  <Printer />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={rowToPrint !== null}
        onOpenChange={(open) => {
          if (!open) setRowToPrint(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir etiqueta</DialogTitle>
            <DialogDescription>
              Envía el ZPL de {rowToPrint?.assetCode ?? ""} a la Zebra ZD230 a
              través de Zebra Browser Print. No se imprime automáticamente.
            </DialogDescription>
          </DialogHeader>
          {rowToPrint && <PrintPanel label={rowToPrint} />}
        </DialogContent>
      </Dialog>

      <Dialog
        open={queueOpen}
        onOpenChange={(open) => {
          setQueueOpen(open);
          // Al cerrar se descarta la selección: evita reimprimir por accidente
          // el mismo lote en la siguiente operación.
          if (!open) setSelectedIds(new Set());
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir varias etiquetas</DialogTitle>
            <DialogDescription>
              Se enviarán {queuedLabels.length} etiqueta(s) a la Zebra ZD230 a
              través de Zebra Browser Print, en el orden de la tabla. Cada
              etiqueta conserva su propio QR. El envío no es automático: revisa
              el progreso antes de cerrar.
            </DialogDescription>
          </DialogHeader>
          {queueOpen && <PrintQueue labels={queuedLabels} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}