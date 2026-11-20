import type { Metadata } from "next";
import { Suspense } from "react";
import { UploadView } from "@/features/uploads/UploadView";

export const metadata: Metadata = { title: "Upload dataset" };

export default function Page() {
  return <Suspense><UploadView /></Suspense>;
}
