export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  restaurantId: string | null;
  restaurantName: string | null;
  /** Restaurantes asignados a un técnico (issues #11/#16). */
  assignedRestaurantIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RestaurantOption {
  id: string;
  name: string;
  code: string;
  active: boolean;
}
