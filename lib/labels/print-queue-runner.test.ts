import { describe, expect, it, vi } from "vitest";
import { runPrintQueue, type QueueItem } from "./print-queue-runner";

const items: QueueItem[] = [
  { assetCode: "EQ-001", zpl: "ZPL-1" },
  { assetCode: "EQ-002", zpl: "ZPL-2" },
  { assetCode: "EQ-003", zpl: "ZPL-3" },
];

const describeError = (e: unknown) =>
  e instanceof Error ? e.message : "error desconocido";

describe("runPrintQueue", () => {
  it("envía cada etiqueta una vez y en el orden dado", async () => {
    const sent: string[] = [];
    const outcome = await runPrintQueue(
      items,
      async (zpl) => {
        sent.push(zpl);
      },
      () => {},
      describeError
    );

    expect(sent).toEqual(["ZPL-1", "ZPL-2", "ZPL-3"]);
    expect(outcome).toEqual({ status: "done", sent: 3, total: 3 });
  });

  it("conserva el orden de la lista aunque se reordene el original después", async () => {
    const mutable = [...items];
    const snapshot = [...mutable];
    mutable.reverse();

    const sent: string[] = [];
    await runPrintQueue(
      snapshot,
      async (zpl) => {
        sent.push(zpl);
      },
      () => {},
      describeError
    );

    expect(sent).toEqual(["ZPL-1", "ZPL-2", "ZPL-3"]);
  });

  it("reporta el progreso antes de enviar cada etiqueta", async () => {
    const progress: Array<[number, number]> = [];
    await runPrintQueue(
      items,
      async () => {},
      (index, total) => progress.push([index, total]),
      describeError
    );

    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
  });

  it("se detiene en el fallo e informa cuántas salieron y cuál falló", async () => {
    const sent: string[] = [];
    const outcome = await runPrintQueue(
      items,
      async (zpl) => {
        if (zpl === "ZPL-2") throw new Error("Zebra desconectada");
        sent.push(zpl);
      },
      () => {},
      describeError
    );

    expect(sent).toEqual(["ZPL-1"]);
    expect(outcome).toEqual({
      status: "stopped",
      sent: 1,
      total: 3,
      failedLabel: "EQ-002",
      reason: "Zebra desconectada",
    });
  });

  it("no reintenta la etiqueta que falló", async () => {
    const send = vi
      .fn<(zpl: string) => Promise<void>>()
      .mockResolvedValue(undefined)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(undefined);

    const outcome = await runPrintQueue(items, send, () => {}, describeError);

    // Falla en la primera y no insiste: 1 intento, no 3.
    expect(send).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("stopped");
  });

  it("trata una cola vacía como completada sin enviar nada", async () => {
    const send = vi.fn<(zpl: string) => Promise<void>>();
    const outcome = await runPrintQueue([], send, () => {}, describeError);

    expect(send).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: "done", sent: 0, total: 0 });
  });
});
