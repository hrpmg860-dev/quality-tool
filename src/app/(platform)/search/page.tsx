import type { Metadata } from "next";
import { SearchView } from "@/features/search/SearchView";

export const metadata: Metadata = { title: "Record search" };

export default function Page() {
  return <SearchView />;
}
