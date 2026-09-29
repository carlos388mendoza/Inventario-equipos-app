"use client";

import * as React from "react";
import { useTransition } from "react";
import {
  BrowserPrintClient,
  BrowserPrintError,
  type PrinterReadiness,
  type ZplPrinter,
} from "@/components/labels/browser-print";

export type PrinterPhase =
  | "idle"
  | "detecting"
  | "ready"
  | "no-printers"
  | "unavailable";

export function printerErrorMessage(error: unknown): string {
  if (error instanceof BrowserPrintError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}

export interface PrinterSession {
  phase: PrinterPhase;
  printers: ZplPrinter[];
  selected: ZplPrinter | null;
  readiness: PrinterReadiness | null;
  message: string | null;
  busy: boolean;
  detect: () => void;
  select: (uid: string) => void;
  checkStatus: () => void;
  setMessage: (message: string | null) => void;
  setReadiness: (readiness: PrinterReadiness | null) => void;
}

/**
 * Sesión de Zebra Browser Print compartida por la impresión individual y la
 * por lotes: detectar, elegir impresora y comprobar estado viven aquí para que
 * ambas rutas hablen con el mismo wrapper de la misma forma.
 *
 * El cliente se crea una sola vez por montaje y `selectPrinter` se aplica al
 * wrapper, de modo que quien llama solo necesita `client` para enviar ZPL.
 */
export function usePrinterSession(): PrinterSession & { client: BrowserPrintClient } {
  const [client] = React.useState(() => new BrowserPrintClient());
  const [phase, setPhase] = React.useState<PrinterPhase>("idle");
  const [printers, setPrinters] = React.useState<ZplPrinter[]>([]);
  const [selected, setSelected] = React.useState<ZplPrinter | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [readiness, setReadiness] = React.useState<PrinterReadiness | null>(null);
  const [busy, startTransition] = useTransition();

  function detect() {
    startTransition(async () => {
      setPhase("detecting");
      setMessage(null);
      setReadiness(null);
      try {
        const list = await client.listPrinters();
        if (list.length === 0) {
          setPhase("no-printers");
          return;
        }
        const defaultPrinter = await client.getDefaultPrinter();
        const initial =
          (defaultPrinter
            ? list.find(
                (printer) =>
                  printer.uid === defaultPrinter.uid &&
                  printer.name === defaultPrinter.name
              )
            : undefined) ?? list[0];
        client.selectPrinter(initial);
        setPrinters(list);
        setSelected(initial);
        setPhase("ready");
      } catch (error) {
        setPhase("unavailable");
        setMessage(printerErrorMessage(error));
      }
    });
  }

  function select(uid: string) {
    const printer = printers.find((p) => p.uid === uid) ?? null;
    if (!printer) return;
    client.selectPrinter(printer);
    setSelected(printer);
    setReadiness(null);
    setMessage(null);
  }

  function checkStatus() {
    startTransition(async () => {
      setMessage(null);
      try {
        setReadiness(await client.checkStatus());
      } catch (error) {
        setReadiness(null);
        setMessage(printerErrorMessage(error));
      }
    });
  }

  return {
    client,
    phase,
    printers,
    selected,
    readiness,
    message,
    busy,
    detect,
    select,
    checkStatus,
    setMessage,
    setReadiness,
  };
}
