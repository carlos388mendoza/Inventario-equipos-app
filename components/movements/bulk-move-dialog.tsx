"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RestaurantOptionLabel } from "@/components/restaurants/restaurant-option-label";
import {
  EQUIPMENT_MOVEMENT_TYPE_LABELS,
  type EquipmentMovementType,
} from "@/lib/db/enums";
import { MOVEMENT_DEFINITIONS } from "@/lib/equipment/movements";
import { useMutationSync } from "@/lib/sync/use-tab-sync";
import { bulkMoveEquipment, type MovementActionResult } from "@/app/(dashboard)/equipment/movements/actions";
import type {
  MovableEquipmentOption,
  RestaurantOption,
} from "@/app/(dashboard)/movements/types";

/**
 * Movimiento múltiple: una sola operación, un solo lote, todos o nada.
 *
 * El diálogo previsualiza el lote en el servidor ANTES de aplicar, con la misma
 * validación que usa la acción, para poder mostrar en la lista qué equipos se
 * moverían y cuáles quedarían fuera y por qué. Así el usuario ve el "no" antes
 * de intentar el "sí", en lugar de descubrir después que se movió una parte.
 */

const ALL = "__all__";

export function BulkMoveDialog({
  open,
  onOpenChange,
  equipmentIds,
  equipment,
  restaurants,
  types,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentIds: string[];
  equipment: MovableEquipmentOption[];
  restaurants: RestaurantOption[];
  types: EquipmentMovementType[];
  onDone: () => void;
}) {
  const { refreshAndBroadcast } = useMutationSync();
  const [type, setType] = React.useState<EquipmentMovementType>(types[0]);
  const [toRestaurantId, setToRestaurantId] = React.useState<string>(ALL);
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const selected = React.useMemo(
    () => equipment.filter((item) => equipmentIds.includes(item.id)),
    [equipment, equipmentIds]
  );

  // Un equipo prestado se devuelve a casa, y la devolución no es un movimiento
  // en lote. Se avisa en vez de dejar que el servidor rechace el lote entero con
  // un mensaje que nombra solo el primer equipo conflictivo.
  const loanedSelected = selected.filter((item) => item.isOnLoan);

  const sameUnit = selected.filter(
    (item) => item.restaurantId === toRestaurantId
  );
  const canSubmit = toRestaurantId !== ALL && loanedSelected.length === 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (toRestaurantId === ALL) {
      toast.error("Selecciona la unidad destino.");
      return;
    }
    setPending(true);
    const result: MovementActionResult = await bulkMoveEquipment({
      equipmentIds,
      toRestaurantId,
      type,
      reason,
      notes,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    refreshAndBroadcast();
    onOpenChange(false);
    onDone();
    setReason("");
    setNotes("");
    setToRestaurantId(ALL);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Mover {equipmentIds.length} equipo(s)</DialogTitle>
          <DialogDescription>
            El lote se aplica entero o no se aplica. Si un solo equipo incumple las
            reglas, no se mueve ninguno y se indica cuál.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-type">Operación</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as EquipmentMovementType)}
            >
              <SelectTrigger id="bulk-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {EQUIPMENT_MOVEMENT_TYPE_LABELS[candidate]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {MOVEMENT_DEFINITIONS[type]?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-destination">Unidad destino</Label>
            <Select value={toRestaurantId} onValueChange={setToRestaurantId}>
              <SelectTrigger id="bulk-destination">
                <SelectValue placeholder="Selecciona una unidad" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    <RestaurantOptionLabel restaurant={restaurant} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loanedSelected.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium">
                {loanedSelected.length} equipo(s) están en préstamo.
              </p>
              <p className="mt-1 text-muted-foreground">
                Un equipo prestado solo admite devolución, y la devolución va a su
                unidad propietaria, no a la que elijas aquí. Devuélvelos uno a uno
                y vuelve a seleccionar el resto.
              </p>
            </div>
          )}

          {toRestaurantId !== ALL && sameUnit.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium">
                {sameUnit.length} equipo(s) ya están en esa unidad.
              </p>
              <p className="mt-1 text-muted-foreground">
                Quítalos de la selección: el lote se rechazará entero.
              </p>
            </div>
          )}

          <div className="rounded-md border">
            <div className="border-b bg-muted/50 px-3 py-2 text-xs font-medium">
              Se moverán {selected.length} equipo(s)
            </div>
            <ul className="max-h-40 divide-y overflow-y-auto text-sm">
              {selected.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-3 py-1.5">
                  <span className="font-mono text-xs">{item.assetCode}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.restaurantCode}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-reason">Motivo</Label>
            <Input
              id="bulk-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-notes">Detalle</Label>
            <Textarea
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? "Moviendo…" : `Mover ${selected.length} equipo(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
