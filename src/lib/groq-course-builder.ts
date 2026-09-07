/**
 * Optional Groq (OpenAI-compatible) course builder — free tier when GROQ_API_KEY/AI_API_KEY set.
 * On missing key, timeout, or invalid JSON → caller falls back to template-heuristics.
 */
import type { BuiltCourseSpec, GapInput } from "./template-course-builder";
import { slugifyCourse } from "./template-course-builder";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const TIMEOUT_MS = 45_000;

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

function normalizeQuestion(q: LooseQ, i: number): {
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
 * Returns null if shape is too incomplete to publish.
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
      const teach = asString(l.teachMarkdown, `# ${lt}\n\nContent forthcoming.`);
      const exercise = asString(
        l.exercisePrompt,
        `Produce a short artifact for: ${lt}`,
      );
      lessons.push({
        order: li + 1,
        title: lt.slice(0, 120),
        estimatedMinutes: Math.min(20, Math.max(5, asInt(l.estimatedMinutes, 8))),
        teachMarkdown: teach.slice(0, 12_000),
        exercisePrompt: exercise.slice(0, 2000),
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
    if (questions.length < 2) continue;

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
    // Borrow from module quizzes if final is thin
    finalQuestions = modules
      .flatMap((m) => m.quiz.questions)
      .slice(0, 5);
  }
  if (finalQuestions.length < 3) return null;

  const lessonMinutes = modules.reduce(
    (n, m) => n + m.lessons.reduce((a, l) => a + l.estimatedMinutes, 0),
    0,
  );
  const capstoneMinutes = Math.min(25, Math.max(10, asInt(cap.estimatedMinutes, 15)));
  const estimatedMinutes = Math.min(
    100,
    Math.max(70, asInt(o.estimatedMinutes, lessonMinutes + capstoneMinutes + 12)),
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
    targetMinutes: Math.min(100, Math.max(60, asInt(o.targetMinutes, 80))),
    estimatedMinutes,
    coverLabel: asString(o.coverLabel, title).slice(0, 24),
    coverHue: asInt(o.coverHue, hashHue(title)),
    modules,
    capstone: {
      estimatedMinutes: capstoneMinutes,
      briefMarkdown: asString(
        cap.briefMarkdown,
        `# Capstone: ${title}\n\nShip a minimal reviewable slice.\n\n${gap.description.slice(0, 800)}`,
      ).slice(0, 8000),
      rubricChecklist: rubric,
    },
    finalQuiz: {
      passThreshold: Math.min(100, Math.max(50, asInt(finalObj.passThreshold, 80))),
      questions: finalQuestions,
    },
    qaNotes: asString(
      o.qaNotes,
      "Groq-assisted generation (llama-3.1-8b-instant). generationVersion=2. Owner: Jake Sumner.",
    ).slice(0, 500),
  };
}

function buildPrompt(gap: GapInput): string {
  return `You are generating a practical short online course for Skill Flex (owner Jake Sumner).
Return ONLY a JSON object (no markdown fences) matching this shape:
{
  "slug": "kebab-case",
  "title": string,
  "audience": string,
  "promise": string,
  "category": string,
  "targetMinutes": 80,
  "estimatedMinutes": 75-90,
  "coverLabel": "short label",
  "coverHue": 0-359,
  "modules": [
    {
      "title": string,
      "purpose": string,
      "lessons": [
        {
          "title": string,
          "estimatedMinutes": 6-12,
          "teachMarkdown": "markdown lesson body (concepts, why, pattern, checklist)",
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
    "estimatedMinutes": 15,
    "briefMarkdown": string,
    "rubricChecklist": [string, string, ...]
  },
  "finalQuiz": {
    "passThreshold": 80,
    "questions": [ /* 4-6 MCQs same shape */ ]
  },
  "qaNotes": string
}

Requirements:
- Exactly 3 modules, each with exactly 3 lessons
- Each module quiz: 4 multiple-choice questions with 4 choices
- Final quiz: 5 questions
- Content must be practical, non-fluffy, mid-level practitioner focused
- No paid APIs required to complete exercises
- Topic from skill gap below

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
        temperature: 0.35,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You output valid JSON only for Skill Flex course specs. No prose outside JSON.",
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
      // Sometimes models wrap in fences despite instructions
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
