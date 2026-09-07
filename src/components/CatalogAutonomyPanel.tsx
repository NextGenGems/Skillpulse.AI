"use client";

import { useState } from "react";

type GapRow = {
  id: string;
  title: string;
  status: string;
  score: number | null;
  category: string | null;
  createdAt: string;
  generationJobs?: { id: string; status: string; error: string | null }[];
};

type PromoRow = {
  id: string;
  courseId: string | null;
  channel: string;
  status: string;
  error: string | null;
  createdAt: string;
  draftsPreview?: string | null;
};

export function CatalogAutonomyPanel({
  killSwitchPaused,
  aiKeySet,
  maxGenerationJobsPerDay,
  initialGaps,
  initialPromos,
}: {
  killSwitchPaused: boolean;
  aiKeySet: boolean;
  maxGenerationJobsPerDay: number;
  initialGaps: GapRow[];
  initialPromos: PromoRow[];
}) {
  const [gaps, setGaps] = useState<GapRow[]>(initialGaps);
  const [promos, setPromos] = useState<PromoRow[]>(initialPromos);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refreshGaps() {
    const res = await fetch("/api/admin/skill-gaps");
    const data = await res.json();
    if (res.ok && Array.isArray(data.gaps)) {
      setGaps(
        data.gaps.map((g: GapRow & { createdAt: string | Date }) => ({
          ...g,
          createdAt: typeof g.createdAt === "string" ? g.createdAt : String(g.createdAt),
        })),
      );
    }
  }

  async function runFreeResearch() {
    setLoading("research");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/skill-gaps/research", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setMsg(
        `Research: created ${data.created ?? 0}, skipped ${data.skipped ?? 0}` +
          (data.detail ? ` — ${data.detail}` : ""),
      );
      await refreshGaps();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function enqueueSample() {
    setLoading("enqueue");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/skill-gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "AI Agent Workflow Design for Solo Operators",
          description:
            "Emerging skill gap: designing reliable multi-step agent workflows, tool use, and eval loops for solo founders — free-signal sample for Phase C enqueue.",
          category: "emerging-skills",
          score: 0.8,
          enqueueJob: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to enqueue");
      setMsg(`Enqueued gap: ${data.gap?.title ?? "ok"}`);
      await refreshGaps();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function runTick() {
    setLoading("tick");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/jobs/tick", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tick failed");
      const parts = [
        data.research
          ? `research=${data.research.action}${data.research.detail ? ` (${data.research.detail})` : ""}`
          : null,
        data.generation
          ? `gen=${data.generation.action}${data.generation.detail ? ` (${data.generation.detail})` : ""}`
          : null,
        data.promo
          ? `promo=${data.promo.action}${data.promo.detail ? ` (${data.promo.detail})` : ""}`
          : null,
      ].filter(Boolean);
      setMsg(`Tick: ${parts.join(" · ") || JSON.stringify(data)}`);
      await refreshGaps();
      // Soft-refresh promo list from tick payload is enough; full reload on next nav
      if (data.promo?.action === "drafts_ready") {
        setPromos((prev) => [
          {
            id: data.promo.jobId ?? `tmp-${Date.now()}`,
            courseId: data.promo.courseId ?? null,
            channel: "community",
            status: "succeeded",
            error: null,
            createdAt: new Date().toISOString(),
            draftsPreview: data.promo.detail ?? "drafts ready",
          },
          ...prev,
        ]);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Catalog autonomy (Phase C)</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Free loop: skill-gap research → template course publish (no AI key) → promo drafts in DB.
        Auto-post stays off until social tokens. Gates: kill switch; gen daily cap below. Cron:{" "}
        <code className="text-xs">GET|POST /api/jobs/tick</code> with CRON_SECRET (Vercel daily +
        GitHub Actions every 5h).
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Kill switch</dt>
          <dd className="font-medium">{killSwitchPaused ? "PAUSED" : "LIVE"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">AI_API_KEY</dt>
          <dd className="font-medium">
            {aiKeySet ? "set (unused for free template path)" : "unset (OK — free templates)"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Max gen jobs/day</dt>
          <dd className="font-medium">{maxGenerationJobsPerDay}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!loading || killSwitchPaused}
          onClick={runFreeResearch}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading === "research" ? "Researching…" : "Run free research"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={enqueueSample}
          className="rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading === "enqueue" ? "Enqueueing…" : "Enqueue sample gap"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={runTick}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-60"
        >
          {loading === "tick" ? "Ticking…" : "Run job tick"}
        </button>
      </div>
      {msg && <p className="text-sm text-zinc-600 dark:text-zinc-300">{msg}</p>}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Skill gaps</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {gaps.map((g) => (
              <li key={g.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{g.title}</div>
                <div className="text-zinc-500">
                  {g.status}
                  {g.category ? ` · ${g.category}` : ""}
                  {g.score != null ? ` · score ${g.score}` : ""}
                  {g.generationJobs?.[0]
                    ? ` · job: ${g.generationJobs[0].status}${
                        g.generationJobs[0].error ? ` (${g.generationJobs[0].error})` : ""
                      }`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Promo drafts (no auto-post)</h3>
        {promos.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet — run tick after a course publishes.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {promos.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="font-medium">
                  {p.channel} · {p.status}
                  {p.error ? ` · ${p.error}` : ""}
                </div>
                <div className="text-zinc-500">
                  {p.courseId ? `course ${p.courseId.slice(0, 8)}…` : "no course"} ·{" "}
                  {p.createdAt.slice(0, 10)}
                </div>
                {p.draftsPreview && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                    {p.draftsPreview}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
