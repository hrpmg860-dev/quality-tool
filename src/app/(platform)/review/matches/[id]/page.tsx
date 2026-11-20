import type { Metadata } from "next";
import { MatchDetailView } from "@/features/review/MatchDetailView";

export const metadata: Metadata = { title: "Match" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDetailView key={id} id={Number(id)} />;
}
