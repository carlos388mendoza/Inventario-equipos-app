/**
 * Sincronización entre pestañas del mismo navegador.
 *
 * `revalidatePath` (ver `lib/revalidate.ts`) invalida la caché del SERVIDOR:
 * garantiza que la próxima lectura de esa ruta vuelva a la base de datos. Eso
 * refresca la pestaña que ejecutó la mutación, pero no avisa a las demás
 * pestañas del mismo navegador, que siguen mostrando el RSC payload cacheado
 * hasta que el usuario recarga con F5.
 *
 * Este módulo cubre ese hueco con un evento genérico de "invalida tus datos":
 *
 * - Transporte principal: `BroadcastChannel`, que entrega a las otras pestañas
 *   del mismo origen y solo al publicarse.
 * - Fallback: escritura en `localStorage`, que dispara el evento `storage` en
 *   las OTRAS pestañas del mismo origen (nunca en la que escribe).
 *
 * Privacidad: el mensaje NO lleva datos. Solo un discriminante, la versión del
 * protocolo, un identificador del emisor y un número de secuencia. Nunca se
 * envían códigos de activo, seriales, tokens QR, usuarios, solicitudes ni
 * nada que venga de la base de datos. La pestaña receptora simply vuelve a
 * pedir su propia ruta al servidor, que aplica `resolveScope` y devuelve solo
 * lo que ese usuario puede ver.
 *
 * Sin bucles: cada instancia tiene un `senderId` y descarta los mensajes que
 * ella misma emitió, así que recibir un evento nunca provoca emitirlo otra vez.
 * Además el RSC refresh no dispara server actions, de modo que un evento no
 * puede reencadenarse.
 *
 * Este módulo no depende de React ni del DOM: recibe el entorno por
 * inyección, lo que permite probarlo en Node sin jsdom.
 */

/** Nombre del canal. Debe coincidir en todas las pestañas de la app. */
export const SYNC_CHANNEL_NAME = "grupo-comidas:datos";

/** Clave de `localStorage` usada por el fallback. */
export const SYNC_STORAGE_KEY = "grupo-comidas:datos:invalidacion";

/** Discriminante del mensaje. Permite ignorar mensajes ajenos. */
export const SYNC_MESSAGE_TYPE = "data-invalidation";

/** Versión del protocolo, por si algún día cambia la forma del mensaje. */
export const SYNC_MESSAGE_VERSION = 1;

// ─── DIAGNÓSTICO TEMPORAL ────────────────────────────────────────────────────
// Poner a `false` (o borrar el bloque de abajo) para quitar los logs.
// Solo se imprime información técnica del canal: NUNCA datos de negocio.
const TAB_SYNC_DEBUG = true;

function debugLog(...parts: unknown[]): void {
  if (!TAB_SYNC_DEBUG) {
    return;
  }
  if (typeof console === "undefined") {
    return;
  }
  console.log("[TAB-SYNC]", ...parts);
}

/** Identifica la pestaña sin exponer nada sensible. */
function shortId(value: string): string {
  return value.slice(0, 8);
}

function currentOrigin(): string {
  return typeof window === "undefined" ? "sin-window" : window.location.origin;
}

/**
 * Evento genérico de invalidación. Campos deliberadamente mínimos: cualquiera
 * que añada un campo con datos de negocio está rompiendo la privacidad del
 * canal, que es visible para cualquier pestaña del mismo origen.
 */
export interface DataInvalidationMessage {
  type: typeof SYNC_MESSAGE_TYPE;
  v: number;
  senderId: string;
  seq: number;
}

export interface SyncMessageEvent {
  data: unknown;
}

/** Subconjunto de `BroadcastChannel` que usa este módulo. */
export interface SyncChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  addEventListener(
    type: "message",
    listener: (event: SyncMessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: SyncMessageEvent) => void,
  ): void;
}

export interface SyncEnvironment {
  /** Devuelve `null` si `BroadcastChannel` no existe o no se puede crear. */
  createChannel(name: string): SyncChannelLike | null;
  setStorageItem(key: string, value: string): void;
  /** Se invoca con el nuevo valor cuando OTRA pestaña cambia `key`. */
  subscribeStorage(
    key: string,
    listener: (newValue: string | null) => void,
  ): () => void;
}

export interface TabSync {
  readonly senderId: string;
  /** Invalida los datos en las demás pestañas. No entrega a la propia. */
  publish(): void;
  /** Recibe invalidaciones de OTRAS pestañas. Devuelve la función de baja. */
  subscribe(listener: (message: DataInvalidationMessage) => void): () => void;
  /** Libera canal y listeners. */
  close(): void;
}

const MESSAGE_KEYS = ["senderId", "seq", "type", "v"] as const;

/**
 * Valida la forma del mensaje, tolerando el que llega como texto.
 *
 * Se exige el conjunto EXACTO de claves, sin campos extra: el canal es
 * visible para cualquier pestaña del mismo origen, así que aceptar un mensaje
 * con campos adicionais dejaría la puerta abierta a que otro script smugglee
 * datos hacia estos handlers. Lo que se acepta es solo el evento genérico.
 */
export function isDataInvalidationMessage(
  value: unknown,
): value is DataInvalidationMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== SYNC_MESSAGE_TYPE) {
    return false;
  }
  if (candidate.v !== SYNC_MESSAGE_VERSION) {
    return false;
  }
  if (typeof candidate.senderId !== "string" || candidate.senderId.length === 0) {
    return false;
  }
  if (typeof candidate.seq !== "number") {
    return false;
  }
  const keys = Object.keys(candidate).sort();
  return (
    keys.length === MESSAGE_KEYS.length &&
    keys.every((key, index) => key === MESSAGE_KEYS[index])
  );
}

function parseMessage(raw: unknown): DataInvalidationMessage | null {
  if (isDataInvalidationMessage(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isDataInvalidationMessage(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function createSenderId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Adaptador de los globals del navegador. Todas las comprobaciones son
 * defensivas para que importar este módulo en servidor (o en un test de Node)
 * no rompa nada: si no hay `window`, no hay pestañas que sincronizar.
 */
function browserEnvironment(): SyncEnvironment {
  return {
    createChannel(name) {
      if (typeof globalThis.BroadcastChannel === "undefined") {
        return null;
      }
      try {
        return new globalThis.BroadcastChannel(name) as SyncChannelLike;
      } catch {
        return null;
      }
    },
    setStorageItem(key, value) {
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Modo privado o cuota llena: la sincronización es best-effort y no
        // debe romper la mutación que ya se aplicó en el servidor.
      }
    },
    subscribeStorage(key, listener) {
      if (typeof window === "undefined") {
        return () => {};
      }
      const onStorage = (event: StorageEvent): void => {
        if (event.key === key) {
          listener(event.newValue);
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

/**
 * Crea una instancia de sincronización. En la app hay una sola (la singleton
 * de este módulo); los tests crean las suyas con entornos falsos.
 */
export function createTabSync(options: {
  env?: Partial<SyncEnvironment>;
  senderId?: string;
} = {}): TabSync {
  const env: SyncEnvironment = { ...browserEnvironment(), ...options.env };
  const senderId = options.senderId ?? createSenderId();

  const listeners = new Set<(message: DataInvalidationMessage) => void>();
  let seq = 0;
  let channel: SyncChannelLike | null = null;
  let channelResolved = false;
  let attached = false;
  let detachStorage: (() => void) | null = null;

  function onChannelMessage(event: SyncMessageEvent): void {
    deliver(event.data);
  }

  function onStorageValue(value: string | null): void {
    debugLog("mensaje por localStorage", "teniaValor=", value !== null);
    deliver(value);
  }

  function deliver(raw: unknown): void {
    const message = parseMessage(raw);
    if (!message) {
      debugLog("received pero DESCARTADO (forma invalida)", typeof raw);
      return;
    }
    // Guarda contra bucles: una pestaña ignora lo que ella misma emitió.
    if (message.senderId === senderId) {
      debugLog(
        "received pero IGNORADO (era nuestro propio senderId)",
        shortId(message.senderId)
      );
      return;
    }
    debugLog(
      "received",
      "de senderId=" + shortId(message.senderId),
      "seq=" + String(message.seq),
      "listeners=" + String(listeners.size)
    );
    // Copia porque un listener puede desuscribirse durante la entrega.
    for (const listener of [...listeners]) {
      listener(message);
    }
  }

  function getChannel(): SyncChannelLike | null {
    if (!channelResolved) {
      channelResolved = true;
      channel = env.createChannel(SYNC_CHANNEL_NAME);
      if (channel) {
        channel.addEventListener("message", onChannelMessage);
        debugLog(
          "canal creado",
          "nombre=" + SYNC_CHANNEL_NAME,
          "transporte=broadcast-channel",
          "soportaBC=" + String(typeof globalThis.BroadcastChannel !== "undefined"),
          "origin=" + currentOrigin()
        );
      } else {
        debugLog(
          "sin BroadcastChannel, uso localStorage",
          "nombre=" + SYNC_STORAGE_KEY,
          "origin=" + currentOrigin()
        );
      }
    }
    return channel;
  }

  function closeChannel(): void {
    if (channel) {
      try {
        channel.close();
      } catch {
        // Nada que hacer: el canal ya estaba cerrado.
      }
    }
    channel = null;
    channelResolved = false;
  }

  function attach(): void {
    if (attached) {
      return;
    }
    attached = true;
    if (getChannel() !== null) {
      debugLog(
        "listener ready",
        "transporte=broadcast-channel",
        "senderId=" + shortId(senderId),
        "origin=" + currentOrigin()
      );
      return;
    }
    detachStorage = env.subscribeStorage(SYNC_STORAGE_KEY, onStorageValue);
    debugLog(
      "listener ready",
      "transporte=localStorage",
      "senderId=" + shortId(senderId),
      "origin=" + currentOrigin()
    );
  }

  function detach(): void {
    if (!attached) {
      return;
    }
    attached = false;
    if (detachStorage) {
      detachStorage();
      detachStorage = null;
      return;
    }
    closeChannel();
  }

  function writeToStorage(message: DataInvalidationMessage): void {
    env.setStorageItem(SYNC_STORAGE_KEY, JSON.stringify(message));
  }

  return {
    senderId,

    publish() {
      seq += 1;
      const message: DataInvalidationMessage = {
        type: SYNC_MESSAGE_TYPE,
        v: SYNC_MESSAGE_VERSION,
        senderId,
        seq,
      };
      const activeChannel = getChannel();
      if (activeChannel) {
        try {
          debugLog(
            "broadcasting",
            "transporte=broadcast-channel",
            "seq=" + String(seq),
            "senderId=" + shortId(senderId),
            "origin=" + currentOrigin()
          );
          activeChannel.postMessage(message);
          return;
        } catch (error) {
          debugLog("postMessage fallo, uso localStorage", String(error));
        }
      }
      debugLog(
        "broadcasting",
        "transporte=localStorage",
        "seq=" + String(seq),
        "senderId=" + shortId(senderId)
      );
      writeToStorage(message);
    },

    subscribe(listener) {
      listeners.add(listener);
      attach();
      debugLog(
        "suscriptor registrado",
        "totalListeners=" + String(listeners.size),
        "senderId=" + shortId(senderId)
      );
      let subscribed = true;
      return () => {
        if (!subscribed) {
          return;
        }
        subscribed = false;
        listeners.delete(listener);
        debugLog(
          "suscriptor dado de baja",
          "totalListeners=" + String(listeners.size)
        );
        if (listeners.size === 0) {
          detach();
        }
      };
    },

    close() {
      listeners.clear();
      detach();
      closeChannel();
    },
  };
}

let sharedTabSync: TabSync | null = null;

/** Instancia compartida por toda la pestaña del navegador. */
export function tabSync(): TabSync {
  if (!sharedTabSync) {
    sharedTabSync = createTabSync();
    // DIAGNÓSTICO TEMPORAL: si aparece dos veces, hay dos copias del módulo
    // en la misma pestaña (bundling duplicado).
    debugLog(
      "singleton creado",
      "senderId=" + shortId(sharedTabSync.senderId),
      "origin=" + currentOrigin()
    );
  }
  return sharedTabSync;
}

/** Invalida los datos en las demás pestañas del mismo navegador. */
export function broadcastDataInvalidation(): void {
  tabSync().publish();
}

/** Recibe invalidaciones de otras pestañas. Devuelve la función de baja. */
export function onDataInvalidation(
  listener: (message: DataInvalidationMessage) => void,
): () => void {
  return tabSync().subscribe(listener);
}
