import type { Metadata } from "next";
import { UploadDetailView } from "@/features/uploads/UploadDetailView";

export const metadata: Metadata = { title: "Upload" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UploadDetailView key={id} id={Number(id)} />;
}
