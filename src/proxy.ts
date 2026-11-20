/**
 * Route guard (Next.js 16 renamed `middleware.ts` to `proxy.ts`). Only a
 * coarse "is there a session" check for page routes — real authorization is
 * enforced by FastAPI on every API call. `/api/*` is excluded on purpose:
 * proxy buffers request bodies (10 MB cap), which would break large uploads.
 */
import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "oc_session";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = req.cookies.has(SESSION_COOKIE);
  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  }
  if (!signedIn) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"],
};
