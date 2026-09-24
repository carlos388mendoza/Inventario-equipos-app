"use client";

import * as React from "react";
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
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import { LabelPreview } from "@/components/labels/label-preview";
import { formatDate } from "@/lib/utils";

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
  const [submitting, startSubmit] = useTransition();

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
      window.location.reload();
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
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
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
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Aún no hay etiquetas generadas.
                    </td>
                  </tr>
                )}
                {initial.map((l) => (
                  <tr key={l.id} className="border-t">
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
          if (!open) window.location.reload();
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
              <div className="flex justify-end gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={result.url} target="_blank" rel="noreferrer">
                    Abrir página pública
                  </a>
                </Button>
                <Button
                  type="button"
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
    </div>
  );
}