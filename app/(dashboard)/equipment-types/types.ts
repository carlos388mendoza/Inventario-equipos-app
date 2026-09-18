export interface EquipmentTypeDto {
  id: string;
  name: string;
  description: string | null;
  usefulLifeMonths: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}