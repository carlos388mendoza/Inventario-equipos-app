import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El service worker vive en `public/sw.js` como script clásico, sin módulos.
 * Para probarlo sin navegador se evalúa el archivo con `new Function`, inyectando
 * un `self`, un `caches` y un `fetch` falsos, y se dispara su listener de `fetch`.
 * Así se verifica la lógica real que corre en producción, no una copia.
 */

const ORIGIN = "https://app.test";

interface FetchEvent {
  request: Request;
  respondWith: (response: Promise<Response>) => void;
}

type FetchListener = (event: FetchEvent) => void;

interface SwHarness {
  dispatch: (request: Request) => Promise<Response | undefined>;
  cached: Map<string, Response>;
  fetchMock: ReturnType<typeof vi.fn>;
}

function loadServiceWorker(): SwHarness {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const listeners: Record<string, FetchListener> = {};
  const cached = new Map<string, Response>();

  const keyOf = (request: Request | string): string =>
    typeof request === "string" ? new URL(request, ORIGIN).toString() : request.url;

  const selfMock = {
    addEventListener: (type: string, cb: FetchListener) => {
      listeners[type] = cb;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    location: { origin: ORIGIN },
  };

  const cachesMock = {
    open: async () => ({
      put: async (request: Request | string, response: Response) => {
        cached.set(keyOf(request), response);
      },
      addAll: async (requests: string[]) => {
        for (const request of requests) cached.set(keyOf(request), new Response("cached"));
      },
      match: async (request: Request | string) => cached.get(keyOf(request)),
    }),
    match: async (request: Request | string) => cached.get(keyOf(request)),
    keys: async () => ["v2"],
    delete: async () => true,
  };

  const fetchMock = vi.fn();

  new Function("self", "caches", "fetch", source)(
    selfMock,
    cachesMock,
    fetchMock
  );

  return {
    fetchMock,
    cached,
    dispatch: async (request: Request) => {
      const respondWith = vi.fn();
      listeners.fetch({ request, respondWith } as unknown as FetchEvent);
      const call = respondWith.mock.calls[0] as [Promise<Response>] | undefined;
      return call ? await call[0] : undefined;
    },
  };
}

function makeRequest(
  path: string,
  options: {
    method?: string;
    mode?: string;
    headers?: Record<string, string>;
    base?: string;
  } = {}
): Request {
  const { method = "GET", mode = "cors", headers = {}, base = ORIGIN } = options;
  return {
    url: `${base}${path}`,
    method,
    mode,
    headers: new Headers(headers),
  } as unknown as Request;
}

function makeResponse(body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status: 200, headers });
}

describe("service worker", () => {
  let sw: SwHarness;

  beforeEach(() => {
    sw = loadServiceWorker();
  });

  it("ignora métodos que no son GET", async () => {
    const result = await sw.dispatch(makeRequest("/dashboard", { method: "POST" }));
    expect(result).toBeUndefined();
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });

  it("ignora peticiones de otro origen", async () => {
    const result = await sw.dispatch(
      makeRequest("/x", { base: "https://other.test" })
    );
    expect(result).toBeUndefined();
  });

  it("ignora los payloads del router y los prefetch", async () => {
    expect(
      await sw.dispatch(makeRequest("/dashboard", { headers: { rsc: "1" } }))
    ).toBeUndefined();
    expect(
      await sw.dispatch(
        makeRequest("/dashboard", { headers: { "next-router-prefetch": "1" } })
      )
    ).toBeUndefined();
  });

  it("ignora las rutas de la API", async () => {
    expect(await sw.dispatch(makeRequest("/api/health"))).toBeUndefined();
  });

  it("no cachea navegaciones con Cache-Control no-store", async () => {
    sw.fetchMock.mockResolvedValue(
      makeResponse("<html>privado</html>", {
        "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      })
    );

    const response = await sw.dispatch(makeRequest("/dashboard", { mode: "navigate" }));

    expect(await response!.text()).toBe("<html>privado</html>");
    expect(sw.cached.has(`${ORIGIN}/dashboard`)).toBe(false);
  });

  it("cachea navegaciones públicas", async () => {
    sw.fetchMock.mockResolvedValue(
      makeResponse("<html>público</html>", { "cache-control": "public, max-age=60" })
    );

    await sw.dispatch(makeRequest("/inicio", { mode: "navigate" }));

    expect(sw.cached.has(`${ORIGIN}/inicio`)).toBe(true);
  });

  it("cae a offline.html cuando la red falla", async () => {
    sw.cached.set(`${ORIGIN}/offline.html`, makeResponse("<html>sin conexión</html>"));
    sw.fetchMock.mockRejectedValue(new Error("offline"));

    const response = await sw.dispatch(makeRequest("/dashboard", { mode: "navigate" }));

    expect(await response!.text()).toBe("<html>sin conexión</html>");
  });

  it("no cachea assets con Cache-Control no-store", async () => {
    sw.fetchMock.mockResolvedValue(makeResponse("js", { "cache-control": "no-store" }));

    await sw.dispatch(makeRequest("/_next/static/app.js"));

    expect(sw.cached.has(`${ORIGIN}/_next/static/app.js`)).toBe(false);
  });

  it("sirve assets cacheados y revalida en segundo plano", async () => {
    sw.cached.set(`${ORIGIN}/_next/static/app.js`, makeResponse("viejo"));
    sw.fetchMock.mockResolvedValue(
      makeResponse("nuevo", { "cache-control": "public, max-age=31536000, immutable" })
    );

    const response = await sw.dispatch(makeRequest("/_next/static/app.js"));

    expect(await response!.text()).toBe("viejo");
  });
});
