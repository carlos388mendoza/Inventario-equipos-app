export const LABEL_WIDTH_MM = 50.8;
export const LABEL_HEIGHT_MM = 25.4;
export const DOTS_PER_MM = 8;
export const LABEL_WIDTH = Math.round(LABEL_WIDTH_MM * DOTS_PER_MM);
export const LABEL_HEIGHT = Math.round(LABEL_HEIGHT_MM * DOTS_PER_MM);
export const MARGIN = 14;
export const QR_X = 14;
export const CONTENT_X = 186;
export const CONTENT_END = 392;
export const LOGO_MAX_WIDTH = 96;
export const LOGO_MAX_HEIGHT = 40;
export const NAME_CHAR_SIZE = 20;
export const NAME_LINE_HEIGHT = 23;
export const NAME_MAX_LINES = 2;
export const TYPE_CHAR_SIZE = 16;
export const TYPE_LINE_HEIGHT = 18;
export const TYPE_MAX_LINES = 2;
export const DATE_CHAR_SIZE = 12;
export const ASSET_CHAR_SIZE = 12;

export const TEXT_POSITIONS = {
  logo: { x: CONTENT_X, y: 14 },
  name: { x: CONTENT_X, y: 60 },
  type: { x: CONTENT_X, y: 104 },
  date: { x: CONTENT_X, y: 140 },
  asset: { x: CONTENT_X, y: 156 },
} as const;

export function sanitizeZplText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\^/g, " ")
    .replace(/~/g, " ")
    .trim();
}

export function truncateToWidth(
  text: string,
  maxWidthPx: number,
  charSizePx: number
): string {
  const charWidth = Math.max(1, Math.round(charSizePx * 0.6));
  const maxChars = Math.max(1, Math.floor(maxWidthPx / charWidth));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

export function wrapToLines(
  text: string,
  maxWidthPx: number,
  charSizePx: number,
  maxLines: number
): string[] {
  const charWidth = Math.max(1, Math.round(charSizePx * 0.6));
  const maxChars = Math.max(1, Math.floor(maxWidthPx / charWidth));
  if (maxLines <= 1) return [truncateToWidth(text, maxWidthPx, charSizePx)];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === 0) lines.push("");
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].length > maxChars) {
      lines[i] = truncateToWidth(lines[i], maxWidthPx, charSizePx);
    }
  }
  return lines;
}

export function formatPrintDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date
    .toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "");
}