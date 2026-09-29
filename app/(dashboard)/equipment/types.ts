import type { LifecycleInfo } from "@/lib/equipment/lifecycle";

export interface EquipmentDto {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  equipmentTypeId: string;
  restaurantId: string;
  /** Propietario real; distinto de `restaurantId` mientras hay préstamo. */
  ownerRestaurantId?: string | null;
  brand: string | null;
  model: string | null;
  purchaseDate: Date | null;
  installationDate: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentListItem extends EquipmentDto {
  equipmentTypeName: string;
  restaurantName: string;
  restaurantCode: string;
  restaurantBrand?: string | null;
  restaurantSector?: string | null;
  restaurantLogo?: string | null;
  /** Nombre y código de la unidad propietaria, si el equipo está prestado. */
  ownerRestaurantName?: string | null;
  ownerRestaurantCode?: string | null;
  /** `true` si el equipo está en préstamo (propietario ≠ ubicación). */
  isOnLoan?: boolean;
  /** Código del equipo del que se hizo esta copia, si aplica. */
  originAssetCode?: string | null;
  /** Código del equipo que sustituyó a este, si aplica. */
  replacedByAssetCode?: string | null;
  lifecycle: LifecycleInfo;
  hasLabel: boolean;
}