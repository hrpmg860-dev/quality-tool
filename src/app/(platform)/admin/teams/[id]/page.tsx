import type { Metadata } from "next";
import { TeamDetailView } from "@/features/admin/TeamsView";

export const metadata: Metadata = { title: "Team" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamDetailView key={id} id={Number(id)} />;
}
