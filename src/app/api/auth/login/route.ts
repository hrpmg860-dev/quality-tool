import { type NextRequest, NextResponse } from "next/server";
import { API_URL, csrfOk, forwardHeaders, problem, setSessionCookies, type TokenOut } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!csrfOk(req)) return problem(403, "Forbidden", "missing or invalid CSRF header", "csrf");
  const body = await req.text();
  const headers = forwardHeaders(req);
  headers.set("content-type", "application/json");
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/auth/login`, { method: "POST", headers, body, cache: "no-store" });
  } catch {
    return problem(502, "Bad Gateway", "the Opscore API is unreachable", "api_unreachable");
  }
  if (!upstream.ok) {
    return new NextResponse(upstream.body, {
      status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }
  const tokens = (await upstream.json()) as TokenOut;
  const res = new NextResponse(null, { status: 204 });
  setSessionCookies(res, tokens);
  return res;
}
