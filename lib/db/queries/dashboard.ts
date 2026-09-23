import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, restaurants, securityLabels } from "@/lib/db/schema";
import {
  ACTIVE_REQUEST_STATUS,
  type RequestStatus,
} from "@/lib/db/enums";
import {
  computeLifecycle,
  type LifecycleState,
} from "@/lib/equipment/lifecycle";
import { listRequests, type RequestWithNames } from "@/lib/db/queries/requests";
import { equipmentWithType } from "@/lib/db/queries/stats";

export interface LifecycleCounts {
  ok: number;
  warning: number;
  expired: number;
  unknown: number;
}

export interface AtRiskEquipment {
  id: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantBrand: string | null;
  restaurantSector: string | null;
  restaurantLogo: string | null;
  state: Exclude<LifecycleState, "ok" | "unknown">;
  label: string;
}

export interface DashboardSummary {
  restaurantId: string | null;
  restaurantsTotal: number | null;
  equipmentTotal: number;
  activeRequests: number;
  closedRequests: number;
  labelsTotal: number;
  lifecycle: LifecycleCounts;
  atRisk: AtRiskEquipment[];
  recentRequests: RequestWithNames[];
}

/**
 * Resumen del panel principal, filtrado al restaurante del usuario
 * cuando no es un rol global (defensa en profundidad en el servidor).
 */
export async function getDashboardSummary(
  restaurantId: string | null
): Promise<DashboardSummary> {
  const [equiposConTipo, requests, restaurantRows, labelsCountRow, restaurantsCountRow] =
    await Promise.all([
      equipmentWithType(),
      listRequests(restaurantId ? { restaurantId } : undefined),
      db
        .select({
          id: restaurants.id,
          name: restaurants.name,
          brand: restaurants.brand,
          sector: restaurants.sector,
          logo: restaurants.logo,
        })
        .from(restaurants)
        .orderBy(asc(restaurants.name)),
      db
        .select({ total: count() })
        .from(securityLabels)
        .innerJoin(equipment, eq(securityLabels.equipmentId, equipment.id))
        .where(restaurantId ? eq(equipment.restaurantId, restaurantId) : undefined),
      restaurantId ? null : db.select({ total: count() }).from(restaurants),
    ]);

  const restaurantMap = new Map(restaurantRows.map((r) => [r.id, r]));

  const scoped = restaurantId
    ? equiposConTipo.filter((r) => r.equipment.restaurantId === restaurantId)
    : equiposConTipo;

  const lifecycle: LifecycleCounts = { ok: 0, warning: 0, expired: 0, unknown: 0 };
  const atRisk: AtRiskEquipment[] = [];

  for (const row of scoped) {
    const e = row.equipment;
    const lc = computeLifecycle(
      row.usefulLifeMonths,
      e.installationDate ?? e.purchaseDate
    );
    lifecycle[lc.state] += 1;
    if (lc.state === "warning" || lc.state === "expired") {
      const restaurant = restaurantMap.get(e.restaurantId);
      atRisk.push({
        id: e.id,
        assetCode: e.assetCode,
        typeName: row.typeName,
        restaurantName: restaurant?.name ?? "—",
        restaurantBrand: restaurant?.brand ?? null,
        restaurantSector: restaurant?.sector ?? null,
        restaurantLogo: restaurant?.logo ?? null,
        state: lc.state,
        label: lc.label,
      });
    }
  }
  atRisk.sort((a, b) =>
    a.state === b.state
      ? a.assetCode.localeCompare(b.assetCode)
      : a.state === "expired"
      ? -1
      : 1
  );

  const activeCount = requests.filter((r) =>
    ACTIVE_REQUEST_STATUS.includes(r.status as RequestStatus)
  ).length;

  return {
    restaurantId,
    restaurantsTotal:
      restaurantsCountRow === null ? null : (restaurantsCountRow[0]?.total ?? 0),
    equipmentTotal: scoped.length,
    activeRequests: activeCount,
    closedRequests: requests.length - activeCount,
    labelsTotal: labelsCountRow[0]?.total ?? 0,
    lifecycle,
    atRisk,
    recentRequests: requests.slice(0, 5),
  };
}