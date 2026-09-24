import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRANDS_DIR = join(ROOT, "public", "brands");
const OUT_FILE = join(ROOT, "lib", "zpl", "graphics.generated.ts");

const MAX_WIDTH = 96;
const MAX_HEIGHT = 40;

function isDarkMark(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum <= 110) return true;
  return r >= 100 && r >= g && r >= b && max - min > 45 && r - b >= 15;
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
  const pixels = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    pixels[i] = isDarkMark(raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]) ? 1 : 0;
  }

  const graphic = encodeGfaBits(info.width, info.height, pixels);
  return { slug, width: info.width, height: info.height, ...graphic, mode: "red", source: file };
}

async function main() {
  const files = readdirSync(BRANDS_DIR)
    .filter((f) => /\.(svg|png)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`No hay archivos de logo en ${BRANDS_DIR}`);
    process.exit(1);
  }

  const logos = [];
  for (const file of files) {
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