"use client";

import { useState } from "react";

export function CapstoneForm({
  token,
  courseSlug,
  rubric,
  initialAnswers,
  initiallyComplete,
}: {
  token: string;
  courseSlug: string;
  rubric: string[];
  initialAnswers?: string;
  initiallyComplete?: boolean;
}) {
  const [answers, setAnswers] = useState(initialAnswers || "");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [complete, setComplete] = useState(!!initiallyComplete);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const allChecked = rubric.every((_, i) => checked[i]);
    if (!allChecked || answers.trim().length < 40) {
      setError("Paste your prompt pack and check all rubric items.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          courseSlug,
          action: "capstone",
          capstoneAnswers: answers,
          capstoneComplete: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (complete) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100">
        Capstone marked complete. Finish the final quiz to unlock your certificate.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <textarea
        value={answers}
        onChange={(e) => setAnswers(e.target.value)}
        rows={12}
        placeholder="Paste your Prompt Pack markdown here…"
        className="w-full rounded-xl border border-zinc-300 bg-white p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <div className="space-y-2">
        <p className="text-sm font-medium">Self-check rubric</p>
        {rubric.map((r, i) => (
          <label key={i} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
            />
            <span>{r}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={submit}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Mark capstone complete"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
