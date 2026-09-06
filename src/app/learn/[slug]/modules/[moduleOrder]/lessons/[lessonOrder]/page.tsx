import { redirect, notFound } from "next/navigation";
import { getCourseBySlug } from "@/lib/course";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string; moduleOrder: string; lessonOrder: string }>; searchParams: Promise<{ token?: string; demo?: string }> }) {
  const { slug, moduleOrder, lessonOrder } = await params; const sp = await searchParams;
  const course = await getCourseBySlug(slug); if (!course) notFound();
  const mod = course.modules.find((m) => m.order === Number(moduleOrder));
  const lesson = mod?.lessons.find((l) => l.order === Number(lessonOrder));
  if (!lesson) notFound();
  const q = new URLSearchParams(); if (sp.token) q.set("token", sp.token); if (sp.demo) q.set("demo", sp.demo); q.set("section", `lesson-${lesson.id}`);
  redirect(`/learn/${slug}?${q.toString()}`);
}
