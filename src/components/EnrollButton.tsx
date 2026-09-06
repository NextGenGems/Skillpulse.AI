"use client";

import { useState } from "react";

export function EnrollButton({
  slug,
  salesPaused,
  priceLabel,
  courseTitle,
}: {
  slug: string;
  salesPaused: boolean;
  priceLabel: string;
  courseTitle?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  if (salesPaused) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        Sales are paused by the owner kill switch. Enrollment is disabled.
      </div>
    );
  }

  async function enroll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: email.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.devAccessUrl) {
        window.location.href = data.devAccessUrl;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  const statementDescriptor = courseTitle
    ? `SkillPulse — ${courseTitle}`
    : "SkillPulse — {course title}";

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-300">Email for access link</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="button"
        disabled={loading || !email.trim()}
        onClick={enroll}
        className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting checkout…" : `Enroll — ${priceLabel}`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">
        One-time purchase. Checkout shows as <code>{statementDescriptor}</code>.
      </p>
    </div>
  );
}
