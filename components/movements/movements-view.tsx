"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Layers, Search } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  EQUIPMENT_MOVEMENT_TYPES,
  EQUIPMENT_MOVEMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentMovementType,
} from "@/lib/db/enums";
import { formatDateTime } from "@/lib/utils";
import { useMutationSync } from "@/lib/sync/use-tab-sync";
import {
  archiveEquipment,
  type MovementActionResult,
} from "@/app/(dashboard)/equipment/movements/actions";
import type {
  MovableEquipmentOption,
  MovementRow,
  RestaurantOption,
} from "@/app/(dashboard)/movements/types";
import { BulkMoveDialog } from "./bulk-move-dialog";
import { RestaurantOptionLabel } from "@/components/restaurants/restaurant-option-label";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import { RowActions } from "./row-actions";

/**
 * Vista de Movimientos de Inventario.
 *
 * Tres bloques, en el orden en que se usan:
 *
 * 1. Qué significa cada operación, para no tener que adivinarlo.
 * 2. Los equipos, con sus acciones de una en una y la selección múltiple para
 *    el movimiento en lote.
 * 3. El libro: qué se movió, de dónde a dónde, cuándo, por qué y en qué lote.
 *
 * Es un client component que recibe los datos ya acotados por el servidor. No
 * consulta nada por su cuenta ni filtra por alcance: eso lo hizo la página, en el
 * servidor, para no exponer movimientos de otras unidades en el HTML.
 */

const ALL = "__all__";

/** Operaciones que pueden aplicarse a varios equipos en un solo lote. */
const BATCH_TYPES: EquipmentMovementType[] = [
  EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
  EQUIPMENT_MOVEMENT_TYPES.PULL,
  EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
];

const OPERATION_CARDS = [
  {
    title: "Traslado",
    text: "El equipo pasa a ser de la unidad destino sin perder su identidad ni su historial.",
  },
  {
    title: "Copia",
    text: "Duplica los datos en un equipo nuevo, con código y serie propios.",
  },
  {
    title: "Jalado",
    text: "Trae el equipo de vuelta a una unidad. Queda registrado aparte del envío.",
  },
  {
    title: "Préstamo",
    text: "El equipo sale a otra unidad sin dejar de ser de su propietario.",
  },
  {
    title: "Sustitución",
    text: "Un equipo entra a sustituir a otro, que queda fuera de servicio.",
  },
] as const;

export function MovementsView({
  movements,
  equipment,
  restaurants,
}: {
  movements: MovementRow[];
  equipment: MovableEquipmentOption[];
  restaurants: RestaurantOption[];
}) {
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>(ALL);
  const [unitFilter, setUnitFilter] = React.useState<string>(ALL);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<MovableEquipmentOption | null>(null);

  const matches = React.useCallback(
    (text: string) => text.toLowerCase().includes(query.trim().toLowerCase()),
    [query]
  );

  const visibleMovements = React.useMemo(
    () =>
      movements.filter((m) => {
        if (typeFilter !== ALL && m.type !== typeFilter) return false;
        if (unitFilter !== ALL && m.fromCode !== unitFilter && m.toCode !== unitFilter) {
          return false;
        }
        if (!query.trim()) return true;
        return [m.assetCode, m.equipmentTypeName, m.fromName, m.toName, m.reason, m.notes]
          .filter((v): v is string => Boolean(v))
          .some(matches);
      }),
    [movements, typeFilter, unitFilter, query, matches]
  );

  // Tamaño de cada lote DENTRO de la vista ya filtrada: así un lote de 12
  // equipos que la búsqueda dejó en 3 se muestra como 3, que es lo que el
  // usuario está viendo.
  const batchSizes = React.useMemo(() => {
    const sizes = new Map<string, number>();
    for (const m of visibleMovements) {
      sizes.set(m.batchId, (sizes.get(m.batchId) ?? 0) + 1);
    }
    return sizes;
  }, [visibleMovements]);

  const batchCount = batchSizes.size;

  // El filtro ofrece las mismas unidades que aparecen en el libro, ni una más.
  // Se enriquece con nombre y logo para la identidad visual; si una unidad ya no
  // está activa y por tanto no viene en `restaurants`, se cae al código.
  const restaurantByCode = React.useMemo(
    () => new Map(restaurants.map((r) => [r.code, r])),
    [restaurants]
  );

  const unitOptions = React.useMemo(() => {
    const codes = new Set<string>();
    for (const m of movements) {
      if (m.fromCode) codes.add(m.fromCode);
      if (m.toCode) codes.add(m.toCode);
    }
    return [...codes].sort().map((code) => {
      const match = restaurantByCode.get(code);
      return { code, name: match?.name ?? code, logo: match?.logo ?? null };
    });
  }, [movements, restaurantByCode]);

  // Callbacks estables: sin identidad estable, `React.memo` en `EquipmentRow` no
  // puede saltarse el re-render de las 81 filas.
  const toggleSelected = React.useCallback(
    (id: string, checked: boolean) => {
      setSelectedIds((current) =>
        checked ? [...new Set([...current, id])] : current.filter((v) => v !== id)
      );
    },
    []
  );

  const handleArchive = React.useCallback((item: MovableEquipmentOption) => {
    setArchiveTarget(item);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Movimientos de inventario
          </CardTitle>
          <CardDescription>
            Traslada, copia, jala, presta, devuelve y sustituye equipos. Cada
            operación queda asentada en el libro con su origen, su destino y su
            motivo, y un traslado conserva la identidad del equipo: su código,
            su número de serie, su etiqueta y todo su historial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OPERATION_CARDS.map((card) => (
              <div key={card.title} className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{card.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1 space-y-1.5">
              <Label htmlFor="movements-search">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="movements-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Código, tipo, unidad o motivo"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="min-w-[12rem] space-y-1.5">
              <Label htmlFor="movements-type">Operación</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="movements-type">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las operaciones</SelectItem>
                  {Object.values(EQUIPMENT_MOVEMENT_TYPES).map((type) => (
                    <SelectItem key={type} value={type}>
                      {EQUIPMENT_MOVEMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[12rem] space-y-1.5">
              <Label htmlFor="movements-unit">Unidad</Label>
              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger id="movements-unit">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las unidades</SelectItem>
                  {unitOptions.map((unit) => (
                    <SelectItem key={unit.code} value={unit.code}>
                      <RestaurantOptionLabel
                        restaurant={{
                          name: unit.name,
                          code: unit.code,
                          logo: unit.logo,
                        }}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Equipos y operaciones
          </CardTitle>
          <CardDescription>
            Acciones sobre un equipo, o marca varios para aplicar un movimiento en
            lote. Un lote se aplica entero o no se aplica: si un solo equipo no
            cumple las reglas, no se mueve ninguno.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkOpen(true)}
              disabled={selectedIds.length === 0}
            >
              <Layers className="h-4 w-4" />
              {selectedIds.length > 0
                ? `Mover ${selectedIds.length} seleccionados`
                : "Selecciona equipos para moverlos"}
            </Button>
            {selectedIds.length > 0 && (
              <Button variant="ghost" onClick={() => setSelectedIds([])}>
                Limpiar selección
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {equipment.length} equipo(s) disponibles.
            </span>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-2" />
                  <th className="px-4 py-2 text-left font-medium">Código</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Unidad</th>
                  <th className="px-4 py-2 text-left font-medium">Propietario</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {equipment.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No hay equipos para mover.
                    </td>
                  </tr>
                )}
                {equipment.map((item) => (
                  <EquipmentRow
                    key={item.id}
                    item={item}
                    restaurants={restaurants}
                    selected={selectedIds.includes(item.id)}
                    onToggle={toggleSelected}
                    onArchive={handleArchive}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Libro de movimientos</CardTitle>
          <CardDescription>
            {visibleMovements.length} movimiento(s) · {batchCount} lote(s). Las
            operaciones múltiples comparten un lote, así que se leen como una
            sola.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visibleMovements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin movimientos para estos filtros.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[64rem] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Fecha</th>
                    <th className="px-4 py-2 text-left font-medium">Operación</th>
                    <th className="px-4 py-2 text-left font-medium">Equipo</th>
                    <th className="px-4 py-2 text-left font-medium">Origen</th>
                    <th className="px-4 py-2 text-left font-medium">Destino</th>
                    <th className="px-4 py-2 text-left font-medium">Par</th>
                    <th className="px-4 py-2 text-left font-medium">Motivo</th>
                    <th className="px-4 py-2 text-left font-medium">Lote</th>
                    <th className="px-4 py-2 text-left font-medium">Hecho por</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMovements.map((m) => {
                    const size = batchSizes.get(m.batchId) ?? 1;
                    return (
                      <tr key={m.id} className="border-t">
                        <td className="whitespace-nowrap px-4 py-2 text-xs">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary">
                            {EQUIPMENT_MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs font-medium">
                          {m.assetCode}
                          <span className="block text-muted-foreground">
                            {m.equipmentTypeName}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {m.fromName ? (
                            <RestaurantOptionLabel
                              className="items-start"
                              restaurant={{
                                name: m.fromName,
                                code: m.fromCode ?? "",
                                logo: m.fromLogo,
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {m.toName ? (
                            <RestaurantOptionLabel
                              className="items-start"
                              restaurant={{
                                name: m.toName,
                                code: m.toCode ?? "",
                                logo: m.toLogo,
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {m.counterpartAssetCode ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {m.reason ?? "—"}
                          {m.notes ? (
                            <span className="block text-muted-foreground">
                              {m.notes}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {size > 1 ? (
                            <span className="font-mono">{size} equipos</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {m.performedByName ?? "Sistema"}
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

      <BulkMoveDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        equipmentIds={selectedIds}
        equipment={equipment}
        restaurants={restaurants}
        types={BATCH_TYPES}
        onDone={() => setSelectedIds([])}
      />

      <ArchiveDialog
        target={archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      />
    </div>
  );
}

/**
 * Fila de la tabla de equipos, memorizada.
 *
 * `MovementsView` guarda en su estado cosas que NO afectan a esta tabla: el texto
 * de búsqueda y los filtros solo acotan el libro de movimientos. Aun así, cada
 * tecla reactivaba el render de las 81 filas y, con ellas, todos sus botones,
 * menús y diálogos. Al ser una fila pura —sus datos, si está marcada y dos
 * callbacks estables— `React.memo` la deja intacta salvo cuando cambia algo que
 * de verdad la afecta: marcar o desmarcar esa fila.
 */
const EquipmentRow = React.memo(function EquipmentRow({
  item,
  restaurants,
  selected,
  onToggle,
  onArchive,
}: {
  item: MovableEquipmentOption;
  restaurants: RestaurantOption[];
  selected: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onArchive: (item: MovableEquipmentOption) => void;
}) {
  return (
    <tr className="border-t">
      <td className="px-4 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onToggle(item.id, checked === true)}
          aria-label={`Seleccionar ${item.assetCode}`}
        />
      </td>
      <td className="px-4 py-2 font-mono text-xs font-medium">
        {item.assetCode}
      </td>
      <td className="px-4 py-2 text-xs">{item.typeName}</td>
      <td className="px-4 py-2 text-xs">
        <RestaurantOptionLabel
          restaurant={{
            name: item.restaurantName,
            code: item.restaurantCode,
            logo: item.restaurantLogo,
          }}
        />
      </td>
      <td className="px-4 py-2 text-xs">
        {item.isOnLoan && item.ownerRestaurantName ? (
          <Badge variant="secondary" className="gap-1.5">
            <RestaurantIdentity
              restaurant={{
                name: item.ownerRestaurantName,
                logo: item.ownerRestaurantLogo,
              }}
              size="xs"
              logoOnly
              showSector={false}
            />
            {item.ownerRestaurantName}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs">
        {EQUIPMENT_STATUS_LABELS[item.status] ?? item.status}
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap justify-end gap-1">
          <RowActions
            equipment={item}
            restaurants={restaurants}
            onArchive={() => onArchive(item)}
          />
        </div>
      </td>
    </tr>
  );
});

// ─── Archivado ───────────────────────────────────────────────────────────────

function ArchiveDialog({
  target,
  onOpenChange,
}: {
  target: MovableEquipmentOption | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { refreshAndBroadcast } = useMutationSync();
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    setPending(true);
    const result: MovementActionResult = await archiveEquipment({
      equipmentId: target.id,
      reason,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    refreshAndBroadcast();
    onOpenChange(false);
    setReason("");
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archivar {target?.assetCode}</DialogTitle>
          <DialogDescription>
            El equipo pasa a retirado y deja de estar disponible para movimientos,
            pero conserva su etiqueta, su historial y su libro de movimientos. Es
            la alternativa a eliminar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="archive-reason">Motivo</Label>
            <Textarea
              id="archive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Archivando…" : "Archivar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
