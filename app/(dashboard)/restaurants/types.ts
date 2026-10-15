export interface RestaurantDto {
  id: string;
  name: string;
  code: string;
  address: string | null;
  brand: string | null;
  sector: string | null;
  logo: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
