import type { LifecycleInfo } from "@/lib/equipment/lifecycle";

export interface EquipmentDto {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  equipmentTypeId: string;
  restaurantId: string;
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
  lifecycle: LifecycleInfo;
  hasLabel: boolean;
}