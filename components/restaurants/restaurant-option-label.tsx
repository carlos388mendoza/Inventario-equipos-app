import { cn } from "@/lib/utils";
import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";

/**
 * Opción de unidad para selectores y celdas: logo de la marca + nombre y código.
 *
 * Envuelve `RestaurantIdentity` en modo `logoOnly` para no duplicar la lógica de
 *logos (incluido el recorte medido de `dennys.png`). El texto conserva el formato
 * "Nombre (CÓDIGO)" que ya usaban los selectores, de modo que el valor elegido
 * sigue siendo legible también donde no se ve el logo.
 */
export function RestaurantOptionLabel({
  restaurant,
  className,
}: {
  restaurant: { name: string; code: string; logo: string | null };
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <RestaurantIdentity
        restaurant={restaurant}
        size="xs"
        logoOnly
        showSector={false}
      />
      <span className="truncate">
        {restaurant.name} ({restaurant.code})
      </span>
    </span>
  );
}
