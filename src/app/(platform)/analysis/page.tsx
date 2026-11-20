import type { Metadata } from "next";
import { AnalysisView } from "@/features/review/AnalysisView";

export const metadata: Metadata = { title: "Duplicate analysis" };

export default function Page() {
  return <AnalysisView />;
}
