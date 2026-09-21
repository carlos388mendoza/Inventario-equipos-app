import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentHistory,
  equipmentTypes,
  restaurants,
  securityLabels,
  userTable,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { resolveScope, assertRestaurantAccess } from "@/lib/equipment/scope";
import { computeLifecycle, EQUIPMENT_ACTION_LABELS } from "@/lib/equipment/lifecycle";
import { ROLES, EQUIPMENT_STATUS_LABELS } from "@/lib/db/enums";
import { EquipmentActions } from "@/components/equipment/equipment-actions";
import { LifecycleBadge } from "@/components/equipment/lifecycle-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(
    ROLES.ADMIN,
    ROLES.IT_MANAGER,
    ROLES.RESTAURANT_USER
  );
  const scope = await resolveScope();
  const isManager = user.role === ROLES.ADMIN || user.role === ROLES.IT_MANAGER;

  const rows = await db
    .select({
      e: equipment,
      typeName: equipmentTypes.name,
      typeLife: equipmentTypes.usefulLifeMonths,
      restaurantName: restaurants.name,
      restaurantCode: restaurants.code,
    })
    .from(equipment)
    .innerJoin(equipmentTypes, eq(equipment.equipmentTypeId, equipmentTypes.id))
    .innerJoin(restaurants, eq(equipment.restaurantId, restaurants.id))
    .where(eq(equipment.id, id))
    .limit(1);

  if (rows.length === 0) notFound();
  const row = rows[0];
  assertRestaurantAccess(scope, row.e.restaurantId);

  const [labelRows, history] = await Promise.all([
    db
      .select({ token: securityLabels.token })
      .from(securityLabels)
      .where(eq(securityLabels.equipmentId, id))
      .limit(1),
    db
      .select({
        id: equipmentHistory.id,
        action: equipmentHistory.action,
        description: equipmentHistory.description,
        createdAt: equipmentHistory.createdAt,
        performedByName: userTable.name,
      })
      .from(equipmentHistory)
      .leftJoin(userTable, eq(equipmentHistory.performedBy, userTable.id))
      .where(eq(equipmentHistory.equipmentId, id))
      .orderBy(desc(equipmentHistory.createdAt)),
  ]);

  const lifecycle = computeLifecycle(
    row.typeLife,
    row.e.installationDate ?? row.e.purchaseDate
  );

  return (
    <main className="p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-mono">{row.e.assetCode}</h1>
            <p className="text-muted-foreground">
              {row.typeName} · {row.restaurantName} ({row.restaurantCode})
            </p>
          </div>
          <div className="flex gap-2">
            {isManager && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/equipment/${id}/edit`}>Editar</Link>
                </Button>
                <EquipmentActions
                  equipmentId={id}
                  currentStatus={row.e.status}
                />
              </>
            )}
            <Button asChild variant="ghost">
              <Link href="/equipment">Volver al inventario</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ficha del equipo</CardTitle>
            <CardDescription>
              Estado actual, vida útil programada y datos técnicos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Estado</dt>
                <dd>
                  <Badge
                    variant={
                      row.e.status === "ACTIVE"
                        ? "default"
                        : row.e.status === "DAMAGED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {EQUIPMENT_STATUS_LABELS[row.e.status] ?? row.e.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Vida útil</dt>
                <dd>
                  <LifecycleBadge lifecycle={lifecycle} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Número de serie</dt>
                <dd>{row.e.serialNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Marca / Modelo</dt>
                <dd>
                  {[row.e.brand, row.e.model].filter(Boolean).join(" ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Fecha de compra</dt>
                <dd>{formatDate(row.e.purchaseDate)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Fecha de instalación
                </dt>
                <dd>{formatDate(row.e.installationDate)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Etiqueta de seguridad
                </dt>
                <dd>
                  {labelRows[0] ? "Generada" : "Pendiente de generar"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Tipo</dt>
                <dd>{row.typeName}</dd>
              </div>
            </dl>
            {row.e.notes && (
              <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                {row.e.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial del equipo</CardTitle>
            <CardDescription>
              Eventos registrados durante la vida útil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Sin eventos registrados.
              </p>
            )}
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {EQUIPMENT_ACTION_LABELS[h.action as keyof typeof EQUIPMENT_ACTION_LABELS] ??
                        h.action}
                    </p>
                    {h.description && (
                      <p className="text-sm text-muted-foreground">
                        {h.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)} ·{" "}
                      {h.performedByName ?? "Sistema"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}