import { prisma } from "./prisma";
import { getOwnerSettings } from "./settings";

/** Max new SkillGaps created per UTC day via free research (cron/tick). */
export const MAX_RESEARCH_GAPS_PER_DAY = 3;

export type ResearchCandidate = {
  title: string;
  description: string;
  category: string;
  score: number;
  slugHint: string;
  /** Human reason + signal notes; stored as SkillGap.signalsJson */
  signalsJson: string;
};

export type ResearchGapSummary = {
  id: string;
  title: string;
  slugHint: string | null;
  status: string;
  score: number | null;
};

export type ResearchResult = {
  created: number;
  skipped: number;
  gaps: ResearchGapSummary[];
  detail?: string;
};

/**
 * Curated emerging skill-gap heuristics for SkillPulse niche.
 * Static / free — no HTTP or AI required for MVP.
 */
export const RESEARCH_CANDIDATES: ResearchCandidate[] = [
  {
    title: "Eval Harnesses for LLM Features Shipping Teams Actually Trust",
    description:
      "Build lightweight eval harnesses (golden sets, regression checks, failure taxonomies) so shipping teams can change prompts/models without silent quality drops.",
    category: "eval-quality",
    score: 0.92,
    slugHint: "llm-eval-harnesses-for-shipping-teams",
    signalsJson: JSON.stringify({
      reason: "Teams ship LLM features without repeatable evals; demand for practical harness patterns is rising.",
      signals: ["job posts mentioning evals", "postmortems on prompt regressions", "open-source eval kits"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Agentic Workflow Design for Reliable Multi-Step Tool Use",
    description:
      "Design multi-step agent workflows with tool contracts, retries, human checkpoints, and observable traces — aimed at solo operators and small product teams.",
    category: "agentic-workflows",
    score: 0.9,
    slugHint: "agentic-workflow-design-for-operators",
    signalsJson: JSON.stringify({
      reason: "Agent demos abound; production reliability patterns for tool loops remain scarce.",
      signals: ["framework churn", "ops ask for guardrails", "trace/debug tooling growth"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "RAG Retrieval Quality: Chunking, Ranking, and Failure Modes",
    description:
      "Diagnose and fix RAG retrieval quality — chunking strategy, hybrid ranking, citation honesty, and evals for grounding — without a research lab budget.",
    category: "rag",
    score: 0.88,
    slugHint: "rag-retrieval-quality-for-builders",
    signalsJson: JSON.stringify({
      reason: "RAG is default architecture; retrieval quality is the common failure mode in prod.",
      signals: ["hallucination complaints", "vector DB tutorials without evals", "support tickets on wrong docs"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "EU AI Act Basics for Shipping Teams (Not Lawyers)",
    description:
      "Practical checklist for product and eng teams shipping AI features into the EU: risk tiers, documentation habits, transparency, and when to escalate to counsel.",
    category: "compliance",
    score: 0.85,
    slugHint: "eu-ai-act-for-shipping-teams",
    signalsJson: JSON.stringify({
      reason: "Compliance deadlines approach; engineers need actionable shipping checklists, not legal treatises.",
      signals: ["regulator timelines", "enterprise RFPs asking for AI Act readiness"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "FinOps for Small AI Teams: Cost Visibility Without a Platform Team",
    description:
      "Track and cap LLM/API spend for small teams — unit economics, budget alerts, caching, model routing — so $0-to-funded transitions stay intentional.",
    category: "finops",
    score: 0.84,
    slugHint: "finops-for-small-ai-teams",
    signalsJson: JSON.stringify({
      reason: "Token bills surprise early teams; free-tier habits do not scale without cost visibility.",
      signals: ["invoice spikes", "Hobby plan limits", "requests for spend dashboards"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Threat Modeling for AI Features Shipping Teams Can Run in an Afternoon",
    description:
      "Lightweight threat modeling for prompt injection, data exfil via tools, and unsafe automation — a practical session format for shipping teams.",
    category: "security",
    score: 0.86,
    slugHint: "threat-modeling-ai-features-shipping-teams",
    signalsJson: JSON.stringify({
      reason: "Security reviews lag feature shipping; afternoon-sized threat models fill the gap.",
      signals: ["OWASP LLM Top 10 awareness", "incident writeups on tool abuse"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Prompt Evals That Catch Regressions Before Users Do",
    description:
      "Write prompt-level eval suites: fixtures, scorers, CI gates, and triage playbooks so prompt edits are reviewed like code.",
    category: "prompt-evals",
    score: 0.87,
    slugHint: "prompt-evals-before-users-notice",
    signalsJson: JSON.stringify({
      reason: "Prompt changes ship without tests; regressions surface in support first.",
      signals: ["prompt PRs without fixtures", "A/B anecdotes instead of metrics"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Human-in-the-Loop Checkpoints for Autonomous Agents",
    description:
      "Place approval gates, escalation policies, and audit logs in agent pipelines so autonomy stays useful without silent high-stakes actions.",
    category: "agentic-workflows",
    score: 0.83,
    slugHint: "human-in-the-loop-agent-checkpoints",
    signalsJson: JSON.stringify({
      reason: "Fully autonomous demos scare operators; checkpoint patterns are underserved in courses.",
      signals: ["enterprise ask for approve/deny steps", "runaway agent anecdotes"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Observability for LLM Apps: Traces, Scores, and Incident Replay",
    description:
      "Instrument LLM apps with traces, user-feedback scores, and replayable incidents so on-call can debug quality like latency.",
    category: "observability",
    score: 0.82,
    slugHint: "observability-for-llm-apps",
    signalsJson: JSON.stringify({
      reason: "Traditional APM misses prompt/context failures; LLM-specific observability is a skill gap.",
      signals: ["OpenTelemetry LLM spans", "vendor tracing SDKs", "on-call confusion"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Data Contracts for RAG Corpora Maintenance",
    description:
      "Keep retrieval corpora fresh with ownership, freshness SLAs, chunk schemas, and delete/update playbooks — ops skill for RAG beyond the first demo.",
    category: "rag",
    score: 0.8,
    slugHint: "data-contracts-for-rag-corpora",
    signalsJson: JSON.stringify({
      reason: "Stale corpora silently degrade answers; maintenance skills lag initial RAG tutorials.",
      signals: ["outdated doc citations", "delete/update pain in vector stores"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Model Routing and Fallback Strategies for Product Engineers",
    description:
      "Route easy vs hard tasks across models/providers with timeouts, fallbacks, and quality/cost tradeoffs — practical patterns for product engineers.",
    category: "finops",
    score: 0.81,
    slugHint: "model-routing-and-fallbacks",
    signalsJson: JSON.stringify({
      reason: "Single-model apps hit cost or outage walls; routing is becoming a default skill.",
      signals: ["multi-model gateways", "provider outages", "tiered quality needs"],
      source: "curated-heuristic",
    }),
  },
  {
    title: "Shipping AI Features Under Kill-Switch and Purpose Constraints",
    description:
      "Operate an automated product with owner kill switches, purpose locks, and $0-mode gates — patterns for solo-owned AI businesses that stay controllable.",
    category: "ops-governance",
    score: 0.78,
    slugHint: "ai-product-kill-switch-and-purpose-gates",
    signalsJson: JSON.stringify({
      reason: "Solo-owned automated businesses need operational control patterns beyond model prompts.",
      signals: ["owner pause requirements", "purpose-limited agents", "Hobby cost caps"],
      source: "curated-heuristic",
    }),
  },
];

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugifyLoose(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function similarSlug(a: string, b: string): boolean {
  const x = slugifyLoose(a);
  const y = slugifyLoose(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Containment for "similar slug" MVP heuristic
  return x.includes(y) || y.includes(x);
}

/**
 * Free skill-gap research: create open SkillGaps from curated heuristics.
 * No AI, no HTTP. Respects kill switch and optional daily max.
 */
export async function researchSkillGaps(options?: {
  /** Cap new creates this call (also clamped by remaining daily budget when respectDailyCap). */
  maxNew?: number;
  /** When true (default), enforce MAX_RESEARCH_GAPS_PER_DAY for SkillGaps created today. */
  respectDailyCap?: boolean;
}): Promise<ResearchResult> {
  const maxNew = options?.maxNew ?? MAX_RESEARCH_GAPS_PER_DAY;
  const respectDailyCap = options?.respectDailyCap !== false;

  const settings = await getOwnerSettings();
  if (settings.killSwitchPaused) {
    return { created: 0, skipped: 0, gaps: [], detail: "killSwitchPaused" };
  }

  let budget = Math.max(0, maxNew);
  if (respectDailyCap) {
    const since = startOfUtcDay();
    const createdToday = await prisma.skillGap.count({
      where: { createdAt: { gte: since } },
    });
    const remaining = Math.max(0, MAX_RESEARCH_GAPS_PER_DAY - createdToday);
    budget = Math.min(budget, remaining);
    if (budget === 0) {
      return {
        created: 0,
        skipped: 0,
        gaps: [],
        detail: `daily research cap reached (${createdToday}/${MAX_RESEARCH_GAPS_PER_DAY})`,
      };
    }
  }

  const [existingGaps, courses] = await Promise.all([
    prisma.skillGap.findMany({ select: { title: true, slugHint: true } }),
    prisma.course.findMany({ select: { slug: true, title: true } }),
  ]);

  const gapTitles = new Set(existingGaps.map((g) => normalizeTitle(g.title)));
  const gapSlugHints = existingGaps
    .map((g) => g.slugHint)
    .filter((s): s is string => !!s)
    .map(slugifyLoose);
  const courseSlugs = courses.map((c) => c.slug);
  const courseTitles = courses.map((c) => normalizeTitle(c.title));

  let created = 0;
  let skipped = 0;
  const gaps: ResearchGapSummary[] = [];

  // Prefer higher score first
  const ordered = [...RESEARCH_CANDIDATES].sort((a, b) => b.score - a.score);

  for (const c of ordered) {
    if (created >= budget) break;

    const titleKey = normalizeTitle(c.title);
    const hint = slugifyLoose(c.slugHint);

    const titleExists = gapTitles.has(titleKey);
    const courseSlugCollision = courseSlugs.some((s) => similarSlug(s, hint) || similarSlug(s, c.slugHint));
    const courseTitleCollision = courseTitles.some((t) => t === titleKey);
    const slugHintMatchesCourse = courseSlugs.some((s) => similarSlug(s, hint));
    const gapSlugDup = gapSlugHints.includes(hint);

    if (titleExists || courseSlugCollision || courseTitleCollision || slugHintMatchesCourse || gapSlugDup) {
      skipped += 1;
      continue;
    }

    const row = await prisma.skillGap.create({
      data: {
        title: c.title,
        description: c.description,
        category: c.category,
        score: c.score,
        slugHint: c.slugHint,
        signalsJson: c.signalsJson,
        status: "open",
      },
    });

    gapTitles.add(titleKey);
    gapSlugHints.push(hint);
    created += 1;
    gaps.push({
      id: row.id,
      title: row.title,
      slugHint: row.slugHint,
      status: row.status,
      score: row.score,
    });
  }

  return {
    created,
    skipped,
    gaps,
    detail:
      created === 0 && skipped > 0
        ? "all remaining candidates already present or collide with courses"
        : undefined,
  };
}

/**
 * Admin helper: create open SkillGaps from free heuristics.
 * Does NOT require AI_API_KEY. Does not enqueue GenerationJob (admin can enqueue later).
 * Still respects kill switch. Bypasses daily cap so owner can seed the backlog intentionally
 * (passes maxNew large + respectDailyCap false), but still skips duplicates.
 */
export async function researchAndQueueSample(): Promise<ResearchResult> {
  return researchSkillGaps({
    maxNew: RESEARCH_CANDIDATES.length,
    respectDailyCap: false,
  });
}

export type ResearchTickResult = {
  action: string;
  detail?: string;
  created?: number;
  skipped?: number;
};

/** Cron/admin tick: free research before generation stub. No AI key required. */
export async function tickSkillGapResearch(): Promise<ResearchTickResult> {
  const result = await researchSkillGaps({
    maxNew: MAX_RESEARCH_GAPS_PER_DAY,
    respectDailyCap: true,
  });

  if (result.detail === "killSwitchPaused") {
    return { action: "noop", detail: "killSwitchPaused", created: 0, skipped: 0 };
  }
  if (result.created === 0 && result.detail?.includes("daily research cap")) {
    return {
      action: "noop",
      detail: result.detail,
      created: 0,
      skipped: result.skipped,
    };
  }
  if (result.created === 0) {
    return {
      action: "noop",
      detail: result.detail ?? "no new gaps",
      created: 0,
      skipped: result.skipped,
    };
  }
  return {
    action: "researched",
    detail: `created ${result.created} open SkillGap(s)`,
    created: result.created,
    skipped: result.skipped,
  };
}
