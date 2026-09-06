import Link from "next/link";
import { notFound } from "next/navigation";
import { CapstoneForm } from "@/components/CapstoneForm";
import { LessonCompleteButton } from "@/components/LessonCompleteButton";
import { Markdown } from "@/components/Markdown";
import { QuizForm } from "@/components/QuizForm";
import { getCourseBySlug, parseChoices, parseRubric } from "@/lib/course";
import { getEnrollmentByToken, parseJsonArray, parseJsonRecord } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; section?: string; success?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const token = sp.token || "";
  const section = sp.section || "overview";

  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Access required</h1>
        <p className="text-sm text-zinc-600">
          Open this page from your checkout success link, or enroll from the course page.
        </p>
        <Link href={`/courses/${slug}`} className="text-violet-700 underline">
          Go to course
        </Link>
      </div>
    );
  }

  const enrollment = await getEnrollmentByToken(token);
  if (!enrollment || !enrollment.paidAt || enrollment.course.slug !== slug) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Invalid access</h1>
        <p className="text-sm text-zinc-600">This learning link is invalid or unpaid.</p>
        <Link href={`/courses/${slug}`} className="text-violet-700 underline">
          Enroll
        </Link>
      </div>
    );
  }

  const progress = enrollment.progress;
  const completed = parseJsonArray(progress?.completedLessonIdsJson || "[]");
  const quizScores = parseJsonRecord(progress?.moduleQuizScoresJson || "{}");

  const moduleUnlocked: boolean[] = course.modules.map((m, idx) => {
    if (idx === 0) return true;
    const prev = course.modules[idx - 1];
    const prevQuiz = prev.quiz;
    if (!prevQuiz) return false;
    const score = quizScores[prevQuiz.id] ?? 0;
    return score >= prevQuiz.passThreshold;
  });

  const allModulesPassed = course.modules.every((m) => {
    if (!m.quiz) return false;
    return (quizScores[m.quiz.id] ?? 0) >= m.quiz.passThreshold;
  });

  const capstoneUnlocked = allModulesPassed;
  const finalUnlocked = capstoneUnlocked && !!progress?.capstoneComplete;
  const certReady =
    !!progress?.certificateIssuedAt ||
    (!!progress?.capstoneComplete &&
      (progress?.finalQuizScore ?? 0) >= (course.finalQuiz?.passThreshold ?? 80));

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Learning</p>
          <h1 className="text-lg font-semibold leading-snug">{course.title}</h1>
          {sp.success && (
            <p className="mt-2 text-xs font-medium text-emerald-700">Payment success — welcome in.</p>
          )}
        </div>
        <nav className="space-y-3 text-sm">
          <NavLink slug={slug} token={token} section="overview" active={section === "overview"}>
            Overview
          </NavLink>
          {course.modules.map((m, idx) => (
            <div key={m.id} className="space-y-1">
              <div className={`font-medium ${moduleUnlocked[idx] ? "" : "text-zinc-400"}`}>
                Module {m.order}
                {!moduleUnlocked[idx] && " 🔒"}
              </div>
              {moduleUnlocked[idx] && (
                <ul className="ml-2 space-y-1 border-l border-zinc-200 pl-3 dark:border-zinc-700">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <NavLink
                        slug={slug}
                        token={token}
                        section={`lesson-${l.id}`}
                        active={section === `lesson-${l.id}`}
                      >
                        {completed.includes(l.id) ? "✓ " : ""}
                        {l.title}
                      </NavLink>
                    </li>
                  ))}
                  {m.quiz && (
                    <li>
                      <NavLink
                        slug={slug}
                        token={token}
                        section={`quiz-${m.quiz.id}`}
                        active={section === `quiz-${m.quiz.id}`}
                      >
                        Module quiz
                        {(quizScores[m.quiz.id] ?? 0) >= m.quiz.passThreshold ? " ✓" : ""}
                      </NavLink>
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
          <NavLink
            slug={slug}
            token={token}
            section="capstone"
            active={section === "capstone"}
            disabled={!capstoneUnlocked}
          >
            Capstone{!capstoneUnlocked ? " 🔒" : progress?.capstoneComplete ? " ✓" : ""}
          </NavLink>
          <NavLink
            slug={slug}
            token={token}
            section="final"
            active={section === "final"}
            disabled={!finalUnlocked}
          >
            Final quiz{!finalUnlocked ? " 🔒" : ""}
          </NavLink>
          <NavLink
            slug={slug}
            token={token}
            section="certificate"
            active={section === "certificate"}
            disabled={!certReady}
          >
            Certificate{!certReady ? " 🔒" : ""}
          </NavLink>
        </nav>
      </aside>

      <section className="min-w-0 space-y-6">
        {section === "overview" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Course overview</h2>
            <p className="text-zinc-600 dark:text-zinc-300">{course.promise}</p>
            <p className="text-sm text-zinc-500">
              Complete lessons, pass each module quiz (≥75%) to unlock the next module, finish the
              capstone, then pass the final quiz (≥80%) for your certificate.
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {course.modules.map((m, idx) => (
                <li key={m.id} className={moduleUnlocked[idx] ? "" : "text-zinc-400"}>
                  {m.title}
                  {moduleUnlocked[idx] ? "" : " (locked)"}
                </li>
              ))}
            </ol>
          </div>
        )}

        {course.modules.flatMap((m, idx) =>
          m.lessons.map((l) => {
            if (section !== `lesson-${l.id}`) return null;
            if (!moduleUnlocked[idx]) {
              return (
                <Locked key={l.id} message="Pass the previous module quiz to unlock this lesson." />
              );
            }
            return (
              <div key={l.id} className="space-y-6">
                <div>
                  <p className="text-xs uppercase text-zinc-500">
                    Module {m.order} · ~{l.estimatedMinutes} min
                  </p>
                  <h2 className="text-2xl font-bold">{l.title}</h2>
                </div>
                <Markdown content={l.teachMarkdown} />
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950">
                  <h3 className="font-semibold">Exercise ({l.exerciseType})</h3>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{l.exercisePrompt}</p>
                </div>
                <LessonCompleteButton
                  token={token}
                  courseSlug={slug}
                  lessonId={l.id}
                  initiallyDone={completed.includes(l.id)}
                />
              </div>
            );
          })
        )}

        {course.modules.map((m, idx) => {
          if (!m.quiz || section !== `quiz-${m.quiz.id}`) return null;
          if (!moduleUnlocked[idx]) {
            return <Locked key={m.quiz.id} message="This module quiz is locked." />;
          }
          const questions = m.quiz.questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            choices: parseChoices(q.choicesJson),
            correctIndex: q.correctIndex,
            explanation: q.explanation,
          }));
          return (
            <div key={m.quiz.id} className="space-y-4">
              <h2 className="text-2xl font-bold">
                Module {m.order} quiz — {m.title}
              </h2>
              <QuizForm
                quizId={m.quiz.id}
                kind="module"
                passThreshold={m.quiz.passThreshold}
                questions={questions}
                token={token}
                courseSlug={slug}
              />
            </div>
          );
        })}

        {section === "capstone" && course.capstone && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Capstone</h2>
            {!capstoneUnlocked ? (
              <Locked message="Pass all module quizzes to unlock the capstone." />
            ) : (
              <>
                <Markdown content={course.capstone.briefMarkdown} />
                <CapstoneForm
                  token={token}
                  courseSlug={slug}
                  rubric={parseRubric(course.capstone.rubricChecklistJson)}
                  initialAnswers={progress?.capstoneAnswers}
                  initiallyComplete={progress?.capstoneComplete}
                />
              </>
            )}
          </div>
        )}

        {section === "final" && course.finalQuiz && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Final quiz</h2>
            {!finalUnlocked ? (
              <Locked message="Complete the capstone to unlock the final quiz." />
            ) : (
              <QuizForm
                quizId={course.finalQuiz.id}
                kind="final"
                passThreshold={course.finalQuiz.passThreshold}
                questions={course.finalQuiz.questions.map((q) => ({
                  id: q.id,
                  prompt: q.prompt,
                  choices: parseChoices(q.choicesJson),
                  correctIndex: q.correctIndex,
                  explanation: q.explanation,
                }))}
                token={token}
                courseSlug={slug}
              />
            )}
          </div>
        )}

        {section === "certificate" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Certificate</h2>
            {!certReady ? (
              <Locked message="Pass the final quiz and complete the capstone to unlock." />
            ) : (
              <div className="rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white p-8 text-center dark:from-violet-950 dark:to-zinc-900">
                <p className="text-sm uppercase tracking-widest text-violet-700">SkillPulse Certificate</p>
                <p className="mt-4 text-2xl font-bold">{course.title}</p>
                <p className="mt-2 text-zinc-600 dark:text-zinc-300">Awarded to {enrollment.email}</p>
                <p className="mt-6 text-sm text-zinc-500">
                  Issued{" "}
                  {(progress?.certificateIssuedAt
                    ? new Date(progress.certificateIssuedAt)
                    : new Date()
                  ).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}{" "}
                  PT · Owner {process.env.OWNER_NAME || "Jake Sumner"}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function NavLink({
  slug,
  token,
  section,
  active,
  disabled,
  children,
}: {
  slug: string;
  token: string;
  section: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="block text-zinc-400">{children}</span>;
  }
  return (
    <Link
      href={`/learn/${slug}?token=${encodeURIComponent(token)}&section=${section}`}
      className={`block hover:text-violet-700 ${active ? "font-semibold text-violet-700" : ""}`}
    >
      {children}
    </Link>
  );
}

function Locked({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      🔒 {message}
    </div>
  );
}
