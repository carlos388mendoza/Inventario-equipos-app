/**
 * Piezas puras del flujo de generación de etiquetas (issue #34).
 *
 * Aquí vive lo que se puede probar sin base de datos ni React: cómo se describe
 * un equipo con relaciones incompletas y cómo se resume un lote que falla en
 * parte. La consulta y la acción de servidor usan estas funciones para que el
 * mensaje que ve la persona sea el mismo en cualquier punto del flujo.
 */

/** Relación del equipo que falta para poder emitir su etiqueta. */
export type LabelRelationIssue = "TYPE" | "RESTAURANT";

const MISSING_RELATION_TEXT: Record<LabelRelationIssue, string> = {
  TYPE: "un tipo de equipo",
  RESTAURANT: "un restaurante",
};

/**
 * Mensaje accionable para un equipo cuya relación está incompleta: dice QUÉ
 * equipo es (su `assetCode`) y QUÉ falta exactamente, sin inventar datos ni
 * generar una etiqueta sin identidad.
 */
export function describeIncompleteLabel(
  assetCode: string,
  issues: readonly LabelRelationIssue[]
): string {
  const items = issues.map((issue) => MISSING_RELATION_TEXT[issue]);
  const list =
    items.length > 1
      ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
      : items[0];
  return `No se puede generar la etiqueta de "${assetCode}": le falta ${list}. Corrige la relación del equipo y vuelve a intentarlo.`;
}

/** Resultado por equipo del lote, con el id que lo identifica. */
export interface SettledLabelEntry {
  equipmentId: string;
  settled: PromiseSettledResult<{
    ok: boolean;
    error?: string;
    assetCode?: string;
  }>;
}

/** Un equipo del lote que no pudo generar su etiqueta. */
export interface BatchFailure {
  equipmentId: string;
  assetCode: string;
  message: string;
}

/**
 * Separa de un lote los equipos que fallaron y traduce cada fallo a un mensaje
 * con el `assetCode` del equipo. Un rechazo de la promesa (excepción del
 * servidor) no cancela el resto: aquí solo se describe.
 */
export function collectBatchFailures(
  entries: readonly SettledLabelEntry[],
  assetCodeById: ReadonlyMap<string, string>
): BatchFailure[] {
  const failures: BatchFailure[] = [];
  for (const { equipmentId, settled } of entries) {
    if (settled.status === "fulfilled" && settled.value.ok) continue;
    const assetCode =
      assetCodeById.get(equipmentId) ??
      (settled.status === "fulfilled" ? settled.value.assetCode : undefined) ??
      equipmentId;
    const message =
      settled.status === "fulfilled"
        ? settled.value.error ?? "No se pudo generar la etiqueta."
        : "Fallo inesperado al generar la etiqueta.";
    failures.push({ equipmentId, assetCode, message });
  }
  return failures;
}
