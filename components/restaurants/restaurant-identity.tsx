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
  xs: "h-5 w-5",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
} as const;

export type IdentitySize = keyof typeof SIZES;

/**
 * Caja de contenido de cada logo, MEDIDA sobre el archivo y no estimada a ojo.
 *
 * Los cuatro logos de marca vienen con márgenes muy distintos: `kfc.svg` y
 * `china-wok.svg` van casi a pelo, pero `dennys.png` arrastra un 20.8% de aire
 * arriba y abajo y un 11.5% a los lados, y `pizza-hut.jpg` un 26% a cada lado.
 *
 * Con `object-contain` en una caja cuadrada, ese aire se dibuja también: el logo
 * de Pizza Hut ocupaba menos de la mitad del ancho de su caja y el de KFC casi
 * todo, o sea, cuatro marcas con cuatro tamaños distintos en la misma columna.
 * Recortar el margen con `clip-path` NO lo arreglaba, porque recortar no
 * reescala: el logo seguía midiendo lo mismo, solo dejaba de aire alrededor.
 *
 * Aquí se mide el recuadro de contenido de cada archivo y se escala para que ese
 * recuadro sea el que llena la caja. `width` y `height` salen del mismo factor
 * (canvas / lado mayor del contenido), así que la imagen nunca se deforma; `left`
 * lo centra en horizontal y `top` además lo centra en vertical, para que las
 * marcas de distintas alturas queden ópticamente alineadas en la misma fila.
 *
 * Si algún día se regenera un logo hay que volver a medirlo; si deja de coincidir,
 * la entrada sobra y se borra. Los logos que no estén en la tabla (URLs
 * arbitrarias) siguen cayendo en `object-contain`, que es el comportamiento
 * neutro. Solo afecta a la presentación en pantalla: la impresión de etiquetas
 * tiene su propio render en `components/labels/label-preview.tsx`.
 */
interface LogoFit {
  /** % del lado de la caja. */
  width: number;
  height: number;
  left: number;
  top: number;
}

const LOGO_FIT: Record<string, LogoFit> = {
  // content 570x527 sobre render 600x557
  "kfc.svg": { width: 105.3, height: 97.7, left: -2.8, top: 0.8 },
  // content 462x234 sobre render 600x400
  "dennys.png": { width: 129.9, height: 86.6, left: -14.9, top: 6.7 },
  // content 285x239 sobre render 600x337
  "pizza-hut.jpg": { width: 210.5, height: 118.2, left: -55.4, top: -9.1 },
  // content 600x485 sobre render 600x487
  "china-wok.svg": { width: 100, height: 81.2, left: 0, top: 9.3 },
};

/** Identifica un logo por su nombre de archivo, sea local o remoto. */
function fitFor(src: string): LogoFit | undefined {
  const name = src.split("?")[0].split("/").pop();
  return name ? LOGO_FIT[name] : undefined;
}

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
  const fit = restaurant.logo ? fitFor(restaurant.logo) : undefined;

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {restaurant.logo && !imgError ? (
        // La caja es cuadrada. Un logo medido se escala para que su contenido la
        // llene; uno desconocido usa `object-contain`. Ninguno se deforma ni se
        // estira. Sin fondo gris porque un logo transparente sobre una placa de
        // color se ve sucio.
        <div className={cn("relative shrink-0 overflow-hidden", s)}>
          {/* Los logos pueden ser URLs arbitrarias del restaurante; mantener <img>. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={restaurant.logo}
            alt={"Logo de " + title}
            className={fit ? "absolute max-w-none" : "h-full w-full object-contain"}
            style={
              fit
                ? {
                    width: `${fit.width}%`,
                    height: `${fit.height}%`,
                    left: `${fit.left}%`,
                    top: `${fit.top}%`,
                  }
                : undefined
            }
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            s
          )}
          aria-hidden
        >
          <Store className="h-1/2 w-1/2" />
        </div>
      )}
      {!logoOnly && (
        <div className="min-w-0">
          <p
            className={cn(
            "truncate font-semibold leading-tight",
            size === "xs" && "text-xs",
            size === "sm" && "text-xs",
              size === "md" && "text-sm",
              size === "lg" && "text-base",
              size === "xl" && "text-lg"
            )}
            title={title}
          >
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
