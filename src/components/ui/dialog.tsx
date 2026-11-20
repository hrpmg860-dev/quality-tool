"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { InlineError } from "./states";

/** Accessible modal built on <dialog> (focus trap, Esc, backdrop). */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode;
  footer?: ReactNode; size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-lg bg-white p-0 shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[1px]",
        { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size],
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <button aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", tone = "primary", loading, error, children, confirmDisabled }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: ReactNode; description?: ReactNode;
  confirmLabel?: string; tone?: "primary" | "danger" | "success"; loading?: boolean; error?: unknown;
  children?: ReactNode; confirmDisabled?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>{confirmLabel}</Button>
        </>
      }
    >
      {(children || !!error) && (
        <div className="space-y-4">
          {children}
          <InlineError error={error} />
        </div>
      )}
    </Dialog>
  );
}
