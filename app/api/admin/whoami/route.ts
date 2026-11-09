import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { ipAllowlisted } from "@/lib/rl-bypass";
import { clientIp } from "@/lib/security";

/**
 * Administrators only: the client IP exactly as the rate limits see it (lib/client-ip.ts), to copy into
 * RATE_LIMIT_ALLOW_IPS. Anyone else gets a plain 404.
 */
export async function GET(req: Request) {
  if (!(await authorize(["admin"]))) return new NextResponse("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  const ip = clientIp(req.headers);
  return NextResponse.json(
    {
      ip,
      source: ip !== "unknown" && req.headers.get("cf-connecting-ip")?.trim() === ip ? "cf-connecting-ip" : "x-forwarded-for",
      allowlisted: ipAllowlisted(ip),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
