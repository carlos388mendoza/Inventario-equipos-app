"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LifecycleBadge } from "@/components/equipment/lifecycle-badge";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import { Combobox } from "@/components/ui/combobox";
import { SortableHeader, useTableSort } from "@/components/ui/sortable";
import { EQUIPMENT_STATUS_LABELS, ALL_EQUIPMENT_STATUS } from "@/lib/db/enums";
import { formatDate } from "@/lib/utils";
import type { EquipmentListItem } from "@/app/(dashboard)/equipment/types";

interface Option {
  id: string;
  name: string;
  code?: string;
}

export function EquipmentManager({
  equipment,
  isManager,
  restaurantOptions,
  typeOptions,
}: {
  equipment: EquipmentListItem[];
  isManager: boolean;
  restaurantOptions: Option[];
  typeOptions: Option[];
}) {
  const [query, setQuery] = React.useState("");
  const [restaurantId, setRestaurantId] = React.useState("ALL");
  const [typeId, setTypeId] = React.useState("ALL");
  const [status, setStatus] = React.useState("ALL");
  const { sort, toggle, sortRows } = useTableSort();

  const normalized = query.trim().toLowerCase();
  const filtered = equipment.filter((e) => {
    const matchesQuery =
      !normalized ||
      [e.assetCode, e.serialNumber, e.brand, e.model, e.equipmentTypeName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(normalized));
    const matchesRestaurant =
      restaurantId === "ALL" || e.restaurantId === restaurantId;
    const matchesType = typeId === "ALL" || e.equipmentTypeId === typeId;
    const matchesStatus = status === "ALL" || e.status === status;
    return matchesQuery && matchesRestaurant && matchesType && matchesStatus;
  });

  const sorted = React.useMemo(
    () =>
      sortRows(filtered, (e, key) => {
        switch (key) {
          case "assetCode":
            return e.assetCode;
          case "type":
            return e.equipmentTypeName;
          case "model":
            return [e.brand, e.model].filter(Boolean).join(" ") || null;
          case "restaurant":
            return e.restaurantName;
          case "status":
            return e.status;
          case "lifecycle":
            return e.lifecycle.monthsRemaining;
          case "installed":
            return e.installationDate ?? e.purchaseDate;
          default:
            return null;
        }
      }),
    [filtered, sortRows]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Inventario de equipos</CardTitle>
            <CardDescription>
              {equipment.length} equipo(s) registrado(s) en el sistema.
            </CardDescription>
          </div>
          {isManager && (
            <Button asChild>
              <Link href="/equipment/new">Registrar equipo</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Buscar por activo, serie, marca, modelo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="lg:col-span-1"
            />
            {restaurantOptions.length > 1 && (
              <Combobox
                value={restaurantId}
                onValueChange={setRestaurantId}
                placeholder="Restaurante"
                searchPlaceholder="Buscar restaurante…"
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
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
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
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {ALL_EQUIPMENT_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {EQUIPMENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <SortableHeader
                    label="Activo"
                    sortKey="assetCode"
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
                    label="Modelo"
                    sortKey="model"
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
                    label="Estado"
                    sortKey="status"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Vida útil"
                    sortKey="lifecycle"
                    sort={sort}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Instalación"
                    sortKey="installed"
                    sort={sort}
                    onToggle={toggle}
                  />
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
                      No hay equipos que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {sorted.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs font-medium">
                      {e.assetCode}
                    </td>
                    <td className="px-4 py-2">{e.equipmentTypeName}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {[e.brand, e.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <RestaurantIdentity
                        restaurant={{
                          name: e.restaurantName,
                          brand: e.restaurantBrand,
                          sector: e.restaurantSector,
                          logo: e.restaurantLogo,
                        }}
                        size="sm"
                        showSector={false}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          e.status === "ACTIVE"
                            ? "default"
                            : e.status === "DAMAGED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {EQUIPMENT_STATUS_LABELS[e.status as keyof typeof EQUIPMENT_STATUS_LABELS] ??
                          e.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <LifecycleBadge lifecycle={e.lifecycle} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {e.installationDate
                        ? formatDate(e.installationDate)
                        : e.purchaseDate
                        ? formatDate(e.purchaseDate)
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/equipment/${e.id}`}>Detalle</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}