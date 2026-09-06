"use client";

import { useState } from "react";

export function LessonCompleteButton({
  token,
  courseSlug,
  lessonId,
  initiallyDone,
}: {
  token: string;
  courseSlug: string;
  lessonId: string;
  initiallyDone: boolean;
}) {
  const [done, setDone] = useState(initiallyDone);
  const [loading, setLoading] = useState(false);

  if (done) {
    return <p className="text-sm font-medium text-emerald-700">Lesson marked complete</p>;
  }

  async function mark() {
    setLoading(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          courseSlug,
          action: "complete_lesson",
          lessonId,
        }),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={mark}
      disabled={loading}
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      {loading ? "Saving…" : "Mark lesson complete"}
    </button>
  );
}
