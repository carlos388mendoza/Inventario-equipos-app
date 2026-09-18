export interface RestaurantDto {
  id: string;
  name: string;
  code: string;
  address: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}