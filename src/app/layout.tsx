import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skill Flex — Emerging skill-gap courses (~2–3 hours)",
  description:
    "Dense afternoon courses on emerging skills employers need: meaty lessons, exercises, project, and certificate. One-time $25. Owned by Jake Sumner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-zinc-500">
          <p>
            <strong className="font-medium text-zinc-600 dark:text-zinc-400">Skill Flex</strong> —
            emerging skill-gap courses owned by Jake Sumner. One-time{" "}
            <strong className="font-medium text-zinc-600 dark:text-zinc-400">$25</strong> per course.
            Purpose: skill gaps → courses → sales only.
          </p>
        </footer>
      </body>
    </html>
  );
}
