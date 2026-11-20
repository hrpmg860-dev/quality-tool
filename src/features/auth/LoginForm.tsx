"use client";

import { CheckCircle2, Layers } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field, Input } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { ApiError, sessionRequest } from "@/lib/api/client";

/** Only same-app relative paths — never an open redirect. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/dashboard";
}

const POINTS = [
  "Historical cross-file duplicate detection",
  "Mandatory human approval for every merge",
  "Immutable originals and hash-chained audit trail",
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sessionRequest("/api/auth/login", { email: email.trim(), password });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? new Error("Invalid email or password.") : err);
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-brand-500 p-1.5"><Layers className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">Opscore</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">One trusted record<br />for every person.</h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-brand-400" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Access is monitored and audited.</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" noValidate>
          <div>
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="rounded-md bg-brand-500 p-1.5"><Layers className="h-5 w-5 text-white" /></div>
              <span className="text-lg font-semibold">Opscore</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-500">Use your organization account.</p>
          </div>
          <InlineError error={error} />
          <Field label="Email" required>
            {(id) => <Input id={id} type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Password" required>
            {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" className="w-full" loading={loading} disabled={!email || !password}>Sign in</Button>
        </form>
      </div>
    </div>
  );
}
