export interface LabelDto {
  id: string;
  equipmentId: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantBrand: string | null;
  restaurantSector: string | null;
  restaurantLogo: string | null;
  token: string;
  url: string;
  qrDataUrl: string;
  createdAt: Date;
  installationDate: Date | null;
}

export interface LabelRestaurantOption {
  id: string;
  name: string;
  code: string;
}

export interface LabelEquipmentOption {
  id: string;
  assetCode: string;
  restaurantId: string;
}