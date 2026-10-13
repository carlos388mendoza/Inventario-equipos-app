import sharp from "sharp";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

const src = resolve("public/logo-grupo-comidas.png");
const out = (name) => resolve("public", name);

const meta = await sharp(src).metadata();
const square = Math.min(meta.width ?? 0, meta.height ?? 0);

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

// Recorta el logo al cuadrado más grande posible (sin distorsionar).
const logo = await sharp(src)
  .resize({
    width: square,
    height: square,
    fit: "contain",
    background: transparent,
  })
  .png()
  .toBuffer();

async function writeIcon(name, size) {
  await sharp(logo)
    .resize({
      width: size,
      height: size,
      fit: "contain",
      background: transparent,
    })
    .png()
    .toFile(out(name));
}

await writeIcon("apple-touch-icon.png", 180);
await writeIcon("icon-192.png", 192);
await writeIcon("icon-512.png", 512);

// Maskable: contenido al 70% del canvas, zona segura de las plataformas.
const MASK = 512;
const content = Math.round(MASK * 0.7);
const offset = Math.round((MASK - content) / 2);
const centered = await sharp(logo)
  .resize({
    width: content,
    height: content,
    fit: "contain",
    background: transparent,
  })
  .png()
  .toBuffer();

await sharp({
  create: { width: MASK, height: MASK, channels: 4, background: transparent },
})
  .composite([{ input: centered, left: offset, top: offset }])
  .png()
  .toFile(out("icon-maskable-512.png"));

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
    images.push(
      await sharp(logo)
        .resize({
          width: size,
          height: size,
          fit: "contain",
          background: transparent,
        })
        .png()
        .toBuffer()
    );
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

console.log("Iconos PWA y favicon generados.");