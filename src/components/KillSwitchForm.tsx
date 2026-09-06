"use client";

import { useState } from "react";

export function KillSwitchForm({ initiallyPaused }: { initiallyPaused: boolean }) {
  const [paused, setPaused] = useState(initiallyPaused);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitchPaused: !paused }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPaused(data.killSwitchPaused);
      setMsg(data.killSwitchPaused ? "Sales & generation paused." : "Sales re-enabled.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Kill switch</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        When paused: Enroll is hidden/disabled and GenerationJobs must no-op. Does not change Stripe destination.
      </p>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            paused
              ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
              : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
          }`}
        >
          {paused ? "PAUSED" : "LIVE"}
        </span>
        <button
          type="button"
          disabled={loading}
          onClick={toggle}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Updating…" : paused ? "Resume sales" : "Pause sales"}
        </button>
      </div>
      {msg && <p className="text-sm text-zinc-600">{msg}</p>}
    </div>
  );
}
