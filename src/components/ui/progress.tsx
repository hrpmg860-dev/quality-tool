import { cn, scoreValue } from "@/lib/utils";

export function ProgressBar({ value, className, tone = "brand", label }: {
  value: number; className?: string; tone?: "brand" | "green" | "red" | "amber"; label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const bar = { brand: "bg-brand-600", green: "bg-emerald-500", red: "bg-red-500", amber: "bg-amber-500" }[tone];
  return (
    <div className={className}>
      <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full transition-[width] duration-300", bar)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function confidenceTone(score: number): "green" | "amber" | "red" {
  return score >= 90 ? "green" : score >= 75 ? "amber" : "red";
}

/** Match confidence (0–100) as number + meter. */
export function ConfidenceScore({ score, compact = false }: { score: string | number | null | undefined; compact?: boolean }) {
  if (score == null) return <span className="text-slate-400">—</span>;
  const v = scoreValue(score);
  const tone = confidenceTone(v);
  const text = { green: "text-emerald-700", amber: "text-amber-700", red: "text-red-700" }[tone];
  return (
    <div className={cn("flex items-center gap-2", compact ? "min-w-[6rem]" : "min-w-[8rem]")} title={`Confidence ${v.toFixed(1)} / 100`}>
      <span className={cn("w-10 text-right text-sm font-semibold tabular-nums", text)}>{v.toFixed(v % 1 ? 1 : 0)}</span>
      <ProgressBar value={v} tone={tone} className="flex-1" label="Confidence score" />
    </div>
  );
}
