import { prisma } from "./prisma";
import { getOwnerSettings } from "./settings";

export type CanRunResult = { ok: boolean; reason?: string };
export type TickResult = { action: string; detail?: string; jobId?: string };

function hasAiApiKey(): boolean {
  const key = process.env.AI_API_KEY?.trim() ?? "";
  return key.length > 0;
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Gate checks for generation runner. Never throws. $0: no AI calls here. */
export async function canRunGeneration(): Promise<CanRunResult> {
  const settings = await getOwnerSettings();
  if (settings.killSwitchPaused) {
    return { ok: false, reason: "killSwitchPaused" };
  }
  if (!hasAiApiKey()) {
    return { ok: false, reason: "no AI key; $0 mode" };
  }
  const since = startOfUtcDay();
  const used = await prisma.generationJob.count({
    where: {
      createdAt: { gte: since },
      status: { in: ["running", "succeeded"] },
    },
  });
  if (used >= settings.maxGenerationJobsPerDay) {
    return {
      ok: false,
      reason: `daily cap reached (${used}/${settings.maxGenerationJobsPerDay})`,
    };
  }
  return { ok: true };
}

/**
 * Phase C stub tick — advances bookkeeping only.
 * IMPORTANT: never calls external AI APIs even if AI_API_KEY is set.
 */
export async function tickGenerationJobs(): Promise<TickResult> {
  const gate = await canRunGeneration();
  if (!gate.ok) {
    return { action: "noop", detail: gate.reason };
  }

  const job = await prisma.generationJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) {
    return { action: "noop", detail: "no queued jobs" };
  }

  // Stub: fail clearly so cron does not hammer; no AI spend.
  const stubNote = JSON.stringify({
    stub: true,
    message: "No AI calls; pipeline not wired",
  });
  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      attempts: { increment: 1 },
      lastOutputJson: stubNote,
      status: "failed",
      error: "stub_no_ai_pipeline",
    },
  });

  return {
    action: "stub_failed",
    detail: "Phase C stub: generation pipeline not wired yet (no AI calls made)",
    jobId: job.id,
  };
}

export function isAiApiKeyConfigured(): boolean {
  return hasAiApiKey();
}
