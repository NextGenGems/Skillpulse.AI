"use client";

import { useEffect, useState } from "react";

const MAX_AUTO_RETRIES = 8;
const RETRY_MS = 4000;

/**
 * Success-page recovery: limited auto-refresh while webhook catches up,
 * plus manual "I've paid — unlock" that hits /api/checkout/unlock.
 */
export function UnlockAccessButton({
  slug,
  sessionId,
}: {
  slug: string;
  sessionId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [autoDone, setAutoDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = Number(params.get("retry") || "0");
    const current = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    setRetry(current);
    if (current >= MAX_AUTO_RETRIES) {
      setAutoDone(true);
      return;
    }
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("retry", String(current + 1));
      window.location.replace(url.toString());
    }, RETRY_MS);
    return () => clearTimeout(t);
  }, []);

  async function unlock() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unlock failed");
      if (data.redirectTo || data.learnUrl) {
        window.location.href = data.redirectTo || data.learnUrl;
        return;
      }
      throw new Error("Unlock succeeded but no learn URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Confirming payment with Stripe…
        {autoDone
          ? " Auto-refresh finished — use the button below."
          : ` Auto-refresh ${Math.min(retry + 1, MAX_AUTO_RETRIES)}/${MAX_AUTO_RETRIES} in a few seconds.`}
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={unlock}
        className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Unlocking…" : "I've paid — unlock access"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">
        Uses your Stripe checkout session to set access immediately if the webhook was delayed.
      </p>
    </div>
  );
}
