import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-slate-200 bg-white shadow-xs", className)}>{children}</section>;
}

export function CardHeader({ title, description, actions, className }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function StatCard({ label, value, hint, icon, tone = "slate" }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "slate" | "brand" | "amber" | "green" | "red";
}) {
  const toneCls = {
    slate: "bg-slate-100 text-slate-600", brand: "bg-brand-50 text-brand-600", amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600", red: "bg-red-50 text-red-600",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className={cn("rounded-md p-2", toneCls)}>{icon}</div>}
      </div>
    </Card>
  );
}

export function KeyValues({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-900">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
