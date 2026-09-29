export type BrandKey =
  | "pizza-hut"
  | "china-wok"
  | "dennys"
  | "kfc";

export interface BrandLocalesConfig {
  /** Número de local más bajo que existe para la marca. */
  min: number;
  /** Número de local más alto que existe para la marca (inclusive). */
  max: number;
  /**
   * Locales que NO existen para la marca. Ej. MongoDB/docs de la empresa:
   * Pizza Hut no tiene Local 13; KFC no tiene Local 13.
   */
  excluded?: number[];
  /**
   * Nombres/marcas que mapean a esta configuración (normalizados, sin
   * tildes ni apóstrofos, en minúsculas). Incluye alias para resolver
   * variaciones como "Denny's", "DENNYS" o "Kentucky Fried Chicken".
   */
  aliases: string[];
}

/**
 * Catálogo de locales válidos por marca de restaurante.
 *
 * IMPORTANTE:
 * - Es SOLO una configuración de validación; NO crea ni asigna locales.
 * - No debe usarse para "inventar" el número de local de un equipo.
 * - Si el equipo no tiene un local real asociado, la línea "Local X" NO
 *   debe imprimirse.
 */
export const BRAND_LOCALES: Record<BrandKey, BrandLocalesConfig> = {
  "pizza-hut": {
    min: 1,
    max: 78,
    excluded: [13],
    aliases: ["pizzahut", "pizza hut", "pizza hut express", "ph"],
  },
  "china-wok": {
    min: 1,
    max: 5,
    aliases: ["chinawok", "china wok", "china wok express", "cw"],
  },
  dennys: {
    min: 1,
    max: 7,
    aliases: ["dennys", "denny's", "dennys express"],
  },
  kfc: {
    min: 1,
    max: 30,
    excluded: [13],
    aliases: ["kfc", "kentucky fried chicken", "kfcexpress"],
  },
};

function normalizeBrandName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function brandKeyFor(name: string | null | undefined): BrandKey | undefined {
  if (!name) return undefined;
  const normalized = normalizeBrandName(name);
  const entry = (Object.keys(BRAND_LOCALES) as BrandKey[]).find((key) =>
    BRAND_LOCALES[key].aliases.includes(normalized)
  );
  return entry;
}

export function isValidLocal(
  key: BrandKey,
  local: number | null | undefined
): boolean {
  if (local === null || local === undefined) return false;
  if (!Number.isInteger(local)) return false;
  const config = BRAND_LOCALES[key];
  if (local < config.min) return false;
  if (local > config.max) return false;
  if (config.excluded?.includes(local)) return false;
  return true;
}

/**
 * Devuelve el texto para la línea "Local X" de la etiqueta, o `null` si el
 * local no existe o no corresponde a la marca. Nunca inventa un local.
 */
export function localLabel(
  key: BrandKey,
  local: number | null | undefined
): string | null {
  if (!isValidLocal(key, local)) return null;
  return `Local ${local}`;
}

/** Todos los locales válidos para una marca (p. ej. [1..12, 14..78]). */
export function allLocalesFor(key: BrandKey): number[] {
  const config = BRAND_LOCALES[key];
  const excluded = new Set(config.excluded ?? []);
  const result: number[] = [];
  for (let n = config.min; n <= config.max; n += 1) {
    if (!excluded.has(n)) result.push(n);
  }
  return result;
}

/**
 * Interpreta un valor del campo sector/local en un número local real.
 * Acepta "Local 7", "LOCAL 7", "7" o "07". Devuelve `null` si el valor no
 * describe un local (p. ej. "Cocina", "Caja", "Despacho").
 */
export function parseLocalValue(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(?:local\s*)?(\d{1,3})$/i.exec(trimmed);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}
