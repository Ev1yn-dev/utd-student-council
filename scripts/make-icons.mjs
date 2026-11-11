// Favicons from the council crest (the emblem in the header): white square, crest centred with padding.
//   app/favicon.ico      16 + 32 + 48 (PNG-compressed ICO entries)
//   app/icon.png         192 x 192   (<link rel="icon">, a multiple of 48 as Google asks for favicons)
//   app/apple-icon.png   180 x 180   (<link rel="apple-touch-icon">; Apple's size, opaque)
//   public/brand/favicon-192.png, favicon-512.png (web manifest; new names: /brand files are cached immutable)
// Usage: node scripts/make-icons.mjs [source=_import/logo-council.png]
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = process.argv[2] ?? "_import/logo-council.png";
const PAD = 0.08; // share of the side left empty around the crest

/**
 * The source crest sits on a black square. The background is removed by flood fill from the edges (only dark pixels
 * connected to the border become transparent), so dark lines inside the crest stay; then it is trimmed.
 */
async function crestOnly() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const dark = (i) => data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] < 3 * 40;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !dark(i)) continue;
    seen[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer().then((b) => sharp(b).trim().png().toBuffer());
}
const CREST = await crestOnly();

async function square(size, { pad = PAD } = {}) {
  const inner = Math.round(size * (1 - 2 * pad));
  const crest = await sharp(CREST).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: crest, gravity: "center" }])
    .png({ compressionLevel: 9 }) // RGBA (ICO decoders reject palette PNG entries)
    .toBuffer();
}

/** ICO container with PNG entries (supported by every browser in use and by Google's favicon fetcher). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); // no palette
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...images.map((x) => x.png)]);
}

const sizes = [16, 32, 48];
const icoImages = await Promise.all(sizes.map(async (size) => ({ size, png: await square(size, { pad: size <= 32 ? 0.04 : PAD }) })));
writeFileSync("app/favicon.ico", ico(icoImages));
writeFileSync("app/icon.png", await square(192));
writeFileSync("app/apple-icon.png", await sharp(await square(180)).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toBuffer());
writeFileSync("public/brand/favicon-192.png", await square(192));
writeFileSync("public/brand/favicon-512.png", await square(512));
console.log("icons written: app/favicon.ico (16/32/48), app/icon.png 192, app/apple-icon.png 180, public/brand/favicon-192.png, favicon-512.png");
