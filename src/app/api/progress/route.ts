import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProgress, getEnrollmentByToken, parseJsonArray, parseJsonRecord } from "@/lib/progress";
import { getCourseBySlug } from "@/lib/course";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || "");
    const courseSlug = String(body.courseSlug || "");
    const action = String(body.action || "");

    const enrollment = await getEnrollmentByToken(token);
    if (!enrollment || !enrollment.paidAt) {
      return NextResponse.json({ error: "Invalid or unpaid enrollment" }, { status: 401 });
    }
    if (enrollment.course.slug !== courseSlug) {
      return NextResponse.json({ error: "Course mismatch" }, { status: 400 });
    }

    const progress = await ensureProgress(enrollment.id);
    const course = await getCourseBySlug(courseSlug);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (action === "complete_lesson") {
      const lessonId = String(body.lessonId || "");
      const ids = parseJsonArray(progress.completedLessonIdsJson);
      if (!ids.includes(lessonId)) ids.push(lessonId);
      const updated = await prisma.enrollmentProgress.update({
        where: { id: progress.id },
        data: { completedLessonIdsJson: JSON.stringify(ids) },
      });
      return NextResponse.json({ ok: true, completedLessonIds: parseJsonArray(updated.completedLessonIdsJson) });
    }

    if (action === "module_quiz") {
      const quizId = String(body.quizId || "");
      const score = Number(body.score);
      const scores = parseJsonRecord(progress.moduleQuizScoresJson);
      scores[quizId] = score;
      const updated = await prisma.enrollmentProgress.update({
        where: { id: progress.id },
        data: { moduleQuizScoresJson: JSON.stringify(scores) },
      });
      return NextResponse.json({ ok: true, moduleQuizScores: parseJsonRecord(updated.moduleQuizScoresJson) });
    }

    if (action === "capstone") {
      const updated = await prisma.enrollmentProgress.update({
        where: { id: progress.id },
        data: {
          capstoneAnswers: String(body.capstoneAnswers || ""),
          capstoneComplete: !!body.capstoneComplete,
        },
      });
      return NextResponse.json({ ok: true, capstoneComplete: updated.capstoneComplete });
    }

    if (action === "final_quiz") {
      const score = Number(body.score);
      const passed = !!body.passed;
      let certificateIssuedAt = progress.certificateIssuedAt;
      if (passed && progress.capstoneComplete && !certificateIssuedAt) {
        certificateIssuedAt = new Date();
      }
      const updated = await prisma.enrollmentProgress.update({
        where: { id: progress.id },
        data: {
          finalQuizScore: score,
          certificateIssuedAt,
        },
      });
      return NextResponse.json({
        ok: true,
        finalQuizScore: updated.finalQuizScore,
        certificateIssuedAt: updated.certificateIssuedAt,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Progress error" },
      { status: 500 }
    );
  }
}
