"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { value: T; label: ReactNode; hidden?: boolean }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-slate-200", className)}>
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            value === t.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
