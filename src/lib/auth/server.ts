/**
 * Server-only session handling (route handlers + proxy).
 *
 * The browser never sees JWTs: the access and refresh tokens live in
 * httpOnly cookies set by the Next.js server, which forwards API calls to
 * FastAPI with a Bearer header. Refresh-token rotation happens here, with
 * in-process de-duplication so concurrent requests carrying the same
 * refresh token don't trigger the backend's reuse detection (which would
 * revoke the whole token family).
 */
import { type NextRequest, NextResponse } from "next/server";

export const API_URL = (process.env.OPSCORE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const SECURE_COOKIES = process.env.OPSCORE_SECURE_COOKIES === "true";

export const COOKIES = {
  access: "oc_at",
  refresh: "oc_rt",
  /** Non-secret presence flag readable by proxy.ts on page routes. */
  session: "oc_session",
} as const;

export const CSRF_HEADER = "x-opscore-csrf";

export interface TokenOut {
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
}

function maxAge(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

export function setSessionCookies(res: NextResponse, t: TokenOut): void {
  const base = { httpOnly: true, sameSite: "lax" as const, secure: SECURE_COOKIES };
  res.cookies.set(COOKIES.access, t.access_token, { ...base, path: "/api", maxAge: maxAge(t.access_expires_at) });
  res.cookies.set(COOKIES.refresh, t.refresh_token, { ...base, path: "/api", maxAge: maxAge(t.refresh_expires_at) });
  res.cookies.set(COOKIES.session, "1", { ...base, path: "/", maxAge: maxAge(t.refresh_expires_at) });
}

export function clearSessionCookies(res: NextResponse): void {
  for (const [name, path] of [[COOKIES.access, "/api"], [COOKIES.refresh, "/api"], [COOKIES.session, "/"]]) {
    res.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure: SECURE_COOKIES, path, maxAge: 0 });
  }
}

/** Reads `exp` without verifying (the backend verifies); true if within `skewSec`. */
export function expiresSoon(jwt: string, skewSec = 20): boolean {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp !== "number" || payload.exp * 1000 - Date.now() < skewSec * 1000;
  } catch {
    return true;
  }
}

/** Headers that let the backend audit the real client rather than this server. */
export function forwardHeaders(req: NextRequest): Headers {
  const h = new Headers();
  for (const name of ["user-agent", "x-request-id", "accept", "accept-language"]) {
    const v = req.headers.get(name);
    if (v) h.set(name, v);
  }
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim();
  if (ip) h.set("x-forwarded-for", ip);
  return h;
}

/** Mutations must carry the custom header (cross-site forms cannot set it)
 * and, when the browser sends one, a same-origin Origin. */
export function csrfOk(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  if (req.headers.get(CSRF_HEADER) !== "1") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

type RefreshEntry = { at: number; promise: Promise<TokenOut | null> };
const REUSE_WINDOW_MS = 30_000;
const g = globalThis as unknown as { __opscoreRefresh?: Map<string, RefreshEntry> };
const inflight = (g.__opscoreRefresh ??= new Map());

export function refreshTokens(refreshToken: string, req: NextRequest): Promise<TokenOut | null> {
  const now = Date.now();
  for (const [k, v] of inflight) if (now - v.at > REUSE_WINDOW_MS) inflight.delete(k);
  const hit = inflight.get(refreshToken);
  if (hit) return hit.promise;
  const headers = forwardHeaders(req);
  headers.set("content-type", "application/json");
  const promise = fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST", headers, body: JSON.stringify({ refresh_token: refreshToken }), cache: "no-store",
  })
    .then(async (r) => (r.ok ? ((await r.json()) as TokenOut) : null))
    .catch(() => null);
  inflight.set(refreshToken, { at: now, promise });
  return promise;
}

export function problem(status: number, title: string, detail: string, code: string): NextResponse {
  return NextResponse.json({ type: "about:blank", title, status, detail, code }, {
    status, headers: { "content-type": "application/problem+json" },
  });
}
