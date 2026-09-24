export interface MonochromeBitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface GfaGraphic {
  bytesPerRow: number;
  rows: number;
  hex: string;
}

export function encodeGfaHex(
  width: number,
  height: number,
  pixels: Uint8Array,
  isBlack: number = 255
): GfaGraphic {
  const rawBytesPerRow = Math.ceil(width / 8);
  const bytesPerRow = rawBytesPerRow % 2 === 0 ? rawBytesPerRow : rawBytesPerRow + 1;
  const rows = height;
  const bytes = new Uint8Array(rows * bytesPerRow);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < width; c += 1) {
      if (pixels[r * width + c] === isBlack) {
        const byteIndex = r * bytesPerRow + (c >> 3);
        bytes[byteIndex] |= 0x80 >> (c & 7);
      }
    }
  }
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return { bytesPerRow, rows, hex };
}

export function gfaCommand(
  x: number,
  y: number,
  graphic: GfaGraphic
): string {
  const totalBytes = graphic.bytesPerRow * graphic.rows;
  return `^FO${x},${y}^GFA,H,${totalBytes},${graphic.bytesPerRow},${graphic.rows},${graphic.hex}^FS`;
}