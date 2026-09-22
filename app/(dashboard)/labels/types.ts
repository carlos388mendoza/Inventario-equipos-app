export interface LabelDto {
  id: string;
  equipmentId: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  token: string;
  url: string;
  qrDataUrl: string;
  createdAt: Date;
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