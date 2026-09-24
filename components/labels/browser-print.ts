import ZebraBrowserPrintWrapper from "zebra-browser-print-wrapper";

export interface ZplPrinter {
  name: string;
  deviceType: string;
  connection: string;
  uid: string;
  provider: string;
  manufacturer: string;
  version: number;
}

export interface PrinterReadiness {
  isReadyToPrint: boolean;
  errors: string[];
}

export type BrowserPrintErrorCode =
  | "NOT_INSTALLED"
  | "NO_PRINTER"
  | "NOT_READY"
  | "WRITE_FAILED"
  | "UNKNOWN";

export class BrowserPrintError extends Error {
  readonly code: BrowserPrintErrorCode;

  constructor(code: BrowserPrintErrorCode, message: string) {
    super(message);
    this.name = "BrowserPrintError";
    this.code = code;
  }
}

function toPrinter(raw: unknown): ZplPrinter | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name : "";
  const uid = typeof value.uid === "string" ? value.uid : "";
  if (!name && !uid) return null;
  return {
    name,
    deviceType: typeof value.deviceType === "string" ? value.deviceType : "",
    connection: typeof value.connection === "string" ? value.connection : "",
    uid,
    provider: typeof value.provider === "string" ? value.provider : "",
    manufacturer: typeof value.manufacturer === "string" ? value.manufacturer : "",
    version: typeof value.version === "number" ? value.version : 0,
  };
}

export class BrowserPrintClient {
  private wrapper = new ZebraBrowserPrintWrapper();

  async listPrinters(): Promise<ZplPrinter[]> {
    try {
      const result: unknown = await this.wrapper.getAvailablePrinters();
      if (result instanceof Error) return [];
      if (!Array.isArray(result)) return [];
      return result
        .map(toPrinter)
        .filter((printer): printer is ZplPrinter => printer !== null);
    } catch {
      throw new BrowserPrintError(
        "NOT_INSTALLED",
        "No se pudo conectar con Zebra Browser Print. Revisa que la app y la extensión estén instaladas en este equipo y que el host esté en 'Accepted Hosts'."
      );
    }
  }

  async getDefaultPrinter(): Promise<ZplPrinter | null> {
    try {
      const device: unknown = await this.wrapper.getDefaultPrinter();
      return toPrinter(device);
    } catch {
      return null;
    }
  }

  selectPrinter(printer: ZplPrinter): void {
    this.wrapper.setPrinter(printer);
  }

  getSelectedPrinter(): ZplPrinter | null {
    return toPrinter(this.wrapper.getPrinter());
  }

  async checkStatus(): Promise<PrinterReadiness> {
    try {
      const status = await this.wrapper.checkPrinterStatus();
      const errors = (status.errors ?? "")
        .split(",")
        .map((error) => error.trim())
        .filter(Boolean);
      return { isReadyToPrint: status.isReadyToPrint, errors };
    } catch {
      throw new BrowserPrintError(
        "NOT_READY",
        "No se pudo consultar el estado de la impresora seleccionada."
      );
    }
  }

  async printZpl(zpl: string): Promise<void> {
    try {
      await this.wrapper.print(zpl);
    } catch {
      throw new BrowserPrintError(
        "WRITE_FAILED",
        "No se pudo enviar el ZPL a la impresora."
      );
    }
  }
}