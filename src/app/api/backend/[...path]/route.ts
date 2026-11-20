/**
 * Same-origin proxy to FastAPI `/api/v1/*`. Injects the Bearer token from
 * the httpOnly cookie, rotates it when near expiry, and streams request and
 * response bodies (large uploads and export downloads never get buffered).
 */
import { type NextRequest, NextResponse } from "next/server";
import {
  API_URL, COOKIES, clearSessionCookies, csrfOk, expiresSoon, forwardHeaders, problem, refreshTokens,
  setSessionCookies, type TokenOut,
} from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const REQUEST_HEADERS = ["content-type"];
const RESPONSE_HEADERS = [
  "content-type", "content-disposition", "content-length", "x-request-id", "x-content-sha256", "cache-control",
];

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path.some((s) => s === "." || s === ".." || s === "")) {
    return problem(400, "Bad Request", "invalid path", "bad_request");
  }
  if (!csrfOk(req)) return problem(403, "Forbidden", "missing or invalid CSRF header", "csrf");

  let access = req.cookies.get(COOKIES.access)?.value;
  const refresh = req.cookies.get(COOKIES.refresh)?.value;
  let rotated: TokenOut | null = null;
  if ((!access || expiresSoon(access)) && refresh) {
    rotated = await refreshTokens(refresh, req);
    access = rotated?.access_token;
  }
  if (!access) {
    const res = problem(401, "Unauthorized", "session expired — please sign in again", "unauthorized");
    clearSessionCookies(res);
    return res;
  }

  const headers = forwardHeaders(req);
  for (const name of REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  headers.set("authorization", `Bearer ${access}`);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const url = `${API_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method, headers, cache: "no-store", redirect: "manual",
      ...(hasBody ? { body: req.body, duplex: "half" } : {}),
    } as RequestInit);
  } catch {
    return problem(502, "Bad Gateway", "the Opscore API is unreachable", "api_unreachable");
  }

  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  const res = new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
  if (rotated) setSessionCookies(res, rotated);
  if (upstream.status === 401) clearSessionCookies(res);
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
