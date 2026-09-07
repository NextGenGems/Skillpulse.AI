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
  title: "Skill Flex — Emerging skill-gap micro-courses (~75–90 min)",
  description:
    "Afternoon micro-courses on emerging skills employers need: exercises, project, and certificate. One-time $25. Automated catalog owned by Jake Sumner.",
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
          Skill Flex is an automated course business owned by Jake Sumner. Purpose: skill gaps → courses →
          sales only. Base44 site stays live at{" "}
          <a className="underline" href="https://auto-skill-pulse.base44.app" target="_blank" rel="noreferrer">
            auto-skill-pulse.base44.app
          </a>{" "}
          until this rebuild converts.
        </footer>
      </body>
    </html>
  );
}
