import { type NextRequest, NextResponse } from "next/server";
import { API_URL, COOKIES, problem } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Backend readiness (Postgres + Redis) for signed-in users. */
export async function GET(req: NextRequest) {
  if (!req.cookies.get(COOKIES.session)) return problem(401, "Unauthorized", "not signed in", "unauthorized");
  try {
    const r = await fetch(`${API_URL}/health/ready`, { cache: "no-store" });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json({ status: "unreachable", checks: { api: "error: unreachable" } }, { status: 503 });
  }
}
