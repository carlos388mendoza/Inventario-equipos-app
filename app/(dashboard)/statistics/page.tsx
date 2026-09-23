import {
  requestsRankingByRestaurant,
  equipmentWithType,
} from "@/lib/db/queries/stats";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { computeLifecycle } from "@/lib/equipment/lifecycle";
import { ROLES } from "@/lib/db/enums";
import { StatsAgentChat } from "@/components/statistics/stats-agent-chat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TypeSummary {
  typeName: string;
  usefulLifeMonths: number;
  total: number;
  ok: number;
  warning: number;
  expired: number;
  unknown: number;
  atRisk: {
    assetCode: string;
    restaurantName: string;
    state: "warning" | "expired";
    monthsElapsed: number;
    monthsRemaining: number;
    startDate: Date | null;
  }[];
}

export default async function StatisticsPage() {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER);

  const [ranking, equiposConTipo, restaurantRows] = await Promise.all([
    requestsRankingByRestaurant(),
    equipmentWithType(),
    db.select().from(restaurants),
  ]);

  const restaurantMap = new Map(restaurantRows.map((r) => [r.id, r]));

  const types = new Map<string, TypeSummary>();
  for (const row of equiposConTipo) {
    const e = row.equipment;
    const lifecycle = computeLifecycle(
      row.usefulLifeMonths,
      e.installationDate ?? e.purchaseDate
    );
    const summary =
      types.get(row.typeId) ??
      ({
        typeName: row.typeName,
        usefulLifeMonths: row.usefulLifeMonths,
        total: 0,
        ok: 0,
        warning: 0,
        expired: 0,
        unknown: 0,
        atRisk: [],
      } satisfies TypeSummary);
    summary.total += 1;
    summary[lifecycle.state] += 1;
    if (lifecycle.state === "warning" || lifecycle.state === "expired") {
      summary.atRisk.push({
        assetCode: e.assetCode,
        restaurantName: restaurantMap.get(e.restaurantId)?.name ?? "Desconocido",
        state: lifecycle.state,
        monthsElapsed: lifecycle.monthsElapsed,
        monthsRemaining: lifecycle.monthsRemaining,
        startDate: lifecycle.startDate,
      });
    }
    types.set(row.typeId, summary);
  }
  const typeSummaries = [...types.values()];

  const maxRequests = Math.max(
    0,
    ...ranking.map((r) => r.totalRequests)
  );
  const totalEquipment = equiposConTipo.length;

  return (
    <main className="p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Estadísticas</h1>
          <p className="text-muted-foreground">
            Demanda por restaurante y estado de vida útil del inventario.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ranking de restaurantes por solicitudes</CardTitle>
              <CardDescription>
                Total de solicitudes de equipo registradas por unidad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin solicitudes registradas todavía.
                </p>
              )}
              <ol className="space-y-2">
                {ranking.map((r, index) => (
                  <li key={r.restaurantId} className="flex items-center gap-3">
                    <span className="w-5 text-right text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <RestaurantIdentity
                        restaurant={{
                          name: r.restaurantName,
                          brand: r.restaurantBrand,
                          sector: r.restaurantSector,
                          logo: r.restaurantLogo,
                        }}
                        size="sm"
                        showSector={false}
                      />
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: `${(r.totalRequests / maxRequests) * 100}%`,
                          }}
                        />
                      </span>
                    </span>
                    <Badge variant="secondary">{r.totalRequests}</Badge>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventario por tipo de equipo</CardTitle>
              <CardDescription>
                {totalEquipment} equipo(s) comparados contra su vida útil de
                catálogo (installationDate o purchaseDate).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {typeSummaries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay equipos registrados.
                </p>
              )}
              <div className="space-y-4">
                {typeSummaries.map((t) => (
                  <div
                    key={t.typeName}
                    className="rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{t.typeName}</p>
                      <p className="text-xs text-muted-foreground">
                        Vida útil: {t.usefulLifeMonths} meses · {t.total}{" "}
                        equipo(s)
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">ok {t.ok}</Badge>
                      <Badge variant="secondary">cerca {t.warning}</Badge>
                      <Badge variant="destructive">vencidos {t.expired}</Badge>
                      {t.unknown > 0 && (
                        <Badge variant="outline">sin fecha {t.unknown}</Badge>
                      )}
                    </div>
                    {t.atRisk.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t pt-2 text-sm">
                        {t.atRisk.map((equipo) => (
                          <li
                            key={equipo.assetCode}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span className="font-mono text-xs">
                              {equipo.assetCode}
                            </span>
                            <span className="text-muted-foreground">
                              {equipo.restaurantName}
                            </span>
                            <Badge
                              variant={
                                equipo.state === "expired"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {equipo.state === "expired"
                                ? `Vencido hace ${Math.abs(
                                    equipo.monthsRemaining
                                  )} mes(es)`
                                : `~${equipo.monthsRemaining} mes(es)`}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Equipos cerca o pasados de vida útil</CardTitle>
            <CardDescription>
              Detalle de los equipos que requieren atención en su ciclo de vida.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Activo</th>
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Restaurante
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Inicio (instalación/compra)
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Uso</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Estado de vida útil
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {equiposConTipo
                    .filter((row) => {
                      const lifecycle = computeLifecycle(
                        row.usefulLifeMonths,
                        row.equipment.installationDate ??
                          row.equipment.purchaseDate
                      );
                      return (
                        lifecycle.state === "warning" ||
                        lifecycle.state === "expired"
                      );
                    })
                    .map((row) => {
                      const e = row.equipment;
                      const lifecycle = computeLifecycle(
                        row.usefulLifeMonths,
                        e.installationDate ?? e.purchaseDate
                      );
                      return (
                        <tr key={e.id} className="border-t">
                          <td className="px-4 py-2 font-mono text-xs font-medium">
                            {e.assetCode}
                          </td>
                          <td className="px-4 py-2">{row.typeName}</td>
                          <td className="px-4 py-2">
                            {(() => {
                              const res = restaurantMap.get(e.restaurantId);
                              return res ? (
                                <RestaurantIdentity
                                  restaurant={{
                                    name: res.name,
                                    brand: res.brand,
                                    sector: res.sector,
                                    logo: res.logo,
                                  }}
                                  size="sm"
                                  showSector={false}
                                />
                              ) : (
                                "Desconocido"
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDate(lifecycle.startDate)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {lifecycle.monthsElapsed} mes(es)
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Badge
                              variant={
                                lifecycle.state === "expired"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {lifecycle.state === "expired"
                                ? `Vencido hace ${Math.abs(
                                    lifecycle.monthsRemaining
                                  )} mes(es)`
                                : `~${lifecycle.monthsRemaining} mes(es)`}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  {equiposConTipo.every((row) => {
                    const lifecycle = computeLifecycle(
                      row.usefulLifeMonths,
                      row.equipment.installationDate ?? row.equipment.purchaseDate
                    );
                    return (
                      lifecycle.state !== "warning" &&
                      lifecycle.state !== "expired"
                    );
                  }) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No hay equipos cerca o pasados de su vida útil.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <StatsAgentChat />
      </div>
    </main>
  );
}