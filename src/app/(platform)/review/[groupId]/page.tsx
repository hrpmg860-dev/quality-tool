import type { Metadata } from "next";
import { ReviewDetailView } from "@/features/review/ReviewDetailView";

export const metadata: Metadata = { title: "Review group" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <ReviewDetailView key={groupId} id={Number(groupId)} />;
}
