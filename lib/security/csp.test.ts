import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/security/csp";

function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
}

describe("buildContentSecurityPolicy", () => {
  it("inserta el nonce en script-src sin permitir unsafe-inline", () => {
    const csp = buildContentSecurityPolicy("abc123");
    const scriptSrc = directive(csp, "script-src");

    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("no añade unsafe-eval fuera de desarrollo", () => {
    expect(buildContentSecurityPolicy("abc123")).not.toContain("unsafe-eval");
    expect(
      buildContentSecurityPolicy("abc123", { isDev: true })
    ).toContain("'unsafe-eval'");
  });

  it("bloquea plugins y encuadre", () => {
    const csp = buildContentSecurityPolicy("abc123");

    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
  });

  it("permite los estilos en línea solo en style-src", () => {
    const csp = buildContentSecurityPolicy("abc123");

    expect(directive(csp, "style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive(csp, "style-src")).not.toContain("nonce");
  });

  it("abre la salida hacia la impresora Zebra local", () => {
    const connectSrc = directive(
      buildContentSecurityPolicy("abc123"),
      "connect-src"
    );

    expect(connectSrc).toContain("https://localhost:9100");
    expect(connectSrc).toContain("http://localhost:9100");
  });

  it("solo añade el WebSocket de HMR en desarrollo", () => {
    const connectSrc = (csp: string) => directive(csp, "connect-src") ?? "";

    expect(connectSrc(buildContentSecurityPolicy("abc123"))).not.toContain("ws:");
    expect(
      connectSrc(buildContentSecurityPolicy("abc123", { isDev: true }))
    ).toContain("ws:");
  });

  it("cambia por completo con el nonce", () => {
    expect(buildContentSecurityPolicy("uno")).not.toBe(
      buildContentSecurityPolicy("dos")
    );
  });
});
