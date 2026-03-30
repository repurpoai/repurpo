import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: {
    default: "Repurpo",
    template: "%s | Repurpo"
  },
  description:
    "Turn one source into a LinkedIn post, X thread, and newsletter with plan-aware SaaS limits and saved history.",
  other: {
    "breachme-verify": "breachme-verify=repurpo-five-vercel-app-8321971daecae436",
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}