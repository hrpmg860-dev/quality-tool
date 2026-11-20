import type { Metadata } from "next";
import { MastersView } from "@/features/masters/MastersView";

export const metadata: Metadata = { title: "Master records" };

export default function Page() {
  return <MastersView />;
}
