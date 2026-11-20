import type { Metadata } from "next";
import { MasterDetailView } from "@/features/masters/MasterDetailView";

export const metadata: Metadata = { title: "Master record" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MasterDetailView key={id} id={Number(id)} />;
}
