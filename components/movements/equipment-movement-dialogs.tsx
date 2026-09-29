"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Copy,
  RefreshCcw,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { RestaurantOptionLabel } from "@/components/restaurants/restaurant-option-label";

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
import {
  EQUIPMENT_MOVEMENT_TYPES,
  type EquipmentMovementType,
} from "@/lib/db/enums";
import {
  MOVEMENT_DEFINITIONS,
  effectiveOwnerRestaurantId,
  suggestAssetCode,
} from "@/lib/equipment/movements";
import { useMutationSync } from "@/lib/sync/use-tab-sync";
import {
  copyEquipment,
  moveEquipment,
  replaceEquipment,
  type MovementActionResult,
} from "@/app/(dashboard)/equipment/movements/actions";
import type {
  MovableEquipmentOption,
  RestaurantOption,
} from "@/app/(dashboard)/movements/types";

/**
 * Acciones de movimiento sobre UN equipo.
 *
 * Todas comparten la misma forma: elegir operación, elegir destino, motivo,
 * confirmar. La diferencia entre operaciones la describe `MOVEMENT_DEFINITIONS`,
 * así que añadir un tipo nuevo es añadir una entrada al catálogo y no escribir
 * un diálogo nuevo.
 *
 * Lo que la interfaz NO decide: si un equipo está prestado y puede devolverse,
 * si el código de una copia está libre, si el destino es válido. Eso lo resuelve
 * el servidor. Aquí solo se evita ofrecer una opción que el usuario ya sabe que
 * va a fallar, como elegir la misma unidad de la que parte el equipo.
 */

const ALL = "__all__";

type Operation = "MOVE" | "COPY" | "REPLACE";

/** Operaciones de ubicación que se ofrecen sobre un equipo no prestado. */
const LOCATION_TYPES: EquipmentMovementType[] = [
  EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
  EQUIPMENT_MOVEMENT_TYPES.PULL,
  EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
];

export function EquipmentMovementActions({
  equipment,
  restaurants,
}: {
  equipment: MovableEquipmentOption;
  restaurants: RestaurantOption[];
}) {
  const [operation, setOperation] = React.useState<Operation | null>(null);

  const destinationOptions = React.useMemo(
    () => restaurants.filter((r) => r.id !== equipment.restaurantId),
    [restaurants, equipment.restaurantId]
  );

  const ownerRestaurant = React.useMemo(
    () =>
      restaurants.find((r) => r.id === effectiveOwnerRestaurantId(equipment)) ??
      null,
    [restaurants, equipment]
  );

  return (
    <>
      {equipment.isOnLoan ? (
        <ReturnLoanButton equipment={equipment} ownerName={ownerRestaurant?.name} />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOperation("MOVE")}
          disabled={destinationOptions.length === 0}
          title={
            destinationOptions.length === 0
              ? "No hay otras unidades disponibles"
              : undefined
          }
        >
          <ArrowLeftRight className="h-4 w-4" />
          Mover
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setOperation("COPY")}
        disabled={equipment.isOnLoan}
        title={
          equipment.isOnLoan
            ? "Devuelve el equipo antes de copiarlo"
            : undefined
        }
      >
        <Copy className="h-4 w-4" />
        Copiar
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setOperation("REPLACE")}
        disabled={equipment.isOnLoan}
        title={
          equipment.isOnLoan
            ? "Devuelve el equipo antes de sustituirlo"
            : undefined
        }
      >
        <Repeat2 className="h-4 w-4" />
        Sustituir
      </Button>

      {/* Los diálogos se montan SOLO mientras su operación está activa. Antes se
          renderizaban los tres en cada fila, así que la vista de 81 equipos
          montaba 243 diálogos (y sus hooks) aunque ninguno estuviera abierto:
          eso es lo que hacía costosa cada pulsación de la tabla. Al cerrarse
          desmontan en vez de hacer la animación de salida; la de entrada se
          mantiene. El comportamiento de abrir, enviar y cerrar no cambia. */}
      {operation === "MOVE" && (
        <MoveDialog
          open
          onOpenChange={(open) => {
            if (!open) setOperation(null);
          }}
          equipment={equipment}
          restaurants={destinationOptions}
          ownerRestaurant={ownerRestaurant}
        />
      )}

      {operation === "COPY" && (
        <CreateEquipmentDialog
          open
          onOpenChange={(open) => {
            if (!open) setOperation(null);
          }}
          equipment={equipment}
          restaurants={restaurants}
          type={EQUIPMENT_MOVEMENT_TYPES.COPY}
        />
      )}

      {operation === "REPLACE" && (
        <CreateEquipmentDialog
          open
          onOpenChange={(open) => {
            if (!open) setOperation(null);
          }}
          equipment={equipment}
          restaurants={restaurants}
          type={EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT}
        />
      )}
    </>
  );
}

// ─── Traslado, jalado, préstamo y devolución ─────────────────────────────────

function MoveDialog({
  open,
  onOpenChange,
  equipment,
  restaurants,
  ownerRestaurant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: MovableEquipmentOption;
  restaurants: RestaurantOption[];
  ownerRestaurant: RestaurantOption | null;
}) {
  const { refreshAndBroadcast } = useMutationSync();
  // `typeChoice` es lo que elige el usuario entre operaciones de ubicación. El
  // tipo EFECTIVO se deriva, no se sincroniza: un equipo prestado solo admite la
  // devolución, y eso no depende de ningún clic sino del estado del equipo.
  const [typeChoice, setTypeChoice] = React.useState<EquipmentMovementType>(
    EQUIPMENT_MOVEMENT_TYPES.TRANSFER
  );
  const [toRestaurantId, setToRestaurantId] = React.useState<string>(ALL);
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const type = equipment.isOnLoan
    ? EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN
    : typeChoice;
  const isReturn = type === EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN;
  const effectiveDestination = isReturn
    ? effectiveOwnerRestaurantId(equipment)
    : toRestaurantId === ALL
      ? ""
      : toRestaurantId;

  const definition = MOVEMENT_DEFINITIONS[type];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!effectiveDestination) {
      toast.error("Selecciona la unidad destino.");
      return;
    }
    setPending(true);
    const result: MovementActionResult = await moveEquipment({
      equipmentId: equipment.id,
      toRestaurantId: effectiveDestination,
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
    // Solo tras un `ok` confirmado por el servidor: si la operación falló no se
    // modificó nada y no hay nada que sincronizar.
    refreshAndBroadcast();
    onOpenChange(false);
    setReason("");
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover {equipment.assetCode}</DialogTitle>
          <DialogDescription>{definition?.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {equipment.isOnLoan ? (
            <div className="space-y-1.5">
              <Label htmlFor="movement-type">Operación</Label>
              <Input
                id="movement-type"
                readOnly
                value={MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN].label}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="movement-type">Operación</Label>
              <Select
                value={typeChoice}
                onValueChange={(value) => setTypeChoice(value as EquipmentMovementType)}
              >
                <SelectTrigger id="movement-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {MOVEMENT_DEFINITIONS[candidate].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isReturn ? (
            <div className="space-y-1.5">
              <Label htmlFor="movement-destination">Vuelve a</Label>
              <Input
                id="movement-destination"
                readOnly
                value={
                  ownerRestaurant
                    ? `${ownerRestaurant.name} (${ownerRestaurant.code})`
                    : "—"
                }
              />
              <p className="text-xs text-muted-foreground">
                La devolución solo puede hacerse a la unidad propietaria del
                equipo.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="movement-destination">Unidad destino</Label>
              <Select value={toRestaurantId} onValueChange={setToRestaurantId}>
                <SelectTrigger id="movement-destination">
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
          )}

          <div className="space-y-1.5">
            <Label htmlFor="movement-reason">Motivo</Label>
            <Input
              id="movement-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Reubicación, ampliación de sala, reparación…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="movement-notes">Detalle</Label>
            <Textarea
              id="movement-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Moviendo…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Copia y sustitución ─────────────────────────────────────────────────────

/**
 * Diálogo compartido por COPIA y SUSTITUCIÓN.
 *
 * Los dos flujos crean un equipo nuevo a partir de uno existente, así que
 * comparten los mismos campos: código de activo obligatorio, serie opcional
 * (vacía significa "aún no se conoce", que es el valor correcto para un equipo
 * recién salido de almacén) y unidad destino. Lo único que cambia es la acción
 * que se llama y lo que le ocurre al original, y eso lo explica el texto.
 */
function CreateEquipmentDialog({
  open,
  onOpenChange,
  equipment,
  restaurants,
  type,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: MovableEquipmentOption;
  restaurants: RestaurantOption[];
  type:
    | typeof EQUIPMENT_MOVEMENT_TYPES.COPY
    | typeof EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT;
}) {
  const { refreshAndBroadcast } = useMutationSync();
  const isCopy = type === EQUIPMENT_MOVEMENT_TYPES.COPY;
  const fieldPrefix = isCopy ? "copy" : "replace";
  const [toRestaurantId, setToRestaurantId] = React.useState<string>(ALL);
  const [assetCode, setAssetCode] = React.useState("");
  const [serialNumber, setSerialNumber] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const destinationOptions = React.useMemo(
    () =>
      isCopy
        ? // En una copia el original NO se mueve, así que la copia puede ir
          // incluso a la misma unidad: es la forma de duplicar un equipo en el
          // mismo local.
          restaurants
        : restaurants.filter((r) => r.id !== equipment.restaurantId),
    [restaurants, isCopy, equipment.restaurantId]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!assetCode.trim()) {
      toast.error("Indica el código de activo del equipo nuevo.");
      return;
    }
    if (toRestaurantId === ALL) {
      toast.error("Selecciona la unidad destino.");
      return;
    }
    setPending(true);
    const payload = {
      equipmentId: equipment.id,
      toRestaurantId,
      assetCode,
      serialNumber,
      reason,
      notes,
    };
    const result = isCopy
      ? await copyEquipment(payload)
      : await replaceEquipment(payload);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    refreshAndBroadcast();
    onOpenChange(false);
    setAssetCode("");
    setSerialNumber("");
    setReason("");
    setNotes("");
    setToRestaurantId(ALL);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCopy ? "Copiar" : "Sustituir"} {equipment.assetCode}
          </DialogTitle>
          <DialogDescription>
            {isCopy
              ? "Se crea un equipo nuevo con los mismos datos. El original no se mueve y conserva su número de serie y su etiqueta."
              : "El equipo actual queda fuera de servicio y enlazado con el nuevo, que hereda sus datos."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-asset-code`}>
              Código de activo del equipo nuevo
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${fieldPrefix}-asset-code`}
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                placeholder={`${equipment.assetCode}-C`}
                maxLength={40}
                className="font-mono"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAssetCode(suggestAssetCode(equipment.assetCode, new Set()))}
                title="Sugerir un código"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-serial`}>
              Número de serie del equipo nuevo
            </Label>
            <Input
              id={`${fieldPrefix}-serial`}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Vacío si todavía no se conoce"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              El número de serie pertenece al equipo físico, no a la fila. No
              puede repetirse el de {equipment.assetCode}.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-destination`}>
              {isCopy ? "Unidad donde vivirá la copia" : "Unidad del sustituto"}
            </Label>
            <Select value={toRestaurantId} onValueChange={setToRestaurantId}>
              <SelectTrigger id={`${fieldPrefix}-destination`}>
                <SelectValue placeholder="Selecciona una unidad" />
              </SelectTrigger>
                <SelectContent>
                  {destinationOptions.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      <RestaurantOptionLabel restaurant={restaurant} />
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-reason`}>Motivo</Label>
            <Input
              id={`${fieldPrefix}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-notes`}>Detalle</Label>
            <Textarea
              id={`${fieldPrefix}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? isCopy
                  ? "Copiando…"
                  : "Sustituyendo…"
                : isCopy
                  ? "Crear copia"
                  : "Sustituir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Devolución ──────────────────────────────────────────────────────────────

/**
 * Devuelve un equipo prestado a su unidad propietaria.
 *
 * No pide confirmación ni motivo: es la operación inversa de un préstamo que ya
 * se registró, y el destino lo impone el propietario. Se puede usar tanto desde
 * la ficha como desde la fila de la lista de equipos.
 */
export function ReturnLoanButton({
  equipment,
  ownerName,
}: {
  equipment: MovableEquipmentOption;
  ownerName?: string;
}) {
  const { refreshAndBroadcast } = useMutationSync();
  const [pending, setPending] = React.useState(false);

  async function handleReturn() {
    setPending(true);
    const result = await moveEquipment({
      equipmentId: equipment.id,
      // El servidor reemplaza este valor por el propietario effective; se envía
      // para que el payload sea completo y auditable.
      toRestaurantId: effectiveOwnerRestaurantId(equipment),
      type: EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN,
      reason: "Devolución",
      notes: "",
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    refreshAndBroadcast();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReturn}
      disabled={pending}
      title={ownerName ? `Vuelve a ${ownerName}` : undefined}
    >
      <RefreshCcw className="h-4 w-4" />
      {pending ? "Devolviendo…" : "Devolver"}
    </Button>
  );
}
