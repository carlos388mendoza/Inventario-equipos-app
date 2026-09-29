import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentHistory,
  equipmentMovements,
  equipmentTypes,
  restaurants,
  securityLabels,
  userTable,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { resolveScope, assertRestaurantAccess } from "@/lib/equipment/scope";
import {
  computeLifecycle,
  equipmentActionLabel,
} from "@/lib/equipment/lifecycle";
import { ROLES, EQUIPMENT_STATUS_LABELS, EQUIPMENT_MOVEMENT_TYPE_LABELS } from "@/lib/db/enums";
import { isOnLoan } from "@/lib/equipment/movements";
import { EquipmentActions } from "@/components/equipment/equipment-actions";
import { DetailMovementActions } from "@/components/movements/detail-movement-actions";
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
      restaurantLogo: restaurants.logo,
    })
    .from(equipment)
    .innerJoin(equipmentTypes, eq(equipment.equipmentTypeId, equipmentTypes.id))
    .innerJoin(restaurants, eq(equipment.restaurantId, restaurants.id))
    .where(eq(equipment.id, id))
    .limit(1);

  if (rows.length === 0) notFound();
  const row = rows[0];
  assertRestaurantAccess(scope, row.e.restaurantId);

  const [labelRows, history, movements, allRestaurants] = await Promise.all([
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
    // El libro de movimientos, que es distinto del historial: aquí están los
    // orígenes, los destinos y el equipo par. Un equipo de movements puede no
    // estar en la fila `equipment_history` si fue el par de una copia, así que
    // se consultan los dos lados.
    db
      .select({
        id: equipmentMovements.id,
        type: equipmentMovements.type,
        assetCode: equipmentMovements.assetCode,
        fromName: restaurants.name,
        reason: equipmentMovements.reason,
        notes: equipmentMovements.notes,
        createdAt: equipmentMovements.createdAt,
        performedByName: userTable.name,
      })
      .from(equipmentMovements)
      .leftJoin(restaurants, eq(equipmentMovements.fromRestaurantId, restaurants.id))
      .leftJoin(userTable, eq(equipmentMovements.performedBy, userTable.id))
      .where(eq(equipmentMovements.equipmentId, id))
      .orderBy(desc(equipmentMovements.createdAt)),
    isManager
      ? db
          .select({
            id: restaurants.id,
            name: restaurants.name,
            code: restaurants.code,
            logo: restaurants.logo,
          })
          .from(restaurants)
          .orderBy(asc(restaurants.name))
      : Promise.resolve([]),
  ]);

  const restaurantOptions = allRestaurants.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    logo: r.logo,
  }));

  const onLoan = isOnLoan({
    restaurantId: row.e.restaurantId,
    ownerRestaurantId: row.e.ownerRestaurantId,
  });

  const movementOption = {
    id: row.e.id,
    assetCode: row.e.assetCode,
    serialNumber: row.e.serialNumber,
    typeName: row.typeName,
    restaurantId: row.e.restaurantId,
    restaurantName: row.restaurantName,
    restaurantCode: row.restaurantCode,
    restaurantLogo: row.restaurantLogo,
    ownerRestaurantId: row.e.ownerRestaurantId,
    ownerRestaurantName: null,
    ownerRestaurantLogo: null,
    status: row.e.status,
    isOnLoan: onLoan,
  };

  const lifecycle = computeLifecycle(
    row.typeLife,
    row.e.installationDate ?? row.e.purchaseDate
  );

  return (
    <main className="p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-mono">{row.e.assetCode}</h1>
            <p className="text-muted-foreground">
              {row.typeName} · {row.restaurantName} ({row.restaurantCode})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isManager && (
              <>
                <DetailMovementActions
                  equipment={movementOption}
                  restaurants={restaurantOptions}
                />
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
              {onLoan && (
                <div>
                  <dt className="text-sm text-muted-foreground">Préstamo</dt>
                  <dd>
                    <Badge variant="secondary">
                      Reside en {row.restaurantName} ({row.restaurantCode})
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sigue perteneciendo a su unidad propietaria. La devolución lo
                      devuelve allí.
                    </p>
                  </dd>
                </div>
              )}
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
                      {equipmentActionLabel(h.action)}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos</CardTitle>
            <CardDescription>
              Traslados, copias, préstamos, devoluciones y sustituciones en los
              que participa este equipo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {movements.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Este equipo todavía no registra movimientos.
              </p>
            )}
            {movements.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Fecha</th>
                      <th className="px-4 py-2 text-left font-medium">
                        Operación
                      </th>
                      <th className="px-4 py-2 text-left font-medium">Origen</th>
                      <th className="px-4 py-2 text-left font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="whitespace-nowrap px-4 py-2 text-xs">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary">
                            {EQUIPMENT_MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                          </Badge>
                          <span className="mt-1 block font-mono text-xs">
                            {m.assetCode}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {m.fromName ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {m.reason ?? "—"}
                          {m.notes ? (
                            <span className="block text-muted-foreground">
                              {m.notes}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}