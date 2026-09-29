export const LABEL_WIDTH_MM = 50.8;
export const LABEL_HEIGHT_MM = 25.4;
export const DOTS_PER_MM = 8;
export const LABEL_WIDTH = Math.round(LABEL_WIDTH_MM * DOTS_PER_MM);
export const LABEL_HEIGHT = Math.round(LABEL_HEIGHT_MM * DOTS_PER_MM);
export const MARGIN = 14;
export const QR_X = 14;

// Zona izquierda: QR grande
export const QR_ERROR_CORRECTION = "Q";
export const QR_MIN_MAGNIFICATION = 2;
export const QR_MAX_MAGNIFICATION = 10;
export const QR_TARGET_MAGNIFICATION = 3;

/**
 * Empuja la composicion hacia abajo sin pegarla al borde superior. 5 dots son
 * 0.6 mm: perceptible, y aun asi deja 3.6 mm de margen inferior para la Zebra.
 */
export const VERTICAL_BIAS = 5;

// Zona derecha: logo. La etiqueta ya no imprime texto, asi que el logo ocupa
// todo el espacio que deja el QR.
export const LOGO_GAP = 8;
export const LOGO_AREA_END = LABEL_WIDTH - MARGIN;
export const LOGO_MAX_WIDTH = 194;
export const LOGO_MAX_HEIGHT = 110;

export function sanitizeZplText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\^/g, " ")
    .replace(/~/g, " ")
    .trim();
}
