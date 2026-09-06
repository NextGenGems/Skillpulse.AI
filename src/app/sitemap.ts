import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const courses = await prisma.course.findMany({
    where: { status: "published" },
    select: { slug: true, updatedAt: true },
  });

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];

  const courseEntries: MetadataRoute.Sitemap = courses.map((c) => ({
    url: `${base}/courses/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...courseEntries];
}
