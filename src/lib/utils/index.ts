import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const df = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const nf = new Intl.NumberFormat();

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dtf.format(new Date(iso)) : "—";
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? df.format(new Date(iso)) : "—";
}

export function formatNumber(n: number | null | undefined): string {
  return n == null ? "—" : nf.format(n);
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 || v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  const t = s.replace(/[_.]/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Match scores come back as Decimal strings on a 0–100 scale. */
export function scoreValue(score: string | number | null | undefined): number {
  const n = typeof score === "string" ? Number.parseFloat(score) : score ?? 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n as number)) : 0;
}

/** <input type="date"> value → ISO bound; `end` makes it exclusive next-day. */
export function dateInputToIso(value: string, end = false): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  if (end) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function masterName(m: { golden_full_name: string | null; golden_first_name: string | null; golden_last_name: string | null; id: number }): string {
  return m.golden_full_name || [m.golden_first_name, m.golden_last_name].filter(Boolean).join(" ") || `Master #${m.id}`;
}

export function recordDisplayName(r: { raw_data?: Record<string, string> | null; normalized?: { full_name_norm: string | null } | null; id: number; redacted?: boolean }): string {
  if (r.redacted) return `Record #${r.id} (restricted)`;
  const raw = r.raw_data ?? {};
  const pick = (...keys: string[]) => {
    for (const k of Object.keys(raw)) if (keys.includes(k.toLowerCase().replace(/[\s_-]/g, ""))) return raw[k];
    return "";
  };
  const full = pick("fullname", "name") || [pick("firstname", "first"), pick("lastname", "last")].filter(Boolean).join(" ");
  return full || r.normalized?.full_name_norm || `Record #${r.id}`;
}
