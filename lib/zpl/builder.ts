import QRCode from "qrcode";
import { ZPL_LOGO_GRAPHICS, type ZplLogoGraphic } from "./graphics.generated";
import { gfaCommand } from "./gfa";
import {
  LABEL_WIDTH,
  LABEL_HEIGHT,
  MARGIN,
  QR_X,
  VERTICAL_BIAS,
  LOGO_GAP,
  LOGO_AREA_END,
  sanitizeZplText,
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
  // Centrado vertical y luego desplazado hacia abajo, sin salirse de la etiqueta.
  const y = Math.max(
    0,
    Math.min(
      LABEL_HEIGHT - side,
      Math.floor((LABEL_HEIGHT - side) / 2) + VERTICAL_BIAS
    )
  );
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

  // La etiqueta solo lleva QR + logo. El area del logo arranca justo despues
  // del QR (para seguirle el ritmo) y termina en el margen derecho.
  const graphic = logoGraphicFor(data.restaurantLogo);
  if (graphic) {
    const areaX = QR_X + qr.side + LOGO_GAP;
    const areaWidth = Math.max(1, LOGO_AREA_END - areaX);
    const logoX = areaX + Math.max(0, Math.round((areaWidth - graphic.width) / 2));
    const logoY = Math.max(
      0,
      Math.round((LABEL_HEIGHT - graphic.height) / 2) + VERTICAL_BIAS
    );
    lines.push(gfaCommand(logoX, logoY, graphic));
  }

  lines.push("^XZ");
  return `${lines.join("\n")}\n`;
}
