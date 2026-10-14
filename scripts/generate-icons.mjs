import sharp from "sharp";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

const src = resolve("public/logo-grupo-comidas.png");
const out = (name) => resolve("public", name);

/**
 * Fondo "horneado" en el PNG corporativo (RGB 247,247,247 = #F7F7F7). Se usa
 * como relleno de la placa circular: así el recuadro transparente del logo se
 * funde con el disco y no aparece ninguna costura rectangular.
 */
const LOGO_BG = "#F7F7F7";
/** Anillo sutil para que el círculo se perciba también sobre fondos claros. */
const RING = "#D4D4D8";
/** Lado del logo respecto al lado del icono (contain, con margen interior). */
const LOGO_RATIO = 0.8;
/** Zona segura de los iconos "maskable" (Android): contenido al 60%. */
const MASKABLE_RATIO = 0.6;

// Recorta el borde uniforme del logo (no destructivo: solo en memoria).
const trimmed = await sharp(src).trim({ threshold: 10 }).png().toBuffer();

/**
 * SVG de la placa circular. El disco es full-bleed (llega al borde del icono);
 * el anillo se omite en tamaños muy pequeños, donde quedaría sub-píxel.
 */
function plateSvg(size) {
  const stroke =
    size >= 48 ? Math.max(2, Math.round(size * 0.02)) : size >= 16 ? 1 : 0;
  const radius = size / 2 - stroke / 2;
  const ring =
    stroke > 0 ? ` stroke="${RING}" stroke-width="${stroke}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${LOGO_BG}"${ring}/>` +
    `</svg>`
  );
}

async function logoContained(box) {
  return sharp(trimmed)
    .resize({ width: box, height: box, fit: "contain", background: LOGO_BG })
    .png()
    .toBuffer();
}

/** Icono circular: disco de fondo + logo completo contenido y centrado. */
async function circularIcon(size) {
  const plate = await sharp(Buffer.from(plateSvg(size))).png().toBuffer();
  const logo = await logoContained(Math.round(size * LOGO_RATIO));
  return sharp(plate)
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

/** Icono maskable: fondo a sangre y logo dentro de la zona segura. */
async function maskableIcon(size) {
  const base = await sharp({
    create: { width: size, height: size, channels: 4, background: LOGO_BG },
  })
    .png()
    .toBuffer();
  const logo = await logoContained(Math.round(size * MASKABLE_RATIO));
  return sharp(base)
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function writeIcon(name, size) {
  await writeFile(out(name), await circularIcon(size));
}

await writeIcon("apple-touch-icon.png", 180);
await writeIcon("icon-192.png", 192);
await writeIcon("icon-512.png", 512);

await writeFile(out("icon-maskable-512.png"), await maskableIcon(512));

// Icono del sitio (`app/icon.png`): misma presentación circular que el favicon.
await writeFile(resolve("app", "icon.png"), await circularIcon(256));

/**
 * Favicon `.ico` (issue #7). Next.js sirve `app/favicon.ico` en `/favicon.ico`,
 * la ruta que piden los navegadores por defecto. Se empaquetan varios tamaños
 * en un solo archivo (16, 32, 48 y 256 px) para que la pestaña, los marcadores
 * y las pantallas de alta densidad tengan una versión nítida.
 */
async function buildFavicon() {
  const sizes = [16, 32, 48, 256];

  const images = [];
  for (const size of sizes) {
    images.push(await circularIcon(size));
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo 1 = icono
  header.writeUInt16LE(sizes.length, 4);

  const entries = [];
  let offset = header.length + 16 * sizes.length;
  for (let index = 0; index < sizes.length; index++) {
    const size = sizes[index];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // ancho (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // alto (0 = 256)
    entry.writeUInt8(0, 2); // colores de paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(images[index].length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += images[index].length;
  }

  const favicon = Buffer.concat([header, ...entries, ...images]);
  await writeFile(resolve("app", "favicon.ico"), favicon);
}

await buildFavicon();

console.log("Iconos circulares (PWA, app y favicon) generados.");
