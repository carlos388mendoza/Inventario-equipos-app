import { type BatchFailure } from "@/lib/labels/label-generation";

/**
 * Fallos de un lote de etiquetas, uno por equipo.
 *
 * Es puramente presentacional y se pinta SIEMPRE que haya fallos: da igual si
 * el lote fallo solo en parte (hay exitos encima) o si fallo entero. Cada linea
 * lleva el codigo del equipo y su mensaje, de modo que el aviso generico no
 * eclipse el detalle por equipo (issue #34).
 */
export function BatchFailures({ failures }: { failures: BatchFailure[] }) {
  if (failures.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">
        No se pudieron generar {failures.length} etiqueta(s):
      </p>
      <ul className="list-disc space-y-1 pl-5 text-destructive">
        {failures.map((failure) => (
          <li key={failure.equipmentId}>
            <span className="font-medium">{failure.assetCode}</span>:{" "}
            {failure.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
