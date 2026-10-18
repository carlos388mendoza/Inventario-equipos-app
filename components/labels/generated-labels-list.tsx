"use client";

import * as React from "react";
import { Eye, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Etiqueta recien generada en el dialogo de lote.
 *
 * Conserva tanto los datos de impresion (URL, tipo, restaurante...) como el
 * `qrDataUrl` que pinta la vista previa, de modo que cada accion (imprimir o
 * previsualizar) use los datos de SU propia etiqueta, sin recalcular el QR.
 */
export interface GeneratedLabelItem {
  qrDataUrl: string;
  url: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantSector?: string | null;
  restaurantLogo: string | null;
  installationDate?: string | Date | null;
  createdAt: string | Date;
}

/**
 * Lista de etiquetas recien generadas con una accion de vista previa y otra de
 * impresion por etiqueta. Es puramente presentacional: quien la usa decide que
 * hace cada accion, asi la vista previa no toca la impresion ni la regeneracion.
 */
export function GeneratedLabelsList({
  labels,
  onPrint,
  onPreview,
}: {
  labels: GeneratedLabelItem[];
  onPrint: (label: GeneratedLabelItem) => void;
  onPreview: (label: GeneratedLabelItem) => void;
}) {
  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
      {labels.map((label) => (
        <li
          key={`${label.assetCode}-${label.url}`}
          className="flex items-center justify-between gap-2"
        >
          <span className="font-mono text-xs">{label.assetCode}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Vista previa de la etiqueta ${label.assetCode}`}
              onClick={() => onPreview(label)}
            >
              <Eye />
              Vista previa
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Enviar a imprimir la etiqueta ${label.assetCode}`}
              onClick={() => onPrint(label)}
            >
              <Printer />
              Imprimir
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
