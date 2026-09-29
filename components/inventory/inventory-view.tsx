"use client";

import * as React from "react";
import { FileSpreadsheet, Layers, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVENTORY_FORMAT_LABELS, type InventoryFormat } from "@/lib/db/enums";
import type {
  InventoryAssetRow,
  InventoryGroupRow,
} from "@/lib/db/queries/inventory";

const ALL = "__all__";

function formatMoney(cents: number | null, currency: string | null): string {
  if (cents === null) return "—";
  return `${currency ?? ""} ${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

export function InventoryView({
  assets,
  groups,
  documents,
  documentedCount,
  canSeeAll,
  viewerName,
}: {
  assets: InventoryAssetRow[];
  groups: InventoryGroupRow[];
  documents: Array<{ document: string; format: InventoryFormat }>;
  documentedCount: number;
  canSeeAll: boolean;
  viewerName: string;
}) {
  const [query, setQuery] = React.useState("");
  const [documentFilter, setDocumentFilter] = React.useState<string>(ALL);
  const [restaurantFilter, setRestaurantFilter] = React.useState<string>(ALL);

  const restaurantOptions = React.useMemo(() => {
    const codes = new Set<string>();
    for (const a of assets) codes.add(a.restaurantCode);
    for (const g of groups) codes.add(g.restaurantCode);
    return [...codes].sort();
  }, [assets, groups]);

  const matches = React.useCallback(
    (text: string) => text.toLowerCase().includes(query.trim().toLowerCase()),
    [query]
  );

  const visibleAssets = React.useMemo(
    () =>
      assets.filter((a) => {
        if (documentFilter !== ALL && a.sourceDocument !== documentFilter) return false;
        if (restaurantFilter !== ALL && a.restaurantCode !== restaurantFilter) return false;
        if (!query.trim()) return true;
        return [a.assetCode, a.serialNumber, a.typeName, a.model, a.sourceShortCode]
          .filter((v): v is string => Boolean(v))
          .some(matches);
      }),
    [assets, documentFilter, restaurantFilter, query, matches]
  );

  const visibleGroups = React.useMemo(
    () =>
      groups.filter((g) => {
        if (documentFilter !== ALL && g.sourceDocument !== documentFilter) return false;
        if (restaurantFilter !== ALL && g.restaurantCode !== restaurantFilter) return false;
        if (!query.trim()) return true;
        return [g.name, g.restaurantName, g.restaurantCode].some(matches);
      }),
    [groups, documentFilter, restaurantFilter, query, matches]
  );

  const groupTotals = React.useMemo(() => {
    const units = visibleGroups.reduce((acc, g) => acc + g.quantity, 0);
    const byCurrency = new Map<string, number>();
    for (const g of visibleGroups) {
      if (g.totalValue === null) continue;
      const key = g.currency ?? "";
      byCurrency.set(key, (byCurrency.get(key) ?? 0) + g.totalValue);
    }
    return { units, byCurrency };
  }, [visibleGroups]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventario por documento</CardTitle>
          <CardDescription>
            {canSeeAll
              ? `Equipos y rubros tal como aparecen en los documentos de origen. ${documentedCount} equipo(s) con documento cargado.`
              : `Equipos y rubros de tu restaurante. ${documentedCount} equipo(s) con documento cargado.`}
            {" "}Hola, {viewerName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1 space-y-1.5">
              <Label htmlFor="inventory-search">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="inventory-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Código, serie, tipo o modelo"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="min-w-[12rem] space-y-1.5">
              <Label htmlFor="inventory-document">Documento</Label>
              <Select value={documentFilter} onValueChange={setDocumentFilter}>
                <SelectTrigger id="inventory-document">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los documentos</SelectItem>
                  {documents.map((d) => (
                    <SelectItem key={d.document} value={d.document}>
                      {d.document} ({INVENTORY_FORMAT_LABELS[d.format]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canSeeAll && restaurantOptions.length > 1 && (
              <div className="min-w-[12rem] space-y-1.5">
                <Label htmlFor="inventory-restaurant">Unidad</Label>
                <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
                  <SelectTrigger id="inventory-restaurant">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas las unidades</SelectItem>
                    {restaurantOptions.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" />
            Equipos por unidad
          </CardTitle>
          <CardDescription>
            Filas del formato &quot;por equipo&quot;: cada una es un equipo identificable,
            con su propio código y número de serie. {visibleAssets.length}{" "}
            fila(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Documento</th>
                  <th className="px-4 py-2 text-left font-medium">Unidad</th>
                  <th className="px-4 py-2 text-left font-medium">Código</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Modelo</th>
                  <th className="px-4 py-2 text-left font-medium">Serie</th>
                  <th className="px-4 py-2 text-left font-medium">Cód. corto</th>
                  <th className="px-4 py-2 text-left font-medium">Técnico</th>
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssets.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Sin equipos para estos filtros.
                    </td>
                  </tr>
                )}
                {visibleAssets.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {a.sourceDocument ?? (
                        <span className="italic">sin documento</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{a.restaurantCode}</td>
                    <td className="px-4 py-2 font-mono text-xs font-medium">
                      {a.assetCode}
                    </td>
                    <td className="px-4 py-2">{a.typeName}</td>
                    <td className="px-4 py-2 text-xs">{a.model ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {a.serialNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {a.sourceShortCode ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {a.sourceTechnician ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">{a.sourceDateText ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Inventario agregado por rubro
          </CardTitle>
          <CardDescription>
            Filas del formato &quot;por rubro&quot;: una línea cubre N unidades
            idénticas, así que no tiene código ni serie individual. El valor
            mostrado es el total de la línea del documento.{" "}
            {visibleGroups.length} rubro(s), {groupTotals.units} unidad(es)
            {[...groupTotals.byCurrency.entries()].map(([currency, value]) => (
              <span key={currency} className="ml-1 font-medium">
                · {formatMoney(value, currency)}
              </span>
            ))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Documento</th>
                  <th className="px-4 py-2 text-left font-medium">Unidad</th>
                  <th className="px-4 py-2 text-left font-medium">Rubro</th>
                  <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Valor total de la línea
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Sin rubros para estos filtros.
                    </td>
                  </tr>
                )}
                {visibleGroups.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {g.sourceDocument ?? "—"}
                    </td>
                    <td className="px-4 py-2">{g.restaurantCode}</td>
                    <td className="px-4 py-2 font-medium">{g.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {g.quantity}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(g.totalValue, g.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            KFC y China Wok todavía no tienen documento de inventario cargado, por
            lo que no aparecen rubros agregados ni filas de origen. No se
            inventaron datos para esas marcas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
