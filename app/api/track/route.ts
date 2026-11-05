import { isSameOrigin } from "@/lib/security";
import { recordVisit } from "@/lib/visits";

const done = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

/**
 * Page-view beacon (navigator.sendBeacon from components/layout/VisitBeacon.tsx). No cookies; always answers 204 so
 * callers learn nothing. Rate limited per IP by proxy.ts (/api bucket).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return done();
  const text = await req.text();
  if (text.length > 2048) return done();
  let body: { p?: unknown; r?: unknown } = {};
  try {
    const j: unknown = JSON.parse(text);
    if (j && typeof j === "object") body = j as typeof body;
  } catch {
    return done();
  }
  await recordVisit(req.headers, body);
  return done();
}
