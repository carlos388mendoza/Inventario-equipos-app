"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  createEquipment,
  updateEquipment,
} from "@/app/(dashboard)/equipment/actions";
import { Button } from "@/components/ui/button";
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

interface Option {
  id: string;
  name: string;
  code?: string;
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function EquipmentForm({
  restaurantOptions,
  typeOptions,
  initial,
  equipmentId,
}: {
  restaurantOptions: Option[];
  typeOptions: Option[];
  initial?: {
    assetCode: string;
    serialNumber: string | null;
    equipmentTypeId: string;
    restaurantId: string;
    brand: string | null;
    model: string | null;
    purchaseDate: Date | null;
    installationDate: Date | null;
    notes: string | null;
  };
  equipmentId?: string;
}) {
  const router = useRouter();
  const [submitting, startSubmit] = useTransition();

  const [form, setForm] = React.useState({
    assetCode: initial?.assetCode ?? "",
    serialNumber: initial?.serialNumber ?? "",
    equipmentTypeId: initial?.equipmentTypeId ?? "",
    restaurantId: initial?.restaurantId ?? "",
    brand: initial?.brand ?? "",
    model: initial?.model ?? "",
    purchaseDate: toDateInputValue(initial?.purchaseDate ?? null),
    installationDate: toDateInputValue(initial?.installationDate ?? null),
    notes: initial?.notes ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const payload = {
        assetCode: form.assetCode,
        serialNumber: form.serialNumber,
        equipmentTypeId: form.equipmentTypeId,
        restaurantId: form.restaurantId,
        brand: form.brand,
        model: form.model,
        purchaseDate: form.purchaseDate,
        installationDate: form.installationDate,
        notes: form.notes,
      };
      const result = equipmentId
        ? await updateEquipment(equipmentId, payload)
        : await createEquipment(payload);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar el equipo.");
        return;
      }
      toast.success(equipmentId ? "Equipo actualizado." : "Equipo registrado.");
      router.push(
        equipmentId ? `/equipment/${equipmentId}` : "/equipment"
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="eq-asset">Código de activo</Label>
          <Input
            id="eq-asset"
            value={form.assetCode}
            onChange={(e) => set("assetCode", e.target.value.toUpperCase())}
            placeholder="Ej. TV-CENTRO-001"
            className="font-mono uppercase"
            maxLength={40}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eq-serial">Número de serie</Label>
          <Input
            id="eq-serial"
            value={form.serialNumber}
            onChange={(e) => set("serialNumber", e.target.value)}
            placeholder="Opcional"
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de equipo</Label>
          <Select
            value={form.equipmentTypeId}
            onValueChange={(v) => set("equipmentTypeId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Restaurante</Label>
          <Select
            value={form.restaurantId}
            onValueChange={(v) => set("restaurantId", v)}
          >
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
          <Label htmlFor="eq-brand">Marca</Label>
          <Input
            id="eq-brand"
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="Opcional"
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eq-model">Modelo</Label>
          <Input
            id="eq-model"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="Opcional"
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eq-purchase">Fecha de compra</Label>
          <Input
            id="eq-purchase"
            type="date"
            value={form.purchaseDate}
            onChange={(e) => set("purchaseDate", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eq-install">Fecha de instalación</Label>
          <Input
            id="eq-install"
            type="date"
            value={form.installationDate}
            onChange={(e) => set("installationDate", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="eq-notes">Notas</Label>
        <Textarea
          id="eq-notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Opcional"
          maxLength={1000}
          rows={3}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : equipmentId ? "Actualizar equipo" : "Registrar equipo"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}