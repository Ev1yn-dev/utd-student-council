import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// 1200x630 share images (Open Graph / Twitter) drawn from text only: site colours, the council emblem, Kanit (Thai).
// Never a photo, so no student ever appears in a generated image.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

// literal paths: the build traces exactly these three files (a computed path would trace the whole project)
let assets: Promise<[Buffer, Buffer, string]> | null = null;
const load = () =>
  (assets ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Kanit-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Kanit-Regular.ttf")),
    readFile(join(process.cwd(), "public/brand/logo-council-256.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`),
  ]));

/** title: the page; kicker: small line above it; footer: tagline under it. */
export async function ogImage({ title, kicker, footer }: { title: string; kicker: string; footer: string }) {
  const [semi, regular, logo] = await load();
  const size = title.length > 60 ? 48 : title.length > 34 ? 58 : 70;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "linear-gradient(120deg, #050d24 0%, #0b1f4d 55%, #1d3b8b 100%)", color: "#ffffff", fontFamily: "Kanit" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
          <img src={logo} width={112} height={112} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 600 }}>{kicker}</span>
            <span style={{ fontSize: 24, fontWeight: 400, color: "#fde7f0" }}>utdsc.com</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: size, fontWeight: 600, lineHeight: 1.25, maxWidth: 1040 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 96, height: 8, borderRadius: 8, background: "#e8508b" }} />
          <span style={{ fontSize: 28, fontWeight: 400, color: "#f6ecc8" }}>{footer}</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Kanit", data: semi, weight: 600, style: "normal" },
        { name: "Kanit", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
