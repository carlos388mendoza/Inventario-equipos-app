import type { LabelRelationIssue } from "@/lib/labels/label-generation";

/**
 * Auditoría de las relaciones que necesita una etiqueta (issue #34).
 *
 * La generación usa JOIN exteriores sobre `equipment_types` y `restaurants`
 * precisamente para poder decir qué falta cuando la relación está rota. Este
 * módulo reutiliza esa misma lectura, pero sobre TODO el inventario, para poder
 * listar de antemano los equipos que fallarían ("solo funciona con algunos
 * equipos") sin tocar nada: solo clasifica filas ya unidas.
 */

/** Fila de equipo ya unida con su tipo y su restaurante (o `null` si faltan). */
export interface EquipmentRelationRow {
  id: string;
  assetCode: string;
  /** `null` si el equipo apunta a un tipo que ya no existe. */
  typeName: string | null;
  /** `null` si el equipo apunta a un restaurante que ya no existe. */
  restaurantName: string | null;
  /** `null` si falta el restaurante; `false` si la unidad está retirada. */
  restaurantActive: boolean | null;
}

/** Equipo al que le falta el tipo, el restaurante o ambos. */
export interface EquipmentRelationProblem {
  id: string;
  assetCode: string;
  issues: LabelRelationIssue[];
}

/**
 * Equipos cuya relación está rota: no se les puede emitir etiqueta con la
 * lectura actual. Es exactamente el conjunto que `generateSecurityLabel`
 * rechazaría con "no se encontró el equipo".
 */
export function findEquipmentRelationProblems(
  rows: readonly EquipmentRelationRow[]
): EquipmentRelationProblem[] {
  const problems: EquipmentRelationProblem[] = [];
  for (const row of rows) {
    const issues: LabelRelationIssue[] = [];
    if (row.typeName === null) issues.push("TYPE");
    if (row.restaurantName === null) issues.push("RESTAURANT");
    if (issues.length > 0) {
      problems.push({ id: row.id, assetCode: row.assetCode, issues });
    }
  }
  return problems;
}

/** Equipo cuya unidad existe pero está retirada (no aparece en el selector). */
export interface EquipmentInactiveUnit {
  id: string;
  assetCode: string;
  restaurantName: string;
}

/**
 * Equipos que siguen apuntando a una unidad retirada (`active = false`). La
 * relación no está rota, pero el diálogo solo ofrece unidades activas, así que
 * estos equipos no se pueden elegir para generar en lote.
 */
export function findEquipmentInInactiveUnits(
  rows: readonly EquipmentRelationRow[]
): EquipmentInactiveUnit[] {
  const result: EquipmentInactiveUnit[] = [];
  for (const row of rows) {
    if (row.restaurantName !== null && row.restaurantActive === false) {
      result.push({
        id: row.id,
        assetCode: row.assetCode,
        restaurantName: row.restaurantName,
      });
    }
  }
  return result;
}
