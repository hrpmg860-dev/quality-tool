import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Opscore", template: "%s · Opscore" },
  description: "Enterprise data deduplication platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
