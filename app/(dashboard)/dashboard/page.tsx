import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  History,
  QrCode,
  Store,
} from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { resolveScope } from "@/lib/equipment/scope";
import { getDashboardSummary } from "@/lib/db/queries/dashboard";
import {
  REQUEST_STATUS_LABELS,
  ROLES,
  ROLE_LABELS,
  asUserRole,
  type RequestStatus,
} from "@/lib/db/enums";
import { formatDate } from "@/lib/utils";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function statusBadgeVariant(status: RequestStatus) {
  switch (status) {
    case "REJECTED":
    case "CANCELLED":
      return "destructive" as const;
    case "APPROVED":
    case "COMPLETED":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardHomePage() {
  const user = await requireUser();
  const scope = await resolveScope();
  const summary = await getDashboardSummary(scope.restaurantId);
  const role = asUserRole(user.role);

  const requestsHref =
    role === ROLES.RESTAURANT_USER ? "/my-requests" : "/requests";

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Panel principal</h1>
          <p className="text-muted-foreground">
            Bienvenido/a, {user.name} ({ROLE_LABELS[role]}). Resumen del
            inventario y las solicitudes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Boxes className="h-5 w-5" />}
            label="Equipos"
            value={summary.equipmentTotal}
            hint="en inventario activo"
          />
          <StatCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="Solicitudes activas"
            value={summary.activeRequests}
            hint="pendientes, en revisión o aprobadas"
          />
          <StatCard
            icon={<History className="h-5 w-5" />}
            label="Históricas"
            value={summary.closedRequests}
            hint="rechazadas, completadas o canceladas"
          />
          <StatCard
            icon={<QrCode className="h-5 w-5" />}
            label="Etiquetas QR"
            value={summary.labelsTotal}
            hint="generadas"
          />
          {summary.restaurantsTotal !== null && (
            <StatCard
              icon={<Store className="h-5 w-5" />}
              label="Restaurantes"
              value={summary.restaurantsTotal}
              hint="unidades registradas"
            />
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">
                  Estado de vida útil
                </CardTitle>
                <CardDescription>
                  Equipos según su ciclo de vida
                </CardDescription>
              </div>
              {role !== ROLES.RESTAURANT_USER && (
                <Link
                  href="/statistics"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver estadísticas
                </Link>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold tabular-nums">
                    {summary.lifecycle.ok}
                  </p>
                  <p className="text-xs text-muted-foreground">En buen estado</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold tabular-nums text-amber-500">
                    {summary.lifecycle.warning}
                  </p>
                  <p className="text-xs text-muted-foreground">Próximos a vencer</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold tabular-nums text-destructive">
                    {summary.lifecycle.expired}
                  </p>
                  <p className="text-xs text-muted-foreground">Vida útil agotada</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold tabular-nums text-muted-foreground">
                    {summary.lifecycle.unknown}
                  </p>
                  <p className="text-xs text-muted-foreground">Sin fecha</p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold">Necesitan atención</h3>
                </div>
                {summary.atRisk.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todo el inventario está dentro de su vida útil.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {summary.atRisk.length} equipo(s) con vida útil agotada o
                    próxima a caducar. Consulta el detalle en la ficha de cada
                    equipo.
                  </p>
                )}
                <ul className="mt-2 space-y-2">
                  {summary.atRisk.slice(0, 6).map((eq) => (
                    <li
                      key={eq.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {eq.typeName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{eq.assetCode}</span>
                        </p>
                        <RestaurantIdentity
                          restaurant={{
                            name: eq.restaurantName,
                            brand: eq.restaurantBrand,
                            sector: eq.restaurantSector,
                            logo: eq.restaurantLogo,
                          }}
                          size="sm"
                          showSector={false}
                        />
                      </div>
                      <Badge
                        variant={eq.state === "expired" ? "destructive" : "outline"}
                        className="shrink-0"
                      >
                        {eq.state === "expired" ? "Vencido" : "Próximo"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">
                  Solicitudes recientes
                </CardTitle>
                <CardDescription>
                  Últimas solicitudes registradas
                </CardDescription>
              </div>
              <Link
                href={requestsHref}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver todas
              </Link>
            </CardHeader>
            <CardContent>
              {summary.recentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay solicitudes registradas.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.recentRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {r.equipmentTypeName}
                        </p>
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
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(r.createdAt)} · {r.requestedByName}
                        </p>
                      </div>
                      <Badge
                        variant={statusBadgeVariant(r.status)}
                        className="shrink-0"
                      >
                        {REQUEST_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}