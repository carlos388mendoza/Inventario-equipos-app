import type { RequestPriority, RequestStatus } from "@/lib/db/enums";

export interface RequestDto {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantBrand: string | null;
  restaurantSector: string | null;
  restaurantLogo: string | null;
  requestedById: string;
  requestedByName: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  currentEquipmentId: string | null;
  currentEquipmentAssetCode: string | null;
  reason: string;
  description: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestHistoryDto {
  id: string;
  requestId: string;
  oldStatus: RequestStatus | null;
  newStatus: RequestStatus;
  comment: string | null;
  performedByName: string | null;
  createdAt: Date;
}

export interface RestaurantSelectOption {
  id: string;
  name: string;
  code: string;
}

export interface EquipmentSelectOption {
  id: string;
  assetCode: string;
  restaurantId: string;
  equipmentTypeId: string;
}