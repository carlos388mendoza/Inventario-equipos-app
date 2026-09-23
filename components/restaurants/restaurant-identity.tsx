"use client";

import { cn } from "@/lib/utils";
import { Store } from "lucide-react";
import * as React from "react";

/** Datos mínimos que necesita la identidad de una unidad (restaurante/marca). */
export interface RestaurantIdentityData {
  name: string;
  brand?: string | null;
  sector?: string | null;
  logo?: string | null;
}

const SIZES = {
  sm: { box: "h-8 w-8", img: "h-8 w-8", text: "text-xs" },
  md: { box: "h-10 w-10", img: "h-10 w-10", text: "text-sm" },
  lg: { box: "h-14 w-14", img: "h-14 w-14", text: "text-base" },
  xl: { box: "h-20 w-20", img: "h-20 w-20", text: "text-lg" },
} as const;

export type IdentitySize = keyof typeof SIZES;

interface RestaurantIdentityProps {
  restaurant: RestaurantIdentityData;
  size?: IdentitySize;
  /** Si es true muestra solo el logo (sin nombre ni sector). */
  logoOnly?: boolean;
  showSector?: boolean;
  className?: string;
}

export function RestaurantIdentity({
  restaurant,
  size = "md",
  logoOnly = false,
  showSector = true,
  className,
}: RestaurantIdentityProps) {
  const s = SIZES[size];
  const title = restaurant.brand && restaurant.brand !== restaurant.name
    ? restaurant.name + " · " + restaurant.brand
    : restaurant.name;
  const [imgError, setImgError] = React.useState(false);

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {restaurant.logo && !imgError ? (
        // Los logos pueden ser URLs arbitrarias del restaurante; mantener <img>.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={restaurant.logo}
          alt={"Logo de " + title}
          width={80}
          height={80}
          className={cn("shrink-0 rounded-lg object-contain", s.img, "bg-muted p-0.5")}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            s.box
          )}
          aria-hidden
        >
          <Store className="h-1/2 w-1/2" />
        </div>
      )}
      {!logoOnly && (
        <div className="min-w-0">
          <p className={cn("truncate font-semibold leading-tight", s.text)} title={title}>
            {restaurant.name}
          </p>
          {showSector && restaurant.sector && (
            <p className="truncate text-xs text-muted-foreground">{restaurant.sector}</p>
          )}
        </div>
      )}
    </div>
  );
}
