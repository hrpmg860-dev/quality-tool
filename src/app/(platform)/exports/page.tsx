import type { Metadata } from "next";
import { ExportsView } from "@/features/exports/ExportsView";

export const metadata: Metadata = { title: "Reports & exports" };

export default function Page() {
  return <ExportsView />;
}
