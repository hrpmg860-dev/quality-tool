import type { Metadata } from "next";
import { UploadHistoryView } from "@/features/uploads/UploadHistoryView";

export const metadata: Metadata = { title: "Upload history" };

export default function Page() {
  return <UploadHistoryView />;
}
