import { redirect, notFound } from "next/navigation";
import { getCourseBySlug } from "@/lib/course";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string; moduleOrder: string }>; searchParams: Promise<{ token?: string; demo?: string }> }) {
  const { slug, moduleOrder } = await params; const sp = await searchParams;
  const course = await getCourseBySlug(slug); if (!course) notFound();
  const mod = course.modules.find((m) => m.order === Number(moduleOrder));
  if (!mod?.quiz) notFound();
  const q = new URLSearchParams(); if (sp.token) q.set("token", sp.token); if (sp.demo) q.set("demo", sp.demo); q.set("section", `quiz-${mod.quiz.id}`);
  redirect(`/learn/${slug}?${q.toString()}`);
}
