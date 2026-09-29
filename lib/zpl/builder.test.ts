import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { buildZpl, logoGraphicFor, type ZplLabelData } from "./builder";
import { ZPL_LOGO_GRAPHICS } from "./graphics.generated";
import {
  LABEL_WIDTH,
  LABEL_HEIGHT,
  MARGIN,
  QR_X,
  VERTICAL_BIAS,
  LOGO_GAP,
  LOGO_AREA_END,
  LOGO_MAX_WIDTH,
  LOGO_MAX_HEIGHT,
} from "./layout";

/** URL de produccion: 76 chars, token de 32 hex -> QR version 7, 45 modulos. */
const PROD_URL = "https://inventario-equipos-app.vercel.app/e/5f65afd604144e1bb0e6e9312bd6282c";
/** URL corta: produce un QR mas ancho y, por tanto, un area de logo distinta. */
const SHORT_URL = "http://localhost:3000/e/5f65afd604144e1bb0e6e9";

const baseData: ZplLabelData = {
  url: PROD_URL,
  assetCode: "EQ-PZH-PTZ-0001",
  typeName: "Impresora de facturas",
  restaurantName: "Pizza Hut",
  restaurantSector: "Cocina",
  restaurantLogo: "/brands/pizza-hut.jpg",
  installationDate: null,
  createdAt: "2026-09-15T12:00:00.000Z",
};

function parse(zpl: string) {
  const qr = zpl.match(/\^FO(\d+),(\d+)\n\^BQN,2,(\d+)/);
  if (!qr) throw new Error("No se encontro el bloque ^BQN");
  const gfa = zpl.match(/\^FO(\d+),(\d+)\^GFA,H,/);
  return {
    qr: { x: Number(qr[1]), y: Number(qr[2]), magnification: Number(qr[3]) },
    logo: gfa ? { x: Number(gfa[1]), y: Number(gfa[2]) } : null,
  };
}

/** Lado real del QR en dots, deducido del ZPL emitido. */
function qrSide(url: string, magnification: number): number {
  const modules = QRCode.create(url, { errorCorrectionLevel: "Q" }).modules.size;
  return modules * magnification;
}

/** Area del logo: arranca justo despues del QR y termina en el margen derecho. */
function logoAreaFor(url: string, magnification: number) {
  const side = qrSide(url, magnification);
  const areaX = QR_X + side + LOGO_GAP;
  return { side, areaX, areaWidth: LOGO_AREA_END - areaX };
}

const LOGO_PATHS: Record<string, string> = {
  "pizza-hut": "/brands/pizza-hut.jpg",
  dennys: "/brands/dennys.png",
  "china-wok": "/brands/china-wok.svg",
  kfc: "/brands/kfc.svg",
};

describe("etiqueta 406x203 para ZD230", () => {
  it("mantiene el tamaño fisico de la etiqueta", () => {
    const zpl = buildZpl(baseData);
    expect(LABEL_WIDTH).toBe(406);
    expect(LABEL_HEIGHT).toBe(203);
    expect(zpl).toContain("^PW406");
    expect(zpl).toContain("^LL203");
    expect(zpl).toContain("^LS0");
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
  });

  it("mantiene el QR en QR_X y con la misma URL publica que la preview", () => {
    const { qr } = parse(buildZpl(baseData));
    expect(qr.x).toBe(QR_X);
    expect(QR_X).toBe(14);
    expect(buildZpl(baseData)).toContain(`^FDQA,${PROD_URL}^FS`);
  });

  it("el QR de produccion mide 135 dots, el tamano que ya funciono en fisico", () => {
    const { qr } = parse(buildZpl(baseData));
    expect(qr.magnification).toBe(3);
    expect(qrSide(PROD_URL, qr.magnification)).toBe(135);
  });

  it("el QR cabe dentro del espacio disponible en 203dpi", () => {
    const { qr } = parse(buildZpl(baseData));
    const dots = qrSide(PROD_URL, qr.magnification);
    expect(dots).toBeLessThanOrEqual(LABEL_HEIGHT - 2 * MARGIN);
    expect(dots).toBeLessThanOrEqual(LABEL_WIDTH - 2 * MARGIN);
  });

  it("el QR sigue siendo dinamico: cambia de tamano segun la URL", () => {
    const prod = parse(buildZpl(baseData)).qr;
    const short = parse(buildZpl({ ...baseData, url: SHORT_URL })).qr;

    expect(short.magnification).not.toBe(prod.magnification);
    expect(qrSide(SHORT_URL, short.magnification)).not.toBe(
      qrSide(PROD_URL, prod.magnification)
    );
    for (const [url, q] of [
      ["prod", prod],
      ["short", short],
    ] as const) {
      const dots = qrSide(url === "prod" ? PROD_URL : SHORT_URL, q.magnification);
      expect(dots).toBeLessThanOrEqual(LABEL_HEIGHT - 2 * MARGIN);
      expect(dots + QR_X).toBeLessThan(LABEL_WIDTH);
    }
  });
});

describe("composicion vertical", () => {
  it("el QR queda centrado y desplazado hacia abajo, sin pegarse al borde", () => {
    const { qr } = parse(buildZpl(baseData));
    const side = qrSide(PROD_URL, qr.magnification);
    const centered = Math.floor((LABEL_HEIGHT - side) / 2);

    expect(qr.y).toBe(centered + VERTICAL_BIAS);
    expect(qr.y).toBeGreaterThan(centered);
    // Margen superior e inferior razonables para la Zebra (>= 3 mm).
    expect(qr.y).toBeGreaterThanOrEqual(24);
    expect(LABEL_HEIGHT - (qr.y + side)).toBeGreaterThanOrEqual(24);
  });

  it("el sesgo vertical nunca saca el QR de la etiqueta", () => {
    for (const url of [PROD_URL, SHORT_URL]) {
      const { qr } = parse(buildZpl({ ...baseData, url }));
      const side = qrSide(url, qr.magnification);
      expect(qr.y).toBeGreaterThanOrEqual(0);
      expect(qr.y + side).toBeLessThanOrEqual(LABEL_HEIGHT);
    }
  });

  it("el logo se centra verticalmente con el mismo sesgo que el QR", () => {
    for (const [slug, graphic] of Object.entries(ZPL_LOGO_GRAPHICS)) {
      const { logo } = parse(buildZpl({ ...baseData, restaurantLogo: LOGO_PATHS[slug] }));
      expect(logo).not.toBeNull();
      expect(logo!.y).toBe(
        Math.max(0, Math.round((LABEL_HEIGHT - graphic.height) / 2) + VERTICAL_BIAS)
      );
      // Margen inferior seguro para la Zebra.
      expect(LABEL_HEIGHT - (logo!.y + graphic.height)).toBeGreaterThanOrEqual(24);
    }
  });

  it("QR y logo quedan alineados en el eje vertical", () => {
    const { qr, logo } = parse(buildZpl(baseData));
    const graphic = ZPL_LOGO_GRAPHICS["pizza-hut"];
    const qrCenter = qr.y + qrSide(PROD_URL, qr.magnification) / 2;
    const logoCenter = logo!.y + graphic.height / 2;
    // El logo es mas bajo que el QR, pero ambos quedan cerca del centro comun.
    expect(Math.abs(qrCenter - logoCenter)).toBeLessThanOrEqual(12);
  });
});

describe("layout QR | LOGO", () => {
  it("el logo arranca justo despues del QR, sin solaparse", () => {
    const { qr, logo } = parse(buildZpl(baseData));
    const { side, areaX } = logoAreaFor(PROD_URL, qr.magnification);

    expect(logo).not.toBeNull();
    expect(qr.x + side).toBeLessThanOrEqual(logo!.x);
    expect(logo!.x - (qr.x + side)).toBeGreaterThanOrEqual(LOGO_GAP);
    expect(areaX).toBe(LOGO_GAP + QR_X + side);
  });

  it("el area del logo termina en el margen derecho de la etiqueta", () => {
    const { qr, logo } = parse(buildZpl(baseData));
    const graphic = ZPL_LOGO_GRAPHICS["pizza-hut"];
    const { areaX, areaWidth } = logoAreaFor(PROD_URL, qr.magnification);

    expect(areaX + areaWidth).toBe(LOGO_AREA_END);
    expect(LOGO_AREA_END).toBe(LABEL_WIDTH - MARGIN);
    expect(logo!.x + graphic.width).toBeLessThanOrEqual(LOGO_AREA_END);
    expect(LABEL_WIDTH - (logo!.x + graphic.width)).toBeGreaterThanOrEqual(MARGIN);
  });

  it("el area del logo sigue al ancho real del QR", () => {
    const prod = parse(buildZpl(baseData)).qr;
    const short = parse(buildZpl({ ...baseData, url: SHORT_URL })).qr;
    const prodArea = logoAreaFor(PROD_URL, prod.magnification);
    const shortArea = logoAreaFor(SHORT_URL, short.magnification);

    expect(prodArea.areaX).not.toBe(shortArea.areaX);
    // QR mas ancho deja menos sitio: el area se estrecha, nunca se invierte.
    expect(shortArea.areaWidth).toBeLessThan(prodArea.areaWidth);
    expect(shortArea.areaWidth).toBeGreaterThan(0);
  });

  it("el logo se centra dentro de su area disponible", () => {
    for (const [slug, graphic] of Object.entries(ZPL_LOGO_GRAPHICS)) {
      const { qr, logo } = parse(buildZpl({ ...baseData, restaurantLogo: LOGO_PATHS[slug] }));
      const { areaX, areaWidth } = logoAreaFor(PROD_URL, qr.magnification);
      const expectedX = areaX + Math.max(0, Math.round((areaWidth - graphic.width) / 2));

      expect(logo!.x).toBe(expectedX);
      const left = logo!.x - areaX;
      const right = areaX + areaWidth - (logo!.x + graphic.width);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    }
  });

  it("el logo no se sale de la etiqueta ni del area, para ninguna URL", () => {
    for (const url of [PROD_URL, SHORT_URL]) {
      const { qr, logo } = parse(buildZpl({ ...baseData, url }));
      const graphic = ZPL_LOGO_GRAPHICS["pizza-hut"];
      const { areaX, areaWidth } = logoAreaFor(url, qr.magnification);
      expect(logo!.x).toBeGreaterThanOrEqual(areaX);
      expect(logo!.x + graphic.width).toBeLessThanOrEqual(areaX + areaWidth);
    }
  });
});

describe("logos", () => {
  it("respeta la caja maxima de 194x110 dots", () => {
    expect(LOGO_MAX_WIDTH).toBe(194);
    expect(LOGO_MAX_HEIGHT).toBe(110);
    for (const graphic of Object.values(ZPL_LOGO_GRAPHICS)) {
      expect(graphic.width).toBeLessThanOrEqual(LOGO_MAX_WIDTH);
      expect(graphic.height).toBeLessThanOrEqual(LOGO_MAX_HEIGHT);
    }
  });

  it("el area del logo sigue siendo suficiente aunque el QR crezca al maximo", () => {
    // El peor caso es el QR mas grande que puede emitir el builder.
    const maxQrSide = Math.min(LABEL_HEIGHT, LABEL_WIDTH) - 2 * MARGIN;
    const worstAreaWidth = LOGO_AREA_END - (QR_X + maxQrSide + LOGO_GAP);
    for (const graphic of Object.values(ZPL_LOGO_GRAPHICS)) {
      expect(graphic.width).toBeLessThanOrEqual(worstAreaWidth);
    }
  });

  it("los cuatro logos quedan a la misma altura, para verse del mismo tamaño", () => {
    // La caja es 194x110: como el ancho no limita a ninguno, todos se rigen
    // por altura. Esa es la razon de que Pizza Hut ya no salga 135x76.
    const heights = Object.values(ZPL_LOGO_GRAPHICS).map((g) => g.height);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    for (const graphic of Object.values(ZPL_LOGO_GRAPHICS)) {
      expect(graphic.height).toBeGreaterThanOrEqual(105);
    }
  });

  it("mantiene la proporcion original de cada logo generado", () => {
    const sourceAspect = {
      "pizza-hut": 1668 / 938,
      dennys: 3000 / 2000,
      "china-wok": 657 / 533,
      kfc: 11548 / 10720,
    };
    for (const [slug, graphic] of Object.entries(ZPL_LOGO_GRAPHICS)) {
      const expected = sourceAspect[slug as keyof typeof sourceAspect];
      expect(expected).toBeDefined();
      const actual = graphic.width / graphic.height;
      expect(Math.abs(actual - expected) / expected).toBeLessThan(0.005);
    }
  });

  it("usa los bitmaps correctos: Pizza Hut del jpg y Denny's del png", () => {
    expect(logoGraphicFor("/brands/pizza-hut.jpg")).toBe(ZPL_LOGO_GRAPHICS["pizza-hut"]);
    expect(logoGraphicFor("/brands/dennys.png")).toBe(ZPL_LOGO_GRAPHICS["dennys"]);
    expect(logoGraphicFor("/brands/china-wok.svg")).toBe(ZPL_LOGO_GRAPHICS["china-wok"]);
    expect(logoGraphicFor("/brands/kfc.svg")).toBe(ZPL_LOGO_GRAPHICS["kfc"]);

    // Los cuatro se generan a tamano de impresion, ya con la caja 194x110.
    expect(ZPL_LOGO_GRAPHICS["pizza-hut"].width).toBe(194);
    expect(ZPL_LOGO_GRAPHICS["pizza-hut"].height).toBe(109);
    expect(ZPL_LOGO_GRAPHICS["dennys"].width).toBe(165);
    expect(ZPL_LOGO_GRAPHICS["dennys"].height).toBe(110);
    expect(ZPL_LOGO_GRAPHICS["china-wok"].width).toBe(136);
    expect(ZPL_LOGO_GRAPHICS["kfc"].width).toBe(118);
  });

  it("embebe el bloque ^GFA del logo de la marca", () => {
    const zpl = buildZpl(baseData);
    expect(zpl).toContain("^GFA,H,");
    expect(zpl).toContain(ZPL_LOGO_GRAPHICS["pizza-hut"].hex);
  });

  it("omite el logo cuando no hay logo o la marca es desconocida", () => {
    expect(buildZpl({ ...baseData, restaurantLogo: null })).not.toContain("^GFA");
    expect(buildZpl({ ...baseData, restaurantLogo: "/brands/xxx.svg" })).not.toContain("^GFA");
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

describe("sin texto impreso", () => {
  it("no emite ningun comando de texto", () => {
    const zpl = buildZpl(baseData);
    // ^FD solo puede aparecer en el bloque del QR, con prefijo ^FDQA,
    expect(zpl).not.toMatch(/\^FD(?!QA,)/);
    expect(zpl).not.toMatch(/\^A0N|\^A0R|\^FB/);
  });

  it("no imprime nombre, tipo, fecha ni asset code", () => {
    for (const patch of [
      {},
      { restaurantName: "Denny's", typeName: "Televisión", restaurantLogo: "/brands/dennys.png" },
      { restaurantName: "China Wok", typeName: "Mini-PC", restaurantLogo: "/brands/china-wok.svg" },
      { restaurantName: "KFC", typeName: "Impresora Zebra ZD230", restaurantLogo: "/brands/kfc.svg" },
      { assetCode: "EQ-KFC-PRN-0001", installationDate: "2026-09-15T12:00:00.000Z" },
    ] satisfies Partial<ZplLabelData>[]) {
      const zpl = buildZpl({ ...baseData, ...patch });
      expect(zpl, `texto en ${JSON.stringify(patch)}`).not.toContain("Pizza Hut");
      expect(zpl).not.toContain("Denny's");
      expect(zpl).not.toContain("IMPRESORA");
      expect(zpl).not.toContain("Generación");
      expect(zpl).not.toContain("Instalación");
      expect(zpl).not.toContain("EQ-PZH-PTZ-0001");
      expect(zpl).not.toContain("EQ-KFC-PRN-0001");
      expect(zpl).not.toMatch(/sep 2026|2026/);
    }
  });

  it("solo quedan dos elementos graficos: el QR y el logo", () => {
    const zpl = buildZpl(baseData);
    expect(zpl.match(/\^BQN,/g)).toHaveLength(1);
    expect(zpl.match(/\^GFA,/g)).toHaveLength(1);
  });

  it("sanea la URL del QR para evitar inyeccion de comandos ZPL", () => {
    const zpl = buildZpl({ ...baseData, url: `${PROD_URL}^FS^XA^XZ` });
    expect(zpl).not.toContain("^FS^XA^XZ");
  });

  it("no incluye secretos en el ZPL generado", () => {
    expect(buildZpl(baseData)).not.toMatch(
      /TURSO_AUTH_TOKEN|BETTER_AUTH_SECRET|OPENROUTER/i
    );
  });
});
