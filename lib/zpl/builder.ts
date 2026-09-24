import QRCode from "qrcode";
import { ZPL_LOGO_GRAPHICS, type ZplLogoGraphic } from "./graphics.generated";
import { gfaCommand } from "./gfa";
import {
  LABEL_WIDTH,
  LABEL_HEIGHT,
  MARGIN,
  QR_X,
  CONTENT_END,
  TEXT_POSITIONS,
  NAME_CHAR_SIZE,
  NAME_LINE_HEIGHT,
  NAME_MAX_LINES,
  TYPE_CHAR_SIZE,
  TYPE_LINE_HEIGHT,
  TYPE_MAX_LINES,
  DATE_CHAR_SIZE,
  ASSET_CHAR_SIZE,
  sanitizeZplText,
  truncateToWidth,
  wrapToLines,
  formatPrintDate,
} from "./layout";

export type { ZplLogoGraphic };

export interface ZplLabelData {
  url: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantSector?: string | null;
  restaurantLogo: string | null;
  installationDate?: string | Date | null;
  createdAt: string | Date;
}

const QR_ERROR_CORRECTION = "Q";
const QR_MAX_MAGNIFICATION = 10;

function qrLayout(url: string): { magnification: number; side: number; y: number } {
  const qr = QRCode.create(url, { errorCorrectionLevel: QR_ERROR_CORRECTION });
  const modules = qr.modules.size;
  const maxDots = Math.min(LABEL_HEIGHT, LABEL_WIDTH) - 2 * MARGIN;
  const magnification = Math.max(
    1,
    Math.min(QR_MAX_MAGNIFICATION, Math.floor(maxDots / modules))
  );
  const side = modules * magnification;
  const y = Math.max(0, Math.floor((LABEL_HEIGHT - side) / 2));
  return { magnification, side, y };
}

export function logoGraphicFor(
  logoPath: string | null | undefined
): ZplLogoGraphic | undefined {
  if (!logoPath) return undefined;
  const clean = logoPath.split(/[?#]/)[0] ?? logoPath;
  const base = clean.split("/").pop() ?? "";
  const slug = base.replace(/\.[^.]+$/, "");
  return ZPL_LOGO_GRAPHICS[slug];
}

function textBlock(
  lines: string[],
  startX: number,
  startY: number,
  charSize: number,
  lineHeight: number
): string[] {
  const output: string[] = [];
  lines.forEach((line, index) => {
    const text = sanitizeZplText(line);
    if (!text) return;
    output.push(`^FO${startX},${startY + index * lineHeight}`);
    output.push(`^A0N,${charSize},${Math.round(charSize * 0.9)}`);
    output.push(`^FD${text}^FS`);
  });
  return output;
}

export function buildZpl(data: ZplLabelData): string {
  const lines: string[] = [];
  lines.push("^XA");
  lines.push(`^PW${LABEL_WIDTH}`);
  lines.push(`^LL${LABEL_HEIGHT}`);
  lines.push("^LS0");
  lines.push("^CI28");

  const url = sanitizeZplText(data.url);
  const qr = qrLayout(url);
  lines.push(`^FO${QR_X},${qr.y}`);
  lines.push(`^BQN,2,${qr.magnification}`);
  lines.push(`^FDQA,${url}^FS`);

  const contentX = QR_X + qr.side + 8;
  const contentWidth = CONTENT_END - contentX;

  const graphic = logoGraphicFor(data.restaurantLogo);
  if (graphic) {
    lines.push(gfaCommand(contentX, TEXT_POSITIONS.logo.y, graphic));
  }

  const nameLines = wrapToLines(
    data.restaurantName,
    contentWidth,
    NAME_CHAR_SIZE,
    NAME_MAX_LINES
  );
  lines.push(
    ...textBlock(
      nameLines,
      contentX,
      TEXT_POSITIONS.name.y,
      NAME_CHAR_SIZE,
      NAME_LINE_HEIGHT
    )
  );

  const typeLines = wrapToLines(
    data.typeName.toUpperCase(),
    contentWidth,
    TYPE_CHAR_SIZE,
    TYPE_MAX_LINES
  );
  lines.push(
    ...textBlock(
      typeLines,
      contentX,
      TEXT_POSITIONS.type.y,
      TYPE_CHAR_SIZE,
      TYPE_LINE_HEIGHT
    )
  );

  const date = data.installationDate ?? data.createdAt;
  const dateLabel = data.installationDate ? "Instalación:" : "Generación:";
  const dateText = `${dateLabel} ${formatPrintDate(date)}`;
  lines.push(
    ...textBlock(
      [truncateToWidth(dateText, contentWidth, DATE_CHAR_SIZE)],
      contentX,
      TEXT_POSITIONS.date.y,
      DATE_CHAR_SIZE,
      0
    )
  );

  const assetText = truncateToWidth(
    sanitizeZplText(data.assetCode),
    contentWidth,
    ASSET_CHAR_SIZE
  );
  lines.push(
    ...textBlock(
      [assetText],
      contentX,
      TEXT_POSITIONS.asset.y,
      ASSET_CHAR_SIZE,
      0
    )
  );

  lines.push("^XZ");
  return `${lines.join("\n")}\n`;
}