/**
 * Índice activo para listas navegables con teclado (paleta de comandos y
 * selector múltiple).
 *
 * Centraliza el cálculo para que el índice NUNCA quede fuera de rango cuando la
 * lista filtrada cambia de tamaño mientras el usuario escribe o navega con las
 * flechas (robustez pedida en la revisión). No depende del DOM, así que se puede
 * probar en Node.
 */

/**
 * Ajusta `index` al rango válido `[0, length)`. Devuelve `-1` si la lista está
 * vacía. Los valores negativos o no finitos se normalizan a `0`.
 */
export function resolveActiveIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.trunc(index), length - 1);
}

/**
 * Mueve el índice activo `delta` posiciones con envoltura circular dentro de una
 * lista de `length` elementos (por ejemplo, `delta` 1 = abajo, -1 = arriba).
 * Devuelve `-1` si la lista está vacía.
 */
export function moveActiveIndex(
  index: number,
  length: number,
  delta: number
): number {
  if (length <= 0) return -1;
  const current = resolveActiveIndex(index, length);
  return (current + delta + length) % length;
}
