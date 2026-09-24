import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { buildZpl, type ZplLabelData } from "./builder";
import { ZPL_LOGO_GRAPHICS } from "./graphics.generated";
import { LABEL_WIDTH, LABEL_HEIGHT, MARGIN } from "./layout";

const baseData: ZplLabelData = {
  url: "https://inventario-equipos-app.vercel.app/e/5f65afd604144e1bb0e6e9312bd6282c",
  assetCode: "EQ-PIH-PTZ-0001",
  typeName: "Mini-PC",
  restaurantName: "Denny's - Las Bajadas",
  restaurantSector: null,
  restaurantLogo: "/brands/pizza-hut.svg",
  createdAt: "2026-09-23T00:00:00.000Z",
};

describe("buildZpl", () => {
  it("define el tamaño correcto para ZD230 203 dpi (2x1 pulgada)", () => {
    const zpl = buildZpl(baseData);
    expect(zpl).toContain("^PW406");
    expect(zpl).toContain("^LL203");
    expect(zpl).toContain("^LS0");
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
  });

  it("incluye el QR con la misma URL pública que la preview", () => {
    const zpl = buildZpl(baseData);
    expect(zpl).toMatch(/\^BQN,2,\d+/);
    expect(zpl).toContain(`^FDQA,${baseData.url}^FS`);
  });

  it("el QR cabe dentro del espacio disponible en 203 dpi", () => {
    const zpl = buildZpl(baseData);
    const match = zpl.match(/\^BQN,2,(\d+)/);
    expect(match).not.toBeNull();
    const magnification = Number(match![1]);
    const modules = QRCode.create(baseData.url, {
      errorCorrectionLevel: "Q",
    }).modules.size;
    const qrDots = modules * magnification;
    expect(qrDots).toBeLessThanOrEqual(LABEL_HEIGHT - 2 * MARGIN);
    expect(qrDots).toBeLessThanOrEqual(LABEL_WIDTH - 2 * MARGIN);
    expect(magnification).toBeGreaterThanOrEqual(1);
    expect(magnification).toBeLessThanOrEqual(10);
  });

  it("embebe el bloque ^GFA del logo de la marca", () => {
    const zpl = buildZpl(baseData);
    const graphic = ZPL_LOGO_GRAPHICS["pizza-hut"];
    expect(graphic).toBeDefined();
    expect(zpl).toContain("^GFA,H,");
    expect(zpl).toContain(graphic.hex);
  });

  it("omite el logo cuando no hay logo o la marca es desconocida", () => {
    const withoutLogo = buildZpl({ ...baseData, restaurantLogo: null });
    expect(withoutLogo).not.toContain("^GFA");
    const unknownLogo = buildZpl({ ...baseData, restaurantLogo: "/brands/xxx.svg" });
    expect(unknownLogo).not.toContain("^GFA");
  });

  it("incluye los textos de la etiqueta", () => {
    const zpl = buildZpl(baseData);
    expect(zpl).toContain("Denny's - Las");
    expect(zpl).toContain("Bajadas");
    expect(zpl).toContain("MINI-PC");
    expect(zpl).toContain("EQ-PIH-PTZ-0001");
  });

  it("usa la etiqueta de fecha de instalación o generación", () => {
    const generated = buildZpl(baseData);
    expect(generated).toContain("Generación:");
    expect(generated).not.toContain("Instalación:");
    const installed = buildZpl({
      ...baseData,
      installationDate: "2026-09-23T00:00:00.000Z",
    });
    expect(installed).toContain("Instalación:");
  });

  it("sanea texto para evitar inyección de comandos ZPL", () => {
    const zpl = buildZpl({
      ...baseData,
      restaurantName: "BAD^FS^XA^XZ empresa",
    });
    expect(zpl).not.toContain("^FS^XA^XZ");
  });

  it("no incluye secretos en el ZPL generado", () => {
    const zpl = buildZpl(baseData);
    expect(zpl).not.toMatch(/TURSO_AUTH_TOKEN|BETTER_AUTH_SECRET|OPENROUTER/i);
  });

  it("los bloques de logo tienen la longitud declarada", () => {
    for (const graphic of Object.values(ZPL_LOGO_GRAPHICS)) {
      expect(graphic.hex.length).toBe(graphic.bytesPerRow * graphic.rows * 2);
      expect(graphic.rows).toBe(graphic.height);
      expect(graphic.width).toBeGreaterThan(0);
      expect(graphic.height).toBeGreaterThan(0);
    }
  });
});