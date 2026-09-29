import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTabSync,
  isDataInvalidationMessage,
  SYNC_CHANNEL_NAME,
  SYNC_MESSAGE_TYPE,
  SYNC_MESSAGE_VERSION,
  SYNC_STORAGE_KEY,
  type DataInvalidationMessage,
  type SyncChannelLike,
  type SyncEnvironment,
} from "./tab-sync";

/**
 * Bus de `BroadcastChannel` simulado. Reproduce la regla que importa: el canal
 * que publica NO recibe su propio mensaje, pero cualquier OTRO canal del mismo
 * contexto con el mismo nombre sí.
 */
class FakeChannelBus {
  readonly channels: FakeChannel[] = [];

  create = (name: string): SyncChannelLike => {
    const channel = new FakeChannel(this, name);
    this.channels.push(channel);
    return channel;
  };

  get openChannels(): FakeChannel[] {
    return this.channels.filter((c) => !c.closed);
  }
}

class FakeChannel implements SyncChannelLike {
  closed = false;
  private readonly listeners = new Set<(event: { data: unknown }) => void>();

  constructor(
    private readonly bus: FakeChannelBus,
    readonly name: string,
  ) {}

  postMessage(message: unknown): void {
    if (this.closed) {
      return;
    }
    // Clone para imitar la serialización real del canal.
    const payload = JSON.parse(JSON.stringify(message)) as unknown;
    for (const peer of this.bus.channels) {
      if (peer === this || peer.closed || peer.name !== this.name) {
        continue;
      }
      for (const listener of [...peer.listeners]) {
        listener({ data: payload });
      }
    }
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }

  addEventListener(
    _type: "message",
    listener: (event: { data: unknown }) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: { data: unknown }) => void,
  ): void {
    this.listeners.delete(listener);
  }
}

/** `localStorage` simulado: notifica a los oyentes de OTRAS pestañas. */
function createFakeStorageHub() {
  const values = new Map<string, string>();
  const listeners = new Set<(key: string, value: string) => void>();

  function write(key: string, value: string): void {
    values.set(key, value);
    for (const listener of [...listeners]) {
      listener(key, value);
    }
  }

  return {
    values,
    setItem: write,
    env: {
      createChannel: () => null,
      setStorageItem: write,
      subscribeStorage(key: string, listener: (value: string | null) => void) {
        const wrapped = (changedKey: string, value: string): void => {
          if (changedKey === key) {
            listener(value);
          }
        };
        listeners.add(wrapped);
        return () => {
          listeners.delete(wrapped);
        };
      },
    } satisfies Partial<SyncEnvironment>,
  };
}

const created: Array<{ close: () => void }> = [];

function makeSync(options: { env?: Partial<SyncEnvironment>; senderId?: string } = {}) {
  const sync = createTabSync(options);
  created.push(sync);
  return sync;
}

afterEach(() => {
  while (created.length > 0) {
    created.pop()?.close();
  }
});

describe("forma del mensaje", () => {
  it("es genérico: no transporta ningún dato de negocio", () => {
    const bus = new FakeChannelBus();
    const sync = makeSync({ env: { createChannel: bus.create } });
    let received: unknown = null;
    const peer = makeSync({ env: { createChannel: bus.create } });
    peer.subscribe((message) => {
      received = message;
    });

    sync.publish();

    expect(received).not.toBeNull();
    expect(Object.keys(received as object).sort()).toEqual([
      "senderId",
      "seq",
      "type",
      "v",
    ]);
    expect((received as DataInvalidationMessage).type).toBe(SYNC_MESSAGE_TYPE);
    expect((received as DataInvalidationMessage).v).toBe(SYNC_MESSAGE_VERSION);
  });

  it("rechaza mensajes con forma ajena", () => {
    expect(isDataInvalidationMessage(null)).toBe(false);
    expect(isDataInvalidationMessage("data-invalidation")).toBe(false);
    expect(isDataInvalidationMessage({ type: "otro-canal" })).toBe(false);
    expect(
      isDataInvalidationMessage({
        type: SYNC_MESSAGE_TYPE,
        v: SYNC_MESSAGE_VERSION,
        senderId: "",
        seq: 1,
      }),
    ).toBe(false);
    expect(
      isDataInvalidationMessage({
        type: SYNC_MESSAGE_TYPE,
        v: SYNC_MESSAGE_VERSION,
        senderId: "a",
        seq: 1,
        token: "secreto",
      }),
    ).toBe(false);
  });
});

describe("transporte BroadcastChannel", () => {
  it("una pestaña que publica invalida a la otra", () => {
    const bus = new FakeChannelBus();
    const tabA = makeSync({ env: { createChannel: bus.create } });
    const tabB = makeSync({ env: { createChannel: bus.create } });

    const onA = vi.fn();
    const onB = vi.fn();
    tabA.subscribe(onA);
    tabB.subscribe(onB);

    tabA.publish();

    expect(onA).not.toHaveBeenCalled();
    expect(onB).toHaveBeenCalledTimes(1);
  });

  it("funciona con tres o más pestañas a la vez", () => {
    const bus = new FakeChannelBus();
    const publisher = makeSync({ env: { createChannel: bus.create } });
    const receivers = [1, 2, 3].map(() => {
      const sync = makeSync({ env: { createChannel: bus.create } });
      const listener = vi.fn();
      sync.subscribe(listener);
      return listener;
    });

    publisher.publish();

    for (const listener of receivers) {
      expect(listener).toHaveBeenCalledTimes(1);
    }
  });

  it("ignora su propio mensaje: no hay bucles", () => {
    const bus = new FakeChannelBus();
    const tabA = makeSync({ env: { createChannel: bus.create } });
    const onA = vi.fn();
    tabA.subscribe(onA);

    // Una pestaña se reenvía a sí misma (otra pestaña reenvía lo que oyó).
    const echo = bus.create(SYNC_CHANNEL_NAME);
    echo.postMessage({
      type: SYNC_MESSAGE_TYPE,
      v: SYNC_MESSAGE_VERSION,
      senderId: tabA.senderId,
      seq: 1,
    });

    expect(onA).not.toHaveBeenCalled();
  });

  it("no propaga en cadena: un evento recibido no vuelve a publicarse", () => {
    const bus = new FakeChannelBus();
    const tabA = makeSync({ env: { createChannel: bus.create } });
    const tabB = makeSync({ env: { createChannel: bus.create } });

    let received = 0;
    // El receptor, al recibir, solo refresca: jamás llama a publish().
    const handler = (): void => {
      received += 1;
    };
    tabA.subscribe(handler);
    tabB.subscribe(handler);

    tabA.publish();
    tabA.publish();

    expect(received).toBe(2);
  });

  it("descarta mensajes ajenos que no son invalidaciones", () => {
    const bus = new FakeChannelBus();
    const tabA = makeSync({ env: { createChannel: bus.create } });
    const onA = vi.fn();
    tabA.subscribe(onA);

    const noise = bus.create(SYNC_CHANNEL_NAME);
    noise.postMessage({ cualquier: "cosa" });
    noise.postMessage("no soy json {");

    expect(onA).not.toHaveBeenCalled();
  });
});

describe("fallback localStorage", () => {
  it("sincroniza cuando BroadcastChannel no existe", () => {
    const hub = createFakeStorageHub();
    const tabA = makeSync({ env: hub.env });
    const tabB = makeSync({ env: hub.env });

    const onB = vi.fn();
    tabB.subscribe(onB);

    tabA.publish();

    expect(hub.values.get(SYNC_STORAGE_KEY)).toBeDefined();
    expect(onB).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(
      hub.values.get(SYNC_STORAGE_KEY) as string,
    ) as DataInvalidationMessage;
    expect(parsed.type).toBe(SYNC_MESSAGE_TYPE);
  });

  it("ignora cambios de otras claves de localStorage", () => {
    const hub = createFakeStorageHub();
    const tabA = makeSync({ env: hub.env });
    const onA = vi.fn();
    tabA.subscribe(onA);

    hub.setItem("otra-clave", "{\"type\":\"data-invalidation\"}");

    expect(onA).not.toHaveBeenCalled();
  });

  it("cae al fallback si el canal falla al publicar", () => {
    const hub = createFakeStorageHub();
    const tabA = makeSync({
      env: {
        createChannel: () => ({
          postMessage: () => {
            throw new Error("canal roto");
          },
          close: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
        setStorageItem: hub.env.setStorageItem,
        subscribeStorage: hub.env.subscribeStorage,
      },
    });
    const tabB = makeSync({ env: hub.env });
    const onB = vi.fn();
    tabB.subscribe(onB);

    expect(() => tabA.publish()).not.toThrow();
    expect(onB).toHaveBeenCalledTimes(1);
  });
});

describe("ciclo de vida de listeners y canal", () => {
  it("la baja deja de entregar mensajes", () => {
    const bus = new FakeChannelBus();
    const tabA = makeSync({ env: { createChannel: bus.create } });
    const tabB = makeSync({ env: { createChannel: bus.create } });
    const onB = vi.fn();

    const unsubscribe = tabB.subscribe(onB);
    unsubscribe();

    tabA.publish();

    expect(onB).not.toHaveBeenCalled();
  });

  it("la baja es idempotente y no afecta a otros suscriptores", () => {
    const bus = new FakeChannelBus();
    const tabA = makeSync({ env: { createChannel: bus.create } });
    const tabB = makeSync({ env: { createChannel: bus.create } });
    const onB1 = vi.fn();
    const onB2 = vi.fn();

    const unsubscribe1 = tabB.subscribe(onB1);
    tabB.subscribe(onB2);

    unsubscribe1();
    unsubscribe1();

    tabA.publish();

    expect(onB1).not.toHaveBeenCalled();
    expect(onB2).toHaveBeenCalledTimes(1);
  });

  it("no duplica la entrega con varios suscriptores en la misma pestaña", () => {
    const bus = new FakeChannelBus();
    const tabA = makeSync({ env: { createChannel: bus.create } });
    const tabB = makeSync({ env: { createChannel: bus.create } });
    const onB1 = vi.fn();
    const onB2 = vi.fn();

    tabB.subscribe(onB1);
    tabB.subscribe(onB2);

    tabA.publish();

    expect(onB1).toHaveBeenCalledTimes(1);
    expect(onB2).toHaveBeenCalledTimes(1);
  });

  it("remonta y desmonta varias veces sin acumular canales", () => {
    const bus = new FakeChannelBus();
    const tabB = makeSync({ env: { createChannel: bus.create } });
    const onB = vi.fn();

    for (let i = 0; i < 5; i += 1) {
      const unsubscribe = tabB.subscribe(onB);
      unsubscribe();
    }
    // Cada ciclo abre y cierra su canal: no queda ninguno abierto.
    expect(bus.openChannels.length).toBe(0);

    // Remontar debe funcionar.
    const unsubscribe = tabB.subscribe(onB);
    expect(bus.openChannels.length).toBe(1);

    const tabA = makeSync({ env: { createChannel: bus.create } });
    tabA.publish();
    expect(onB).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(bus.openChannels.length).toBe(1);

    // Y volver a suscribirse tras el cierre también.
    const again = vi.fn();
    const unsubscribeAgain = tabB.subscribe(again);
    tabA.publish();
    expect(again).toHaveBeenCalledTimes(1);
    unsubscribeAgain();
  });

  it("close() libera todo", () => {
    const bus = new FakeChannelBus();
    const tabB = makeSync({ env: { createChannel: bus.create } });
    const onB = vi.fn();
    tabB.subscribe(onB);

    tabB.close();

    expect(bus.openChannels.length).toBe(0);
  });
});
