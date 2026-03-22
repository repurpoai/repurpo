import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: {
    default: "User-First AI Content Repurposer",
    template: "%s | User-First AI Content Repurposer"
  },
  description:
    "Turn one source into a LinkedIn post, X thread, and newsletter with plan-aware SaaS limits and saved history."
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