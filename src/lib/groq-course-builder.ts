/**
 * Optional Groq (OpenAI-compatible) course builder — free tier when GROQ_API_KEY/AI_API_KEY set.
 * On missing key, timeout, invalid JSON, thin/duplicate lessons → caller falls back to template-heuristics.
 */
import type { BuiltCourseSpec, GapInput } from "./template-course-builder";
import {
  assertUniqueLessonBodies,
  slugifyCourse,
  stripLeadingH1,
} from "./template-course-builder";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const TIMEOUT_MS = 55_000;
/** Reject lessons shorter than this (chars) — forces meat or template fallback. */
const MIN_TEACH_CHARS = 2_400;

export function getGroqApiKey(): string | null {
  const groq = process.env.GROQ_API_KEY?.trim() ?? "";
  if (groq) return groq;
  const ai = process.env.AI_API_KEY?.trim() ?? "";
  return ai || null;
}

export function isGroqConfigured(): boolean {
  return getGroqApiKey() !== null;
}

type LooseQ = {
  prompt?: unknown;
  choices?: unknown;
  correctIndex?: unknown;
  explanation?: unknown;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function normalizeQuestion(q: LooseQ, _i: number): {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
} | null {
  const prompt = asString(q.prompt);
  const choices = Array.isArray(q.choices)
    ? q.choices.map((c) => asString(c)).filter(Boolean)
    : [];
  if (!prompt || choices.length < 2) return null;
  let correctIndex = asInt(q.correctIndex, 0);
  if (correctIndex < 0 || correctIndex >= choices.length) correctIndex = 0;
  return {
    prompt,
    choices: choices.slice(0, 6),
    correctIndex,
    explanation: asString(q.explanation, "See lesson content."),
  };
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Validate and normalize Groq JSON into BuiltCourseSpec.
 * Returns null if shape is incomplete, lessons too short, or bodies duplicate.
 */
export function normalizeGroqCourseJson(
  raw: unknown,
  gap: GapInput,
): BuiltCourseSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const title = asString(o.title, gap.title).slice(0, 160);
  const category = asString(o.category, gap.category || "emerging-skills").slice(0, 80);
  const audience = asString(
    o.audience,
    `Practitioners leveling up on ${title}`,
  ).slice(0, 280);
  const promise = asString(
    o.promise,
    `Build practical fluency in ${title} with drills and a capstone.`,
  ).slice(0, 400);

  const modulesIn = Array.isArray(o.modules) ? o.modules : [];
  if (modulesIn.length < 2) return null;

  const modules: BuiltCourseSpec["modules"] = [];
  for (let mi = 0; mi < Math.min(modulesIn.length, 4); mi++) {
    const m = modulesIn[mi] as Record<string, unknown>;
    if (!m || typeof m !== "object") continue;
    const lessonsIn = Array.isArray(m.lessons) ? m.lessons : [];
    if (lessonsIn.length < 2) continue;

    const lessons: BuiltCourseSpec["modules"][0]["lessons"] = [];
    for (let li = 0; li < Math.min(lessonsIn.length, 4); li++) {
      const l = lessonsIn[li] as Record<string, unknown>;
      if (!l || typeof l !== "object") continue;
      const lt = asString(l.title, `Lesson ${li + 1}`);
      let teach = stripLeadingH1(
        asString(l.teachMarkdown, `## Concept\n\nContent forthcoming for ${lt}.`),
      );
      // Ban markdown checkbox UX that looks broken next to Lesson complete
      teach = teach.replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, (match) => {
        // convert to plain bullet without checkbox
        return match.replace(/\[[ xX]\]\s+/, "");
      });
      if (teach.length < MIN_TEACH_CHARS) return null;
      if (/- \[ \]/.test(teach) || teach.includes("## Checklist")) {
        // Prefer Self-check numbered lists; reject checklist-style sections
        teach = teach.replace(/## Checklist[\s\S]*?(?=## |$)/g, "");
      }
      const exercise = asString(
        l.exercisePrompt,
        `Produce a concrete artifact for: ${lt} related to ${title}`,
      );
      lessons.push({
        order: li + 1,
        title: lt.slice(0, 120),
        estimatedMinutes: Math.min(25, Math.max(15, asInt(l.estimatedMinutes, 16))),
        teachMarkdown: teach.slice(0, 16_000),
        exercisePrompt: exercise.slice(0, 3000),
        exerciseType: ["pasteable", "checklist", "short_answer"].includes(
          asString(l.exerciseType),
        )
          ? asString(l.exerciseType)
          : "pasteable",
      });
    }
    if (lessons.length < 2) continue;

    const quizObj = (m.quiz && typeof m.quiz === "object" ? m.quiz : {}) as {
      passThreshold?: unknown;
      questions?: unknown;
    };
    const qsRaw = Array.isArray(quizObj.questions) ? quizObj.questions : [];
    const questions = qsRaw
      .map((q, i) => normalizeQuestion(q as LooseQ, i))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .slice(0, 6);
    if (questions.length < 4) continue;

    modules.push({
      order: mi + 1,
      title: asString(m.title, `Module ${mi + 1}`).slice(0, 120),
      purpose: asString(m.purpose, `Build skill for ${title}`).slice(0, 400),
      lessons,
      quiz: {
        passThreshold: Math.min(100, Math.max(50, asInt(quizObj.passThreshold, 75))),
        questions,
      },
    });
  }

  if (modules.length < 2) return null;

  const uniq = assertUniqueLessonBodies(modules, 3);
  if (!uniq.ok) return null;

  const cap = (o.capstone && typeof o.capstone === "object" ? o.capstone : {}) as {
    estimatedMinutes?: unknown;
    briefMarkdown?: unknown;
    rubricChecklist?: unknown;
  };
  const rubric = Array.isArray(cap.rubricChecklist)
    ? cap.rubricChecklist.map((x) => asString(x)).filter(Boolean).slice(0, 10)
    : [];
  if (rubric.length < 3) {
    rubric.push(
      "Contract is specific and testable",
      "Artifact is concrete",
      "Failure modes include recovery",
    );
  }

  const finalObj = (o.finalQuiz && typeof o.finalQuiz === "object" ? o.finalQuiz : {}) as {
    passThreshold?: unknown;
    questions?: unknown;
  };
  const finalQsRaw = Array.isArray(finalObj.questions) ? finalObj.questions : [];
  let finalQuestions = finalQsRaw
    .map((q, i) => normalizeQuestion(q as LooseQ, i))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .slice(0, 8);
  if (finalQuestions.length < 3) {
    finalQuestions = modules.flatMap((m) => m.quiz.questions).slice(0, 5);
  }
  if (finalQuestions.length < 3) return null;

  const lessonMinutes = modules.reduce(
    (n, m) => n + m.lessons.reduce((a, l) => a + l.estimatedMinutes, 0),
    0,
  );
  const capstoneMinutes = Math.min(30, Math.max(20, asInt(cap.estimatedMinutes, 25)));
  const estimatedMinutes = Math.min(
    180,
    Math.max(120, asInt(o.estimatedMinutes, lessonMinutes + capstoneMinutes + 20)),
  );

  const slugBase =
    slugifyCourse(asString(o.slug, gap.slugHint || gap.title)) ||
    `course-${Date.now().toString(36)}`;

  return {
    slug: slugBase,
    title,
    audience,
    promise,
    category,
    targetMinutes: Math.min(180, Math.max(120, asInt(o.targetMinutes, 150))),
    estimatedMinutes,
    coverLabel: asString(o.coverLabel, title).slice(0, 24),
    coverHue: asInt(o.coverHue, hashHue(title)),
    modules,
    capstone: {
      estimatedMinutes: capstoneMinutes,
      briefMarkdown: stripLeadingH1(
        asString(
          cap.briefMarkdown,
          `## Capstone: ${title}\n\nShip a minimal reviewable slice.\n\n${gap.description.slice(0, 800)}`,
        ),
      ).slice(0, 8000),
      rubricChecklist: rubric,
    },
    finalQuiz: {
      passThreshold: Math.min(100, Math.max(50, asInt(finalObj.passThreshold, 80))),
      questions: finalQuestions,
    },
    qaNotes: asString(
      o.qaNotes,
      "Groq-assisted generation (llama-3.1-8b-instant). generationVersion=2; meaty unique lessons. Owner: Jake Sumner.",
    ).slice(0, 500),
  };
}

function buildPrompt(gap: GapInput): string {
  return `You are generating a practical online course for Skill Flex (owner Jake Sumner).
Return ONLY a JSON object (no markdown fences) matching this shape:
{
  "slug": "kebab-case",
  "title": string,
  "audience": string,
  "promise": string,
  "category": string,
  "targetMinutes": 150,
  "estimatedMinutes": 120-180,
  "coverLabel": "short label",
  "coverHue": 0-359,
  "modules": [
    {
      "title": string,
      "purpose": string,
      "lessons": [
        {
          "title": string,
          "estimatedMinutes": 15-20,
          "teachMarkdown": "markdown WITHOUT a leading # H1 title. Required sections in order: ## Concept (2-3 meaty paragraphs), ## Why it matters (4-6 bullets), ## Worked example (topic-specific scenario), ## Step-by-step pattern (5-8 numbered steps), ## Common mistakes (bullets), ## Practice exercise (concrete deliverable), ## Self-check (5 numbered items — NEVER markdown [ ] checkboxes)",
          "exercisePrompt": string,
          "exerciseType": "pasteable" | "checklist" | "short_answer"
        }
      ],
      "quiz": {
        "passThreshold": 75,
        "questions": [
          { "prompt": string, "choices": [4 strings], "correctIndex": 0-3, "explanation": string }
        ]
      }
    }
  ],
  "capstone": {
    "estimatedMinutes": 25,
    "briefMarkdown": string,
    "rubricChecklist": [string, string, ...]
  },
  "finalQuiz": {
    "passThreshold": 80,
    "questions": [ /* 5 MCQs same shape */ ]
  },
  "qaNotes": string
}

HARD REQUIREMENTS:
- Exactly 3 modules, each with exactly 3 lessons
- Each module quiz: exactly 5 topic-specific multiple-choice questions (4 choices). Pass threshold 75. No generic filler stems.
- Final quiz: exactly 5 topic-specific questions. Pass threshold 80.
- Each lesson estimatedMinutes >= 15
- Each teachMarkdown >= 2400 characters and feels like a 15–20 minute read
- NO leading "# Lesson title" H1 in teachMarkdown (page already shows the title)
- NO markdown checkbox lists like "- [ ] …" — use "## Self-check" with numbered 1.–5. items
- UNIQUENESS: lessons MUST NOT share boilerplate. Every lesson needs distinct paragraphs, bullets, steps, worked example, and practice deliverable. Do not reuse the same Why-it-matters list or Pattern steps across lessons. Worked examples must be unique and tied to THIS skill gap.
- Across wording: mention the skill-gap topic nouns constantly so content cannot be mistaken for another course
- Practical, mid-level, no paid APIs required
- Total course ~2–3 hours teach+practice feel

Skill gap title: ${gap.title}
Category: ${gap.category || "emerging-skills"}
Slug hint: ${gap.slugHint || ""}
Description: ${gap.description.slice(0, 1500)}
`;
}

/**
 * Attempt Groq course generation. Returns null on any failure (caller uses template).
 */
export async function buildCourseFromGroq(
  gap: GapInput,
): Promise<BuiltCourseSpec | null> {
  const key = getGroqApiKey();
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 12_000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You output valid JSON only for Skill Flex course specs. Meaty unique lessons only — never duplicate section text across lessons. No prose outside JSON. No leading H1 in teachMarkdown. No checkbox markdown.",
          },
          { role: "user", content: buildPrompt(gap) },
        ],
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return null;
      parsed = JSON.parse(m[0]);
    }

    return normalizeGroqCourseJson(parsed, gap);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
