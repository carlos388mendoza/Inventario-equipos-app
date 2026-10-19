import {
  ACTIVE_REQUEST_STATUS,
  CLOSED_REQUEST_STATUS,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/db/enums";
import { isWithinRange, type DateRange } from "@/lib/date-range";

/**
 * Filtrado de la lista de solicitudes (issue #33).
 *
 * Es la lógica que vivía dentro de `RequestManager`. Se extrae a una función
 * pura para poder probar la combinación del rango de fechas con el resto de
 * filtros (pestaña, restaurante, estado, prioridad, tipo y búsqueda) sin
 * depender del DOM. El componente solo monta el estado y llama aquí.
 */
export type RequestTab = "active" | "history";

export interface RequestFilterState {
  tab: RequestTab;
  /** `"ALL"` o el id de un restaurante. */
  restaurantId: string;
  /** `"ALL"` o un estado concreto. */
  statusFilter: string;
  /** `"ALL"` o una prioridad concreta. */
  priorityFilter: string;
  /** `"ALL"` o el id de un tipo de equipo. */
  typeFilter: string;
  query: string;
  range: DateRange;
}

export interface FilterableRequest {
  status: RequestStatus;
  restaurantId: string;
  priority: RequestPriority;
  equipmentTypeId: string;
  createdAt: string | Date;
  equipmentTypeName?: string | null;
  restaurantName?: string | null;
  requestedByName?: string | null;
  reason?: string | null;
}

export function matchesRequestFilters(
  request: FilterableRequest,
  filters: RequestFilterState
): boolean {
  const isActive = ACTIVE_REQUEST_STATUS.includes(request.status);
  const matchesTab =
    filters.tab === "active"
      ? isActive
      : CLOSED_REQUEST_STATUS.includes(request.status);
  const matchesRestaurant =
    filters.restaurantId === "ALL" ||
    request.restaurantId === filters.restaurantId;
  const matchesStatus =
    filters.statusFilter === "ALL" ||
    request.status === filters.statusFilter;
  const matchesPriority =
    filters.priorityFilter === "ALL" ||
    request.priority === filters.priorityFilter;
  const matchesType =
    filters.typeFilter === "ALL" ||
    request.equipmentTypeId === filters.typeFilter;
  const matchesDate = isWithinRange(
    new Date(request.createdAt).getTime(),
    filters.range
  );
  const normalized = filters.query.trim().toLowerCase();
  const matchesQuery =
    !normalized ||
    [
      request.equipmentTypeName,
      request.restaurantName,
      request.requestedByName,
      request.reason,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized));

  return (
    matchesTab &&
    matchesRestaurant &&
    matchesStatus &&
    matchesPriority &&
    matchesType &&
    matchesDate &&
    matchesQuery
  );
}

export function filterRequests<T extends FilterableRequest>(
  requests: readonly T[],
  filters: RequestFilterState
): T[] {
  return requests.filter((request) => matchesRequestFilters(request, filters));
}
