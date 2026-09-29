import {
  LABEL_WIDTH,
  LABEL_HEIGHT,
  QR_X,
  LOGO_GAP,
  LOGO_AREA_END,
  LOGO_MAX_WIDTH,
  LOGO_MAX_HEIGHT,
  VERTICAL_BIAS,
} from "@/lib/zpl/layout";

export interface LabelPreviewData {
  qrDataUrl: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantLogo: string | null;
  installationDate?: string | Date | null;
  createdAt: string | Date;
}

/**
 * Lado del QR en las etiquetas fisicas: 45 modulos x magnificacion 3. Es el
 * caso real de produccion (URL publica de 76 chars). La preview no recalcula
 * el QR porque solo pinta el data URL que le pasa el servidor; el valor queda
 * fijado aqui y verificado en lib/zpl/builder.test.ts.
 */
const QR_SIDE_DOTS = 135;

const pct = (dots: number, total: number) => (dots / total) * 100;

/**
 * Reproduce el layout fisico de la etiqueta (406 x 203 dots): QR | LOGO.
 *
 * La etiqueta ya no imprime texto, asi que no hay columna central reservada.
 * La geometria se deriva de lib/zpl/layout.ts con la misma cuenta que hace
 * buildZpl, de modo que preview y ZPL comparten una unica fuente de verdad.
 */
export function LabelPreview({ data }: { data: LabelPreviewData }) {
  const qrY = Math.max(
    0,
    Math.min(
      LABEL_HEIGHT - QR_SIDE_DOTS,
      Math.floor((LABEL_HEIGHT - QR_SIDE_DOTS) / 2) + VERTICAL_BIAS
    )
  );

  // Area disponible para el logo: desde despues del QR hasta el margen derecho.
  const areaX = QR_X + QR_SIDE_DOTS + LOGO_GAP;
  const areaWidth = LOGO_AREA_END - areaX;
  // Caja maxima centrada dentro de ese area (identico al logoX de buildZpl).
  const logoBoxX = areaX + Math.max(0, (areaWidth - LOGO_MAX_WIDTH) / 2);
  const logoBoxY = (LABEL_HEIGHT - LOGO_MAX_HEIGHT) / 2 + VERTICAL_BIAS;

  return (
    <div className="relative aspect-[406/203] w-full overflow-hidden rounded-lg border bg-white shadow-sm">
      {/* QR a la izquierda */}
      <div
        className="absolute flex items-center justify-center bg-neutral-50"
        style={{
          left: `${pct(QR_X, LABEL_WIDTH)}%`,
          top: `${pct(qrY, LABEL_HEIGHT)}%`,
          width: `${pct(QR_SIDE_DOTS, LABEL_WIDTH)}%`,
          height: `${pct(QR_SIDE_DOTS, LABEL_HEIGHT)}%`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.qrDataUrl}
          alt="Código QR de la etiqueta"
          className="aspect-square max-h-full max-w-full object-contain"
        />
      </div>

      {/* Logo a la derecha, con la caja maxima de 194x110 centrada en su area */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: `${pct(logoBoxX, LABEL_WIDTH)}%`,
          top: `${pct(logoBoxY, LABEL_HEIGHT)}%`,
          width: `${pct(LOGO_MAX_WIDTH, LABEL_WIDTH)}%`,
          height: `${pct(LOGO_MAX_HEIGHT, LABEL_HEIGHT)}%`,
        }}
      >
        {data.restaurantLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.restaurantLogo}
            alt={`Logo de ${data.restaurantName}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : null}
      </div>
    </div>
  );
}
