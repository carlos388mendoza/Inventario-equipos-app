/**
 * Cálculo de vida útil restante de un equipo.
 * La vida útil se obtiene del tipo de equipo (equipmentType.usefulLifeMonths)
 * y se mide desde installationDate ?? purchaseDate.
 */

export type LifecycleState = "ok" | "warning" | "expired" | "unknown";

export interface LifecycleInfo {
  state: LifecycleState;
  monthsTotal: number;
  monthsElapsed: number;
  monthsRemaining: number;
  pctRemaining: number | null;
  startDate: Date | null;
  label: string;
}

/** Diferencia en meses calendario entre dos fechas. */
export function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export function computeLifecycle(
  usefulLifeMonths: number,
  startDate: Date | null | undefined
): LifecycleInfo {
  const now = new Date();
  if (!startDate) {
    return {
      state: "unknown",
      monthsTotal: 0,
      monthsElapsed: 0,
      monthsRemaining: 0,
      pctRemaining: null,
      startDate: null,
      label: "Sin fecha de inicio",
    };
  }

  const monthsElapsed = monthsBetween(startDate, now);
  const monthsRemaining = usefulLifeMonths - monthsElapsed;
  const pctRemaining = Math.round(
    (monthsRemaining / usefulLifeMonths) * 100
  );
  const state: LifecycleState =
    monthsRemaining <= 0
      ? "expired"
      : pctRemaining <= 15
      ? "warning"
      : "ok";

  let label: string;
  if (state === "expired") {
    label =
      monthsRemaining === 0
        ? "Vida útil agotada"
        : `Vida útil agotada hace ${Math.abs(monthsRemaining)} mes(es)`;
  } else {
    label = `~${monthsRemaining} mes(es) restantes (${pctRemaining}%)`;
  }

  return {
    state,
    monthsTotal: usefulLifeMonths,
    monthsElapsed,
    monthsRemaining,
    pctRemaining,
    startDate,
    label,
  };
}

/** Acciones registradas en equipment_history. */
export const EQUIPMENT_ACTIONS = {
  REGISTERED: "REGISTERED",
  STATUS_CHANGED: "STATUS_CHANGED",
  TRANSFERRED: "TRANSFERRED",
  ASSIGNED: "ASSIGNED",
  SERVICED: "SERVICED",
  NOTE: "NOTE",
} as const;

export type EquipmentAction =
  (typeof EQUIPMENT_ACTIONS)[keyof typeof EQUIPMENT_ACTIONS];

export const EQUIPMENT_ACTION_LABELS: Record<EquipmentAction, string> = {
  REGISTERED: "Registro",
  STATUS_CHANGED: "Cambio de estado",
  TRANSFERRED: "Traslado",
  ASSIGNED: "Asignación",
  SERVICED: "Mantenimiento",
  NOTE: "Nota",
};