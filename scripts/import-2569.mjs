// One-time import of the 2569 material placed in _import/ (gitignored — source files are never committed).
//   node scripts/import-2569.mjs assets     logos, favicon, og:image, banner 02 slides -> public/ + app/
//   node scripts/import-2569.mjs banners    banner 02 (SCUTD 2026 + 2 memorial banners) -> public/banners/
//   node scripts/import-2569.mjs credits    footer credit avatar -> public/credits/
//   node scripts/import-2569.mjs members    portrait card + full poster per member -> Supabase Storage "pending"
//                                           (private; copied to the public bucket only when photo consent is on)
// Images are taken out of the PDFs as embedded (JPEG bytes / raw pixels) — never re-drawn, retouched or overlaid.
// Needs (members): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import zlib from "node:zlib";
import sharp from "sharp";

const SRC = "_import";
const step = process.argv[2];

// ───────────────────────── PDF image extraction ─────────────────────────
function pdfImages(file) {
  const buf = readFileSync(file);
  const s = buf.toString("latin1");
  const re = /(\d+) 0 obj\s*<<([\s\S]*?)>>\s*stream\r?\n/g;
  const out = [];
  let m;
  while ((m = re.exec(s))) {
    const dict = m[2];
    if (!/\/Subtype ?\/Image/.test(dict)) continue;
    if (s.includes(`/SMask ${m[1]} 0 R`)) continue; // a soft mask, not a picture
    const start = m.index + m[0].length;
    const len = dict.match(/\/Length (\d+)(?! 0 R)/);
    const data = buf.subarray(start, len ? start + Number(len[1]) : s.indexOf("endstream", start));
    const w = Number(dict.match(/\/Width (\d+)/)[1]);
    const h = Number(dict.match(/\/Height (\d+)/)[1]);
    if (/\/DCTDecode/.test(dict)) out.push({ w, h, input: data });
    else if (/\/FlateDecode/.test(dict)) {
      const ch = /\/DeviceGray/.test(dict) ? 1 : 3;
      if (/\/Predictor/.test(dict)) throw new Error(`${file}: PNG predictor not supported`);
      out.push({ w, h, input: zlib.inflateSync(data), raw: { width: w, height: h, channels: ch } });
    }
  }
  return out;
}
const load = (img) => sharp(img.input, img.raw ? { raw: img.raw } : undefined);

// ───────────────────────── assets ─────────────────────────
async function assets() {
  mkdirSync("public/brand", { recursive: true });
  mkdirSync(`${SRC}/out/brander`, { recursive: true });

  // council logo: black background -> transparent (flood fill of near-black pixels connected to the edge only;
  // the logo's own dark outlines are not connected to the edge, so they stay)
  const { data, info } = await sharp(`${SRC}/logo-council.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, seen = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) stack.push(0, y, W - 1, y);
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (seen[p]) continue;
    seen[p] = 1;
    if (data[p * 4] > 18 || data[p * 4 + 1] > 18 || data[p * 4 + 2] > 18) continue;
    data[p * 4 + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  const council = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer();
  const school = await sharp(`${SRC}/logo-school.png`).trim({ threshold: 0 }).png().toBuffer();

  for (const [name, buf] of [["council", council], ["school", school]]) {
    for (const size of [128, 256]) {
      const img = sharp(buf).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
      await img.clone().avif({ quality: 60 }).toFile(`public/brand/logo-${name}-${size}.avif`);
      await img.clone().webp({ quality: 85, alphaQuality: 90 }).toFile(`public/brand/logo-${name}-${size}.webp`);
      await img.clone().png({ compressionLevel: 9 }).toFile(`public/brand/logo-${name}-${size}.png`);
    }
  }
  // favicon / app icons (council logo on transparent) + Open Graph card (navy, both logos, no text)
  await sharp(council).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ palette: true, quality: 90 }).toFile("app/icon.png");
  // favicon.ico: PNG images embedded in an ICO container (16/32/48 px)
  const icons = await Promise.all([16, 32, 48].map((n) => sharp(council).resize(n, n, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()));
  const head = Buffer.alloc(6 + 16 * icons.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(icons.length, 4);
  let offset = head.length;
  icons.forEach((png, i) => {
    const n = [16, 32, 48][i], e = 6 + 16 * i;
    head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  writeFileSync("app/favicon.ico", Buffer.concat([head, ...icons]));
  // web app manifest icons (app/manifest.ts)
  for (const n of [192, 512]) {
    await sharp(council).resize(n, n, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ palette: true, quality: 90 }).toFile(`public/brand/icon-${n}.png`);
  }
  await sharp(council).resize(180, 180, { fit: "contain", background: "#0b1f4d" }).flatten({ background: "#0b1f4d" }).png().toFile("app/apple-icon.png");
  const lg = async (b) => sharp(b).resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#0b1f4d" } })
    .composite([{ input: await lg(school), left: 200, top: 135 }, { input: await lg(council), left: 640, top: 135 }])
    .png({ palette: true, quality: 90 }).toFile("app/[locale]/opengraph-image.png");

  // brander/*.pdf: three council group photos (not banners) -> _import/out/brander (outside git; they live in Supabase Storage)
  const files = ["IMG_6115", "IMG_6116", "IMG_6118"];
  const meta = [];
  for (const [i, f] of files.entries()) {
    const [img] = pdfImages(`${SRC}/brander/${f}.pdf`);
    const name = `brander-${i + 1}`;
    for (const w of [640, 1280, 1920, 2048]) {
      const r = load(img).rotate().resize({ width: w, withoutEnlargement: true });
      await r.clone().avif({ quality: 55 }).toFile(`${SRC}/out/brander/${name}-${w}.avif`);
      await r.clone().webp({ quality: 80 }).toFile(`${SRC}/out/brander/${name}-${w}.webp`);
    }
    const m = await load(img).rotate().resize({ width: 2048, withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    const blur = await load(img).rotate().resize(16).webp({ quality: 40 }).toBuffer();
    meta.push({ name, source: `${f}.pdf`, w: m.info.width, h: m.info.height, blur: `data:image/webp;base64,${blur.toString("base64")}` });
  }
  writeFileSync(`${SRC}/out/brander/brander.json`, JSON.stringify(meta, null, 2) + "\n");
  console.log("assets done:", meta.map((m) => `${m.name} ${m.w}x${m.h}`).join(", "));
}

// ───────────────────────── members ─────────────────────────
// Card: head-and-shoulders box (same for all 16 posters, checked by eye on a contact sheet): no frame, logo or text.
// Popup: the whole poster as delivered.
const CARD = { left: 320, top: 200, width: 440, height: 550 };
const MAX = 80 * 1024;

async function under(img, fmt, startQ) {
  for (let q = startQ; q >= 30; q -= 5) {
    const b = await img.clone()[fmt]({ quality: q }).toBuffer();
    if (b.length <= MAX) return b;
  }
  throw new Error(`cannot fit ${fmt} under 80 KB`);
}

async function members() {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  const data = JSON.parse(readFileSync(process.env.MEMBERS_FILE || `${SRC}/members-2569.content.json`, "utf8"));
  const pages = pdfImages(`${SRC}/SCC.pdf`);
  if (pages.length !== data.members.length) throw new Error(`SCC.pdf has ${pages.length} pages, expected ${data.members.length}`);
  for (const m of data.members) {
    const page = pages[m.posterPage - 1];
    if (page.w !== 1080 || page.h !== 1350) throw new Error(`page ${m.posterPage}: ${page.w}x${page.h}`);
    const base = `members/${data.academicYearBE}/${String(m.order).padStart(2, "0")}`;
    const card = load(page).extract(CARD);
    const poster = load(page).resize(720, 900);
    const files = {
      [`${base}-card.avif`]: await under(card, "avif", 60),
      [`${base}-card.webp`]: await under(card, "webp", 82),
      [`${base}-poster.avif`]: await under(poster, "avif", 55),
      [`${base}-poster.webp`]: await under(poster, "webp", 78),
    };
    for (const [path, body] of Object.entries(files)) {
      const r = await fetch(`${url}/storage/v1/object/pending/${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": path.endsWith(".avif") ? "image/avif" : "image/webp", "x-upsert": "true" },
        body,
      });
      if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    }
    console.log(`${base}: ${Object.values(files).map((b) => Math.round(b.length / 1024) + "KB").join(" / ")}`);
  }
}

// banner 02: _import/banner-02/banner-02-0N.jpg (4860x2110, artwork with text) exactly as delivered — no crop,
// no edit, nothing drawn over it — as AVIF + WebP 640 / 1280 / 1920 + a 16 px blur placeholder
async function banners() {
  mkdirSync("public/banners", { recursive: true });
  const meta = [];
  for (const n of [1, 2, 3]) {
    const src = `${SRC}/banner-02/banner-02-0${n}.jpg`;
    const name = `banner-02-${n}`;
    for (const w of [640, 1280, 1920]) {
      const r = sharp(src).rotate().resize({ width: w, withoutEnlargement: true });
      await r.clone().avif({ quality: 60 }).toFile(`${SRC}/out/brander/${name}-${w}.avif`);
      await r.clone().webp({ quality: 82 }).toFile(`${SRC}/out/brander/${name}-${w}.webp`);
    }
    const m = await sharp(src).rotate().resize({ width: 1920, withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    const blur = await sharp(src).rotate().resize(16).webp({ quality: 40 }).toBuffer();
    meta.push({ name, source: `banner-02-0${n}.jpg`, w: m.info.width, h: m.info.height, blur: `data:image/webp;base64,${blur.toString("base64")}` });
  }
  writeFileSync("content/banners-02.json", JSON.stringify(meta, null, 2) + "\n");
  console.log("banners done:", meta.map((m) => `${m.name} ${m.w}x${m.h}`).join(", "));
}

// footer credit avatar: _import/ev1yn.png -> public/credits/ev1yn-{96,192}.{avif,webp}
async function credits() {
  mkdirSync("public/credits", { recursive: true });
  for (const n of [96, 192]) {
    const img = sharp(`${SRC}/ev1yn.png`).resize(n, n, { fit: "cover" });
    await img.clone().avif({ quality: 60 }).toFile(`public/credits/ev1yn-${n}.avif`);
    await img.clone().webp({ quality: 82 }).toFile(`public/credits/ev1yn-${n}.webp`);
  }
  console.log("credits done");
}

if (step === "assets") await assets();
else if (step === "credits") await credits();
else if (step === "banners") await banners();
else if (step === "members") await members();
else console.log("usage: node scripts/import-2569.mjs assets|banners|members|credits");
