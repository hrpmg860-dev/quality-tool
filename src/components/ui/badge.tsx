import type { ReactNode } from "react";
import { cn, humanize } from "@/lib/utils";
import { Spinner } from "./states";

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "indigo";

const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  indigo: "bg-brand-50 text-brand-700 ring-brand-200",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  // uploads
  uploaded: "gray", mapped: "blue", processing: "indigo", completed: "green", failed: "red", cancelled: "gray",
  // jobs / exports
  queued: "gray", running: "indigo", retrying: "amber", succeeded: "green",
  // groups
  pending: "amber", in_review: "blue", resolved: "green", stale: "gray",
  // matches
  confirmed: "green", rejected: "red", superseded: "gray",
  // masters / datasets / users
  active: "green", merged: "violet", retired: "gray", archived: "gray", deactivated: "red", invited: "blue",
  // decisions
  approve: "green", reject: "red", split: "violet", defer: "amber", unmerge: "indigo",
  // merge events
  attach: "blue", merge: "violet", create_singleton: "gray", attribute_override: "amber", detach: "amber", retire: "gray",
  // tiers
  high: "green", medium: "amber", low: "red",
};

const IN_PROGRESS = new Set(["processing", "running", "retrying", "queued"]);

/** Consistent processing-status indicator across every screen. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "gray"}>
      {IN_PROGRESS.has(status) ? <Spinner className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {label ?? humanize(status)}
    </Badge>
  );
}
