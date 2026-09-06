"use client";

import { useState } from "react";

type Question = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

export function QuizForm({
  quizId,
  kind,
  passThreshold,
  questions,
  token,
  courseSlug,
  onPassed,
}: {
  quizId: string;
  kind: "module" | "final";
  passThreshold: number;
  questions: Question[];
  token: string;
  courseSlug: string;
  onPassed?: (score: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correctIndex) correct += 1;
    }
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= passThreshold;
    setResult({ score, passed });
    setSaving(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          courseSlug,
          action: kind === "final" ? "final_quiz" : "module_quiz",
          quizId,
          score,
          passed,
        }),
      });
      if (passed) onPassed?.(score);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Pass ≥{passThreshold}%. {kind === "module" ? "Passing unlocks the next module." : "Pass with capstone for certificate."}
      </p>
      {questions.map((q, idx) => (
        <fieldset key={q.id} className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <legend className="px-1 text-sm font-semibold">
            {idx + 1}. {q.prompt}
          </legend>
          <div className="space-y-2">
            {q.choices.map((c, i) => (
              <label key={i} className="flex cursor-pointer gap-2 text-sm">
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === i}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
          {result && (
            <p className="text-xs text-zinc-500">
              {answers[q.id] === q.correctIndex ? "Correct. " : "Incorrect. "}
              {q.explanation}
            </p>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        disabled={saving || Object.keys(answers).length < questions.length}
        onClick={submit}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Submit quiz"}
      </button>
      {result && (
        <p className={`text-sm font-medium ${result.passed ? "text-emerald-700" : "text-amber-700"}`}>
          Score {result.score}% — {result.passed ? "Passed" : "Not yet — review and retry"}
        </p>
      )}
    </div>
  );
}
