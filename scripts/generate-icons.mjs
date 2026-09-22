import sharp from "sharp";
import { resolve } from "node:path";

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

console.log("Iconos PWA generados en public/");