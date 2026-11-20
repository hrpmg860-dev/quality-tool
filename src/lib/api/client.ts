import type { Problem } from "@/types/api";

/** Browser → Next.js proxy → FastAPI. JWTs never reach client code. */
export const API_BASE = "/api/backend";
const CSRF = { "x-opscore-csrf": "1" };

export const UNAUTHORIZED_EVENT = "opscore:unauthorized";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail || problem.title || `Request failed (${problem.status})`);
    this.status = problem.status;
    this.code = problem.code ?? "error";
    this.problem = problem;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export function buildQuery(q?: Query): string {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Normalizes FastAPI/Pydantic and RFC 7807 errors into a Problem. */
export function toProblem(status: number, body: unknown): Problem {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.title === "string") return { ...(b as Problem), status };
    if (Array.isArray(b.detail)) {
      const msg = b.detail
        .map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg}`)
        .join("; ");
      return { title: "Validation error", status, detail: msg, code: "validation_error" };
    }
    if (typeof b.detail === "string") return { title: "Error", status, detail: b.detail };
  }
  return { title: status >= 500 ? "Server error" : "Request failed", status, detail: null };
}

function onUnauthorized(path: string) {
  if (typeof window !== "undefined" && !path.startsWith("/auth/login")) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; query?: Query; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = "GET", query, body, signal } = opts;
  const headers: Record<string, string> = { accept: "application/json", ...CSRF };
  if (body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method, headers, signal, credentials: "same-origin", cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError({ title: "Network error", status: 0, detail: "Could not reach the server.", code: "network" });
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401) onUnauthorized(path);
    throw new ApiError(toProblem(res.status, data));
  }
  return data as T;
}

/** Login/logout go to Next.js route handlers that own the session cookies. */
export async function sessionRequest(path: "/api/auth/login" | "/api/auth/logout", body?: unknown): Promise<void> {
  const res = await fetch(path, {
    method: "POST", credentials: "same-origin",
    headers: { ...CSRF, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(toProblem(res.status, data));
  }
}

export interface UploadHandle<T> {
  promise: Promise<T>;
  abort: () => void;
}

/** Multipart upload with byte-level progress (fetch has no upload progress). */
export function uploadWithProgress<T>(
  path: string, form: FormData, onProgress: (loaded: number, total: number) => void, query?: Query,
): UploadHandle<T> {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open("POST", `${API_BASE}${path}${buildQuery(query)}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("x-opscore-csrf", "1");
    xhr.setRequestHeader("accept", "application/json");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total);
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
      if (xhr.status === 401) onUnauthorized(path);
      reject(new ApiError(toProblem(xhr.status, data)));
    };
    xhr.onerror = () => reject(new ApiError({ title: "Network error", status: 0, detail: "Upload failed — connection lost.", code: "network" }));
    xhr.onabort = () => reject(new ApiError({ title: "Cancelled", status: 0, detail: "Upload cancelled.", code: "aborted" }));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

/** Audited, streamed download through the proxy (cookie-authenticated GET). */
export function downloadUrl(path: string): string {
  return `${API_BASE}${path}`;
}
