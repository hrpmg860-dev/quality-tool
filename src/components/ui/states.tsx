import { AlertTriangle, Inbox, Loader2, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("h-4 w-4 animate-spin", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-slate-200/80", className)} />;
}

export function LoadingBlock({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 py-16 text-sm text-slate-500", className)}>
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ title, description, icon, action, className }: {
  title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const status = error instanceof ApiError ? error.status : undefined;
  if (status === 403) return <ForbiddenState className={className} detail={errorMessage(error)} />;
  const title = status === 404 ? "Not found" : status === 0 ? "Connection problem" : "Couldn’t load this data";
  const requestId = error instanceof ApiError ? error.problem.request_id : undefined;
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-500"><AlertTriangle className="h-6 w-6" /></div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{errorMessage(error)}</p>
      {requestId && <p className="mt-1 font-mono text-xs text-slate-400">Request ID: {requestId}</p>}
      {onRetry && status !== 404 && (
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700">Try again</button>
      )}
    </div>
  );
}

export function ForbiddenState({ detail, className }: { detail?: string; className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={<Lock className="h-6 w-6" />}
      title="You don’t have access to this"
      description={detail ?? "Your role or dataset access doesn’t include this area. Ask an administrator if you need it."}
    />
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{errorMessage(error)}</span>
    </div>
  );
}
