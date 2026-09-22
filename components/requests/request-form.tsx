"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { createRequest } from "@/app/(dashboard)/requests/actions";
import {
  REQUEST_KINDS,
  REQUEST_KIND_LABELS,
  type RequestKind,
} from "@/lib/validation/requests";
import { ALL_REQUEST_PRIORITY, REQUEST_PRIORITY_LABELS } from "@/lib/db/enums";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EquipmentSelectOption,
  RestaurantSelectOption,
} from "@/app/(dashboard)/requests/types";

interface TypeOption {
  id: string;
  name: string;
}

export function RequestForm({
  restaurantOptions,
  typeOptions,
  equipmentOptions,
  currentRestaurantId,
  onDone,
}: {
  restaurantOptions: RestaurantSelectOption[];
  typeOptions: TypeOption[];
  equipmentOptions: EquipmentSelectOption[];
  currentRestaurantId?: string;
  onDone: () => void;
}) {
  const [submitting, startSubmit] = useTransition();

  const [restaurantId, setRestaurantId] = React.useState(
    currentRestaurantId ?? ""
  );
  const [equipmentTypeId, setEquipmentTypeId] = React.useState("");
  const [kind, setKind] = React.useState<RequestKind>("purchase");
  const [currentEquipmentId, setCurrentEquipmentId] = React.useState("");
  const [priority, setPriority] = React.useState("NORMAL");
  const [reason, setReason] = React.useState("");
  const [description, setDescription] = React.useState("");

  const restaurantLocked = Boolean(currentRestaurantId);

  const candidateEquipment = equipmentOptions.filter((e) => {
    const sameRestaurant = !restaurantId || e.restaurantId === restaurantId;
    const sameType = !equipmentTypeId || e.equipmentTypeId === equipmentTypeId;
    return sameRestaurant && sameType;
  });

  function resetForm() {
    setRestaurantId(currentRestaurantId ?? "");
    setEquipmentTypeId("");
    setKind("purchase");
    setCurrentEquipmentId("");
    setPriority("NORMAL");
    setReason("");
    setDescription("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSubmit(async () => {
      const result = await createRequest({
        equipmentTypeId,
        priority,
        kind,
        currentEquipmentId: currentEquipmentId || "",
        reason,
        description,
        restaurantId: restaurantLocked ? "" : restaurantId,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo crear la solicitud.");
        return;
      }
      toast.success("Solicitud creada.");
      resetForm();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de equipo</Label>
          <Select value={equipmentTypeId} onValueChange={setEquipmentTypeId}>
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

        {!restaurantLocked && (
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
        )}

        <div className="space-y-2">
          <Label>Tipo de solicitud</Label>
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as RequestKind);
              setCurrentEquipmentId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Compra o reemplazo" />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {REQUEST_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Prioridad</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              {ALL_REQUEST_PRIORITY.map((p) => (
                <SelectItem key={p} value={p}>
                  {REQUEST_PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "replacement" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Equipo a reemplazar</Label>
            <Select
              value={currentEquipmentId}
              onValueChange={setCurrentEquipmentId}
              disabled={candidateEquipment.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    candidateEquipment.length === 0
                      ? "Selecciona primero restaurante y tipo"
                      : "Selecciona el equipo actual"
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
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="req-reason">Motivo</Label>
        <Textarea
          id="req-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. El equipo ya no enciende y requiere reemplazo."
          maxLength={500}
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="req-description">Descripción (opcional)</Label>
        <Textarea
          id="req-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalles adicionales que ayuden a evaluar la solicitud."
          maxLength={2000}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enviando…" : "Crear solicitud"}
        </Button>
      </div>
    </form>
  );
}