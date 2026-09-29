import type { EquipmentMovementType, EquipmentStatus } from "@/lib/db/enums";

/** Fila del libro de movimientos, tal como la consume la tabla. */
export interface MovementRow {
  id: string;
  batchId: string;
  type: EquipmentMovementType;
  assetCode: string;
  equipmentTypeName: string;
  fromName: string | null;
  fromCode: string | null;
  /** Logo de la unidad de origen, para la identidad visual del libro. */
  fromLogo: string | null;
  toName: string | null;
  toCode: string | null;
  /** Logo de la unidad de destino. */
  toLogo: string | null;
  /** Código del equipo par: el original en una copia, el sustituido en una sustitución. */
  counterpartAssetCode: string | null;
  reason: string | null;
  notes: string | null;
  performedByName: string | null;
  createdAt: Date;
}

/** Un equipo de la lista de origen, para elegir a quién mover. */
export interface MovableEquipmentOption {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  typeName: string;
  restaurantId: string;
  restaurantName: string;
  restaurantCode: string;
  /** Logo de la unidad dueña del equipo. */
  restaurantLogo: string | null;
  ownerRestaurantId: string | null;
  ownerRestaurantName: string | null;
  /** Logo de la unidad propietaria cuando el equipo está en préstamo. */
  ownerRestaurantLogo: string | null;
  status: EquipmentStatus;
  isOnLoan: boolean;
}

/** Lote de movimientos tal como se muestra agrupado en la vista. */
export interface MovementBatchSummary {
  batchId: string;
  type: EquipmentMovementType;
  createdAt: Date;
  performedByName: string | null;
  count: number;
  reason: string | null;
}

export interface RestaurantOption {
  id: string;
  name: string;
  code: string;
  /** Logo de la marca, para los selectores de unidad. */
  logo: string | null;
}
