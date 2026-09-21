export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  restaurantId: string | null;
  restaurantName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestaurantOption {
  id: string;
  name: string;
  code: string;
  active: boolean;
}
