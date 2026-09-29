/**
 * Secuencia de impresión por lotes, sin React ni navegador.
 *
 * Vive aparte del componente para poder probar las garantías que importan:
 * orden fijo, una etiqueta fallida no se reintenta sola, y el corte de la cola
 * informa cuántas salieron antes del error.
 */

export interface QueueItem {
  assetCode: string;
  zpl: string;
}

export type QueueOutcome =
  | { status: "done"; sent: number; total: number }
  | {
      status: "stopped";
      sent: number;
      total: number;
      failedLabel: string;
      reason: string;
    };

/**
 * Envía las etiquetas en orden, una por vez.
 *
 * - `items` se recorre tal cual: el orden lo fija quien arma la cola, y un
 *   re-render no lo altera porque la lista ya viene copiada.
 * - Ante un fallo se DETIENE. Seguir enviando después de un error dejaría un
 *   lote a medias sin saber qué salió; en su lugar se informa cuántas salieron
 *   y en cuál se cortó.
 */
export async function runPrintQueue(
  items: readonly QueueItem[],
  send: (zpl: string) => Promise<void>,
  onProgress: (index: number, total: number) => void,
  describeError: (error: unknown) => string
): Promise<QueueOutcome> {
  const total = items.length;
  let sent = 0;

  for (let index = 0; index < total; index++) {
    const item = items[index];
    if (!item) continue;
    onProgress(index, total);
    try {
      await send(item.zpl);
      sent++;
    } catch (error) {
      return {
        status: "stopped",
        sent,
        total,
        failedLabel: item.assetCode,
        reason: describeError(error),
      };
    }
  }

  return { status: "done", sent, total };
}
