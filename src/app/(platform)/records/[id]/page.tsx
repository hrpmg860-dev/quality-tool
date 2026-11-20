import type { Metadata } from "next";
import { RecordDetailView } from "@/features/search/RecordDetailView";

export const metadata: Metadata = { title: "Record" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordDetailView key={id} id={Number(id)} />;
}
