import type { Metadata } from "next";
import { DatasetDetailView } from "@/features/admin/DatasetDetailView";

export const metadata: Metadata = { title: "Dataset" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DatasetDetailView key={id} id={Number(id)} />;
}
