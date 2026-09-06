import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gaps = await prisma.skillGap.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      generationJobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          stage: true,
          error: true,
          attempts: true,
          createdAt: true,
        },
      },
    },
  });
  return NextResponse.json({ gaps });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    description?: string;
    category?: string;
    score?: number;
    enqueueJob?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  if (!title || !description) {
    return NextResponse.json({ error: "title and description required" }, { status: 400 });
  }

  const enqueueJob = body.enqueueJob !== false;
  const score =
    typeof body.score === "number" && Number.isFinite(body.score) ? body.score : null;
  const category = body.category?.trim() || null;

  const gap = await prisma.skillGap.create({
    data: {
      title,
      description,
      category,
      score: score ?? undefined,
      status: enqueueJob ? "queued" : "open",
      generationJobs: enqueueJob
        ? {
            create: {
              stage: "research",
              status: "queued",
            },
          }
        : undefined,
    },
    include: {
      generationJobs: true,
    },
  });

  return NextResponse.json({ gap }, { status: 201 });
}
