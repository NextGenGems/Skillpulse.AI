import { redirect } from "next/navigation";
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string; demo?: string }> }) {
  const { slug } = await params; const sp = await searchParams;
  const q = new URLSearchParams(); if (sp.token) q.set("token", sp.token); if (sp.demo) q.set("demo", sp.demo); q.set("section", "certificate");
  redirect(`/learn/${slug}?${q.toString()}`);
}
