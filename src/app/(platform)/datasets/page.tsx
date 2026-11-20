import type { Metadata } from "next";
import { DatasetsView } from "@/features/admin/DatasetsView";

export const metadata: Metadata = { title: "Datasets" };

export default function Page() {
  return <DatasetsView />;
}
