export interface TechnicianDto {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedRestaurantIds: string[];
}

export interface RestaurantOptionDto {
  id: string;
  name: string;
  code: string;
}