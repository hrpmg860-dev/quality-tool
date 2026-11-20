"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field, Input } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValues } from "@/components/ui/card";
import { DatasetName } from "@/components/ui/entities";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { roleLabel } from "@/lib/permissions";
import { cn, formatDateTime, humanize } from "@/lib/utils";

function PasswordCard() {
  const { logout } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useMutation({
    mutationFn: () => endpoints.changePassword(current, next),
    onSuccess: async () => {
      toast.success("Password changed", "All sessions were revoked — please sign in again.");
      await logout();
    },
  });
  const mismatch = confirm.length > 0 && confirm !== next;
  return (
    <Card>
      <CardHeader title="Password" description="Changing it revokes all your refresh tokens" />
      <CardBody>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!mismatch) change.mutate(); }}>
          <Field label="Current password" required>{(id) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
          <Field label="New password" required hint="Min 10 chars, at least one letter and one digit.">{(id) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}</Field>
          <Field label="Confirm new password" error={mismatch ? "Passwords do not match." : undefined}>{(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
          <InlineError error={change.error} />
          <Button type="submit" loading={change.isPending} disabled={!current || !next || mismatch}><KeyRound className="h-4 w-4" />Change password</Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function SettingsView() {
  const { me, logout } = useAuth();
  const health = useQuery({ queryKey: ["health"], queryFn: endpoints.health, refetchInterval: 30_000 });
  const access = me ? Object.entries(me.dataset_access).sort(([a], [b]) => Number(a) - Number(b)) : [];

  return (
    <>
      <PageHeader title="Settings" description="Your account, dataset access and platform status." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profile" />
            <CardBody>
              <KeyValues className="sm:grid-cols-1" items={[
                ["Name", me?.display_name],
                ["Email", me?.email],
                ["Role", <Badge key="r" tone={me?.is_admin ? "indigo" : "gray"}>{me?.role_name ?? roleLabel(me?.role)}</Badge>],
                ["Teams", me?.teams.length ? (
                  <span key="t" className="flex flex-wrap gap-1.5">
                    {me.teams.map((t) => (
                      <Link key={t.id} href={`/admin/teams/${t.id}`}>
                        <Badge tone={t.status === "active" ? "indigo" : "gray"}>{t.name}{t.team_role === "lead" ? " · lead" : ""}{t.status === "archived" ? " (archived)" : ""}</Badge>
                      </Link>
                    ))}
                  </span>
                ) : "—"],
                ["Status", me?.status ? <StatusBadge key="s" status={me.status} /> : "—"],
                ["Auth provider", me?.auth_provider],
                ["Last login", formatDateTime(me?.last_login_at)],
                ["Member since", formatDateTime(me?.created_at)],
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Permissions" description="What your role allows globally" />
            <CardBody>
              <div className="flex flex-wrap gap-1.5">
                {me?.permissions.map((p) => <Badge key={p} tone="gray">{humanize(p)}</Badge>)}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Dataset access" description="Effective per-dataset rights (direct grants and active-team grants; the highest applies)" />
            <CardBody>
              {access.length === 0 ? (
                <p className="text-sm text-slate-500">{me?.is_admin ? "You are an administrator — full access to every dataset." : "No dataset grants yet. Ask a dataset manager."}</p>
              ) : (
                <ul className="space-y-2">
                  {access.map(([id, level]) => (
                    <li key={id} className="flex items-center justify-between text-sm">
                      <DatasetName id={Number(id)} /> <Badge tone="indigo">{humanize(level)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <PasswordCard />
          <Card>
            <CardHeader title="Platform" description="Backend and dependency health" />
            <CardBody>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", health.data?.status === "ok" ? "bg-emerald-500" : "bg-red-500", !health.data && "bg-slate-300")} />
                  <span className="text-sm font-medium capitalize">{health.data?.status ?? "checking…"}</span>
                </div>
                <span className="text-xs text-slate-400">30 s refresh</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {health.data && Object.entries(health.data.checks).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between">
                    <span className="text-slate-600">{humanize(k)}</span>
                    <span className={v === "ok" ? "flex items-center gap-1 text-emerald-600" : "text-red-600"}>
                      {v === "ok" && <CheckCircle2 className="h-3.5 w-3.5" />}{v}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Session" />
            <CardBody className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Sign out of this device (revokes this session's refresh token).</p>
              <Button variant="secondary" onClick={() => logout()}><LogOut className="h-4 w-4" />Sign out</Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-start gap-3 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>Sessions use short-lived access tokens with automatic rotation. Your actions are recorded in the hash-chained audit trail and attributed to {me?.email}.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
