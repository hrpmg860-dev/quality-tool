import { type NextRequest, NextResponse } from "next/server";
import { API_URL, COOKIES, clearSessionCookies, csrfOk, forwardHeaders, problem } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!csrfOk(req)) return problem(403, "Forbidden", "missing or invalid CSRF header", "csrf");
  const refresh = req.cookies.get(COOKIES.refresh)?.value;
  if (refresh) {
    const headers = forwardHeaders(req);
    headers.set("content-type", "application/json");
    // Best effort: revoke the refresh-token family server-side.
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST", headers, body: JSON.stringify({ refresh_token: refresh }), cache: "no-store",
    }).catch(() => undefined);
  }
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookies(res);
  return res;
}
