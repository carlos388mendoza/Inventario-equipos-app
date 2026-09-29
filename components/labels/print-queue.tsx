"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildZpl } from "@/lib/zpl/builder";
import { runPrintQueue } from "@/lib/labels/print-queue-runner";
import { printerErrorMessage, usePrinterSession } from "@/components/labels/use-printer-session";
import type { LabelPrintData } from "@/components/labels/print-panel";

type QueueStatus =
  | { kind: "idle" }
  | { kind: "running"; index: number; total: number }
  | { kind: "done"; sent: number; total: number }
  | { kind: "stopped"; sent: number; total: number; failedLabel: string; reason: string };

/**
 * Imprime varias etiquetas en una sola operación.
 *
 * Decisiones que importan:
 *  - La lista se COPIA al iniciar la cola. Un re-render durante la impresión no
 *    cambia lo que se envía, y el orden es siempre el de la tabla.
 *  - Cada etiqueta conserva su propio token y URL, así que cada QR sigue
 *    apuntando a su equipo. No se reutiliza un QR para varias.
 *  - Se comprueba el estado de la impresora ANTES de enviar la primera. Si no
 *    está lista, no se imprime ninguna y no queda un lote a medias.
 *  - Un fallo detiene la cola y reporta cuántas salieron y cuál falló, en vez
 *    de seguir enviando a ciegas.
 */
export function PrintQueue({ labels }: { labels: LabelPrintData[] }) {
  const session = usePrinterSession();
  const [status, setStatus] = React.useState<QueueStatus>({ kind: "idle" });
  const runningRef = React.useRef(false);

  const total = labels.length;

  async function runQueue() {
    if (runningRef.current || labels.length === 0) return;
    // Copia defensiva: el orden enviado queda fijado en este momento.
    const queue = [...labels];
    runningRef.current = true;
    session.setMessage(null);
    session.setReadiness(null);
    setStatus({ kind: "running", index: 0, total: queue.length });

    try {
      if (session.selected) {
        const readiness = await session.client.checkStatus();
        session.setReadiness(readiness);
        if (!readiness.isReadyToPrint) {
          setStatus({
            kind: "stopped",
            sent: 0,
            total: queue.length,
            failedLabel: queue[0]?.assetCode ?? "",
            reason: readiness.errors.length
              ? readiness.errors.join(", ")
              : "La impresora no está lista para imprimir.",
          });
          return;
        }
      }

      // El ZPL se arma con los datos de ESTA etiqueta: mismo builder y mismo
      // contrato de la impresión individual.
      const outcome = await runPrintQueue(
        queue.map((label) => ({
          assetCode: label.assetCode,
          zpl: buildZpl(label),
        })),
        (zpl) => session.client.printZpl(zpl),
        (index, total) => setStatus({ kind: "running", index, total }),
        printerErrorMessage
      );

      setStatus(
        outcome.status === "done"
          ? { kind: "done", sent: outcome.sent, total: outcome.total }
          : {
              kind: "stopped",
              sent: outcome.sent,
              total: outcome.total,
              failedLabel: outcome.failedLabel,
              reason: outcome.reason,
            }
      );
    } finally {
      runningRef.current = false;
    }
  }

  const running = status.kind === "running";

  return (
    <div className="space-y-3">
      {session.phase === "idle" && (
        <Button variant="outline" size="sm" onClick={session.detect}>
          <Printer />
          Detectar impresoras
        </Button>
      )}

      {session.phase === "detecting" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="animate-spin" />
          Buscando impresoras…
        </p>
      )}

      {session.phase === "no-printers" && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleAlert className="text-amber-500" />
            No se encontraron impresoras. Conecta la Zebra ZD230 y vuelve a
            intentar.
          </p>
          <Button variant="outline" size="sm" onClick={session.detect}>
            Reintentar
          </Button>
        </div>
      )}

      {session.phase === "unavailable" && (
        <div className="space-y-2">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 shrink-0 text-destructive" />
            No se pudo conectar con Zebra Browser Print.
          </p>
          <p className="text-xs text-muted-foreground">{session.message}</p>
          <Button variant="outline" size="sm" onClick={session.detect}>
            Reintentar
          </Button>
        </div>
      )}

      {session.phase === "ready" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Impresora</Label>
            <Select
              value={session.selected?.uid ?? ""}
              onValueChange={session.select}
              disabled={session.busy || running}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la impresora" />
              </SelectTrigger>
              <SelectContent>
                {session.printers.map((printer) => (
                  <SelectItem key={printer.uid} value={printer.uid}>
                    {printer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Se enviarán {total} etiqueta(s) en el orden en que aparecen en la
            tabla. El estado de la impresora se comprueba antes de empezar.
          </p>

          <Button
            size="sm"
            onClick={runQueue}
            disabled={running || session.busy || total === 0}
          >
            {running ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Printer />
            )}
            {running
              ? `Imprimiendo ${Math.min(status.index + 1, status.total)} de ${status.total}…`
              : `Imprimir ${total} etiqueta(s)`}
          </Button>

          {status.kind === "done" && (
            <p className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 />
              Se enviaron {status.sent} de {status.total} etiqueta(s). Verifica
              que se hayan impreso correctamente.
            </p>
          )}

          {status.kind === "stopped" && (
            <div className="space-y-1 text-xs text-destructive">
              <p className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 shrink-0" />
                <span>
                  La cola se detuvo en la etiqueta{" "}
                  <span className="font-mono">{status.failedLabel}</span>:{" "}
                  {status.reason}
                </span>
              </p>
              <p>
                {status.sent} de {status.total} etiqueta(s) se enviaron antes
                del fallo. Vuelve a imprimir las restantes.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
