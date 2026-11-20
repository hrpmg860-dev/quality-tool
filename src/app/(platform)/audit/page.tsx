import type { Metadata } from "next";
import { AuditView } from "@/features/audit/AuditView";

export const metadata: Metadata = { title: "Audit trail" };

export default function Page() {
  return <AuditView />;
}
