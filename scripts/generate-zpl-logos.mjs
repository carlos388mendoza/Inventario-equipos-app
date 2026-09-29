import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRANDS_DIR = join(ROOT, "public", "brands");
const OUT_FILE = join(ROOT, "lib", "zpl", "graphics.generated.ts");

// Caja maxima del logo en la etiqueta. Debe coincidir con LOGO_MAX_WIDTH /
// LOGO_MAX_HEIGHT de lib/zpl/layout.ts: el bitmap se imprime 1:1 en dots, asi
// que el generador tiene que emitirlo ya al tamano final de impresion.
const MAX_WIDTH = 194;
const MAX_HEIGHT = 110;

/** Extensiones de logo aceptadas, en orden de prioridad por slug. */
const SOURCE_RANK = /\.(png|jpe?g|svg)$/i;
const RASTER = /\.(png|jpe?g)$/i;

/**
 * Umbral de luminancia para decidir que se imprime en negro.
 *
 * El ZPL es monocromo de 1 bit: no existe gris, asi que la unica decision
 * posible es luminancia. La version anterior anadia una regla ad-hoc que
 * marcaba cualquier pixel rojizo (r >= 100 && max-min > 45 && r-b >= 15).
 * Esa regla tambien capturaba los rojos claros y de alto contraste, y por eso
 * el logotipo de Denny's (rojo 240,50,54 sobre fondo dorado) salia como un
 * bloque negro solido en lugar de como lettering. Se eliminó: basta la
 * luminancia, y el alfa ya se resuelve con flatten() sobre blanco.
 */
const DARK_LUMINANCE = 110;

/**
 * Binarizacion por slug para los logos que no son "trazo oscuro sobre fondo
 * transparente" sino una figura de color claro.
 *
 * En "badge" la figura lleva un anillo exterior mas oscuro que su relleno, y
 * con DARK_LUMINANCE (110) el anillo queda en blanco: la figura desaparece y
 * solo se imprime el lettering. El anillo y el relleno estan separados por un
 * valle claro de luminancia, asi que basta un umbral mas alto que incluya el
 * anillo y deje el relleno en blanco, en vez de rellenar toda la figura.
 *
 * Mediciones sobre public/brands/dennys.png a 165x110 (RGB compuesto):
 *   anillo exterior  rgb(253,192,45)  -> luminancia 194
 *   relleno interior rgb(255,222,35)  -> luminancia 216
 *   lettering        rgb(237,51,56)   -> luminancia  91
 * El valle cae en ~205: por debajo entra el anillo y el lettering, por encima
 * queda solo el relleno dorado.
 *
 * Los logos con trazo oscuro (pizza-hut, china-wok, kfc) no aparecen aqui y
 * siguen usando DARK_LUMINANCE sin cambios.
 */
const BADGE_LUMINANCE = 205;

const BINARIZATION_BY_SLUG = {
  dennys: BADGE_LUMINANCE,
};

function isDarkMark(r, g, b, maxLuminance) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b <= maxLuminance;
}

function encodeGfaBits(width, height, pixels) {
  const rawBytesPerRow = Math.ceil(width / 8);
  const bytesPerRow = rawBytesPerRow % 2 === 0 ? rawBytesPerRow : rawBytesPerRow + 1;
  const bytes = new Uint8Array(height * bytesPerRow);
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      if (pixels[r * width + c]) {
        const byteIndex = r * bytesPerRow + (c >> 3);
        bytes[byteIndex] |= 0x80 >> (c & 7);
      }
    }
  }
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return { bytesPerRow, rows: height, hex };
}

async function processBrand(file) {
  const slug = basename(file, extname(file));
  const input = join(BRANDS_DIR, file);

  const meta = await sharp(input, { density: 203 }).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) throw new Error(`Sin dimensiones para ${file}`);

  const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const { data, info } = await sharp(input, { density: 203 })
    .resize(targetWidth, targetHeight, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const total = info.width * info.height;
  const raw = new Uint8Array(data);
  const maxLuminance = BINARIZATION_BY_SLUG[slug] ?? DARK_LUMINANCE;
  const pixels = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    pixels[i] = isDarkMark(raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2], maxLuminance) ? 1 : 0;
  }

  const graphic = encodeGfaBits(info.width, info.height, pixels);
  return { slug, width: info.width, height: info.height, ...graphic, mode: "red", source: file };
}

async function main() {
  const files = readdirSync(BRANDS_DIR)
    .filter((f) => SOURCE_RANK.test(f))
    .sort((a, b) => {
      // Si un slug tiene varias fuentes, gana la raster (jpg/png) sobre el svg.
      const rank = (f) => (RASTER.test(f) ? 0 : 1);
      return rank(a) - rank(b) || a.localeCompare(b);
    });

  if (files.length === 0) {
    console.error(`No hay archivos de logo en ${BRANDS_DIR}`);
    process.exit(1);
  }

  const logos = [];
  const seen = new Set();
  for (const file of files) {
    const slug = basename(file, extname(file));
    if (seen.has(slug)) {
      console.log(`${slug}: se omite ${file} (ya existe una fuente con prioridad)`);
      continue;
    }
    seen.add(slug);
    logos.push(await processBrand(file));
  }

  const lines = [];
  lines.push("/* GENERADO por scripts/generate-zpl-logos.mjs — NO editar a mano.");
  lines.push("   Recursos monocromo exclusivos para impresion ZPL. No sustituir");
  lines.push("   los SVGs de public/brands/ ni la preview web. */");
  lines.push("");
  lines.push("export interface ZplLogoGraphic {");
  lines.push("  width: number;");
  lines.push("  height: number;");
  lines.push("  bytesPerRow: number;");
  lines.push("  rows: number;");
  lines.push("  hex: string;");
  lines.push("  inverted: boolean;");
  lines.push("}");
  lines.push("");
  lines.push("export const ZPL_LOGO_GRAPHICS: Record<string, ZplLogoGraphic> = {");
  for (const logo of logos) {
    lines.push(`  ${JSON.stringify(logo.slug)}: {`);
    lines.push(`    width: ${logo.width},`);
    lines.push(`    height: ${logo.rows},`);
    lines.push(`    bytesPerRow: ${logo.bytesPerRow},`);
    lines.push(`    rows: ${logo.rows},`);
    lines.push(`    hex: ${JSON.stringify(logo.hex)},`);
    lines.push(`    inverted: false,`);
    lines.push("  },");
  }
  lines.push("};");
  lines.push("");

  writeFileSync(OUT_FILE, lines.join("\n"), "utf8");

  for (const logo of logos) {
    console.log(
      `${logo.slug}: ${logo.width}x${logo.rows} hex=${logo.hex.length} chars (${logo.source})`
    );
  }
  console.log(`OK -> ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});