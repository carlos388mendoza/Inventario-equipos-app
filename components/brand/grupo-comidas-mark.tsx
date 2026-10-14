import { cn } from "@/lib/utils";

/**
 * Emblema circular de Grupo Comidas.
 *
 * `public/logo-grupo-comidas.png` es un lockup horizontal de 1399x501 (2.79:1)
 * con dos líneas: el emblema y el wordmark "GRUPO COMIDAS" arriba, y una segunda
 * línea de texto abajo. Trae el fondo horneado en el archivo (colorType 2, sin
 * canal alfa), de color #F7F7F7 (RGB 247,247,247), así que no se puede
 * transparentar ni recortar en build sin reexportar el asset.
 *
 * Se muestra el asset ENTERO con `object-contain`: mantiene la proporción
 * original sin deformar, sin estirar y sin cortar nada. La placa del círculo usa
 * exactamente #F7F7F7, el mismo valor del fondo horneado, de modo que el
 * bandeado que deja `object-contain` se funde con la placa y no se ve costura
 * rectangular. El `padding` es el aire entre el logo y el borde del círculo y se
 * mantiene alineado con los iconos generados por `scripts/generate-icons.mjs`
 * (logo al 80% del lado). El anillo `ring-[#D4D4D8]` hace que el círculo se
 * perciba también sobre fondos claros, igual que en el favicon.
 *
 * Límite medido y asumido: un lockup de 2.79:1 dentro de un círculo ocupa como
 * banda horizontal. A 40 px de lado la banda mide ~32x11 px, así que el wordmark
 * se ve como una firma compacta, no como texto legible. Cabe dentro del círculo
 * sin deformarse, que es lo que se pidió, pero un círculo con el wordmark legible
 * requeriría un asset cuadrado o circular que aquí no existe y no se puede crear
 * sin tocar el PNG de producción.
 */
export function GrupoComidasMark({
  className,
  size = 40,
}: {
  className?: string;
  /** Lado del círculo en píxeles. */
  size?: number;
}) {
  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-full bg-[#F7F7F7] ring-1 ring-[#D4D4D8]",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-grupo-comidas.png"
        alt="Grupo Comidas"
        className="h-full w-full object-contain object-center"
        style={{ padding: "10%" }}
      />
    </span>
  );
}
