import { RestaurantIdentity } from "@/components/restaurants/restaurant-identity";
import { formatDate } from "@/lib/utils";

export interface LabelPreviewData {
  qrDataUrl: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantLogo: string | null;
  installationDate: Date | null;
  createdAt: Date;
}

export function LabelPreview({ data }: { data: LabelPreviewData }) {
  const date = data.installationDate ?? data.createdAt;
  const dateLabel = data.installationDate ? "Instalación" : "Generación";

  return (
    <div className="grid aspect-[2/1] grid-cols-2 overflow-hidden rounded-lg border bg-white text-neutral-900 shadow-sm">
      <div className="flex items-center justify-center bg-neutral-50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.qrDataUrl}
          alt="Código QR de la etiqueta"
          className="aspect-square max-h-full max-w-full object-contain"
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-1 border-l border-dashed border-neutral-300 p-4">
        <div className="min-w-0">
          <RestaurantIdentity
            restaurant={{
              name: data.restaurantName,
              logo: data.restaurantLogo,
            }}
            size="md"
            showSector={false}
          />
        </div>
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {data.typeName}
        </p>
        <p className="text-xs text-neutral-600">
          {dateLabel}: {formatDate(date)}
        </p>
        <p className="truncate font-mono text-[10px] text-neutral-400">
          {data.assetCode}
        </p>
      </div>
    </div>
  );
}