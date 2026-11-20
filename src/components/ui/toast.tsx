"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; title: string; detail?: string }

const ToastContext = createContext<(kind: ToastKind, title: string, detail?: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, title, detail }]);
    setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? XCircle : Info;
          return (
            <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", { success: "text-emerald-500", error: "text-red-500", info: "text-brand-500" }[t.kind])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-xs text-slate-500">{t.detail}</p>}
              </div>
              <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return {
    success: (title: string, detail?: string) => push("success", title, detail),
    error: (title: string, detail?: string) => push("error", title, detail),
    info: (title: string, detail?: string) => push("info", title, detail),
  };
}
