import { cn } from "@/lib/utils";

/**
 * Emblema circular de Grupo Comidas.
 *
 * `public/logo-grupo-comidas.png` es un lockup horizontal de 1399x501 (2.79:1) con
 * dos líneas: el emblema y el wordmark "GRUPO COMIDAS" arriba, y una segunda
 * línea de texto abajo. Trae el fondo blanco horneado en el archivo (colorType 2,
 * sin canal alfa), así que no se puede transparentar ni recortar en build sin
 * reexportar el asset.
 *
 * Antes se recortaba con coordenadas píxel (`left`/`top` en porcentajes) para
 * enseñar solo el emblema, y el resultado era que dentro del círculo solo se leían
 * las iniciales. Aquí ya no hay recorte: se muestra el asset ENTERO con
 * `object-contain`, que es lo que mantiene la proporción original sin deformar,
 * sin estirar y sin cortar nada.
 *
 * El fondo horneado del PNG es blanco y la placa del círculo también, de modo que
 * el bandeado que deja `object-contain` se funde con la placa y el logo se ve
 * centrado sobre un disco blanco, sin caja rectangular visible. El `padding` es
 * el aire entre el logo y el borde del círculo.
 *
 * Límite medido y asumido: un lockup de 2.79:1 dentro de un círculo ocupa como
 * banda horizontal. A 40 px de lado la banda mide 40x14 px, así que el wordmark se
 * ve como una firma compacta, no como texto legible. Cabe dentro del círculo sin
 * deformarse, que es lo que se pidió, pero un círculo con el wordmark legible
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
        "block shrink-0 overflow-hidden rounded-full bg-white",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-grupo-comidas.png"
        alt="Grupo Comidas"
        className="h-full w-full object-contain object-center"
        style={{ padding: "7%" }}
      />
    </span>
  );
}
