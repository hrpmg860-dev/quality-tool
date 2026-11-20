import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewQueueView } from "@/features/review/ReviewQueueView";

export const metadata: Metadata = { title: "Review center" };

export default function Page() {
  return <Suspense><ReviewQueueView /></Suspense>;
}
