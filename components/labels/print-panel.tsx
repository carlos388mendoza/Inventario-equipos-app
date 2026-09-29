"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, FileCode2, Loader2, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { printerErrorMessage, usePrinterSession } from "@/components/labels/use-printer-session";
import { buildZpl, type ZplLabelData } from "@/lib/zpl/builder";

export interface LabelPrintData {
  url: string;
  assetCode: string;
  typeName: string;
  restaurantName: string;
  restaurantSector?: string | null;
  restaurantLogo: string | null;
  installationDate?: string | Date | null;
  createdAt: string | Date;
}

export function PrintPanel({ label }: { label: LabelPrintData }) {
  const session = usePrinterSession();
  const { client, phase, printers, selected, readiness, message, busy, setMessage, setReadiness } = session;
  const [showZpl, setShowZpl] = React.useState(false);
  const [, startTransition] = useTransition();

  const zpl = React.useMemo(
    () => buildZpl(label as ZplLabelData),
    [label]
  );

  function handleCheckStatus() {
    session.checkStatus();
  }

  function handlePrint() {
    startTransition(async () => {
      setMessage(null);
      try {
        if (selected) {
          const status = await client.checkStatus();
          setReadiness(status);
          if (!status.isReadyToPrint) {
            setMessage(
              status.errors.length
                ? status.errors.join(", ")
                : "La impresora no está lista para imprimir."
            );
            return;
          }
        }
        await client.printZpl(zpl);
        toast.success(`ZPL enviado a "${selected?.name ?? "la impresora"}"`);
        setMessage(
          "ZPL enviado a la impresora. Verifica que la etiqueta se haya impreso correctamente."
        );
      } catch (error) {
        setMessage(printerErrorMessage(error));
      }
    });
  }

  return (
    <div className="space-y-3">
      {phase === "idle" && (
        <Button variant="outline" size="sm" onClick={session.detect}>
          <Printer />
          Detectar impresoras
        </Button>
      )}

      {phase === "detecting" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="animate-spin" />
          Buscando impresoras…
        </p>
      )}

      {phase === "no-printers" && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleAlert className="text-amber-500" />
            No se encontraron impresoras. Conecta la Zebra ZD230 y vuelve a
            intentar.
          </p>
          <Button variant="outline" size="sm" onClick={session.detect}>
            <RefreshCw />
            Reintentar
          </Button>
        </div>
      )}

      {phase === "unavailable" && (
        <div className="space-y-2">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 shrink-0 text-destructive" />
            No se pudo conectar con Zebra Browser Print.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li>
              Instala la app &quot;Zebra Browser Print&quot; y su extensión de
              Chrome en este equipo.
            </li>
            <li>
              Agrega este host en &quot;Accepted Hosts&quot; del app
              (localhost:3000 y el dominio de la aplicación).
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">{message}</p>
          <Button variant="outline" size="sm" onClick={session.detect}>
            <RefreshCw />
            Reintentar
          </Button>
        </div>
      )}

      {phase === "ready" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Impresora</Label>
            <Select
              value={selected?.uid ?? ""}
              onValueChange={session.select}
              disabled={busy}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la impresora" />
              </SelectTrigger>
              <SelectContent>
                {printers.map((printer) => (
                  <SelectItem key={printer.uid} value={printer.uid}>
                    {printer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCheckStatus}
              disabled={busy}
            >
              {busy && phase === "ready" && (
                <Loader2 className="animate-spin" />
              )}
              Comprobar estado
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={busy}>
              <Printer />
              {busy ? "Enviando…" : "Imprimir"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowZpl((value) => !value)}
            >
              <FileCode2 />
              {showZpl ? "Ocultar ZPL" : "Ver ZPL"}
            </Button>
          </div>

          {showZpl && (
            <pre className="max-h-40 overflow-auto rounded-md border bg-muted/50 p-2 font-mono text-[10px] leading-tight">
              {zpl}
            </pre>
          )}

          {readiness && (
            <p
              className={`flex items-center gap-2 text-xs ${
                readiness.isReadyToPrint
                  ? "text-emerald-600"
                  : "text-destructive"
              }`}
            >
              {readiness.isReadyToPrint ? (
                <CheckCircle2 />
              ) : (
                <CircleAlert />
              )}
              {readiness.isReadyToPrint
                ? "Impresora lista."
                : readiness.errors.length
                  ? readiness.errors.join(", ")
                  : "La impresora no está lista."}
            </p>
          )}

          {message && (
            <p className="text-xs text-muted-foreground">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}