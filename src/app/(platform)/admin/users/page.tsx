import type { Metadata } from "next";
import { UsersView } from "@/features/admin/UsersView";

export const metadata: Metadata = { title: "User management" };

export default function Page() {
  return <UsersView />;
}
