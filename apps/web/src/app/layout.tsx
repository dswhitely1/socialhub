import type { Metadata } from "next";
import { TRPCProvider } from "@/lib/trpc/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialHub",
  description: "Unified social media hub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-background text-foreground antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
