/**
 * Free template/heuristic course builder — no external AI APIs.
 * Builds a publishable v2 course (3×3 modules/lessons + quizzes + capstone + final)
 * from a SkillGap title/description/category.
 */

export type GapInput = {
  title: string;
  description: string;
  category?: string | null;
  slugHint?: string | null;
};

type Q = {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

type LessonSpec = {
  order: number;
  title: string;
  estimatedMinutes: number;
  teachMarkdown: string;
  exercisePrompt: string;
  exerciseType: string;
};

type ModuleSpec = {
  order: number;
  title: string;
  purpose: string;
  lessons: LessonSpec[];
  quiz: { passThreshold: number; questions: Q[] };
};

export type BuiltCourseSpec = {
  slug: string;
  title: string;
  audience: string;
  promise: string;
  category: string;
  targetMinutes: number;
  estimatedMinutes: number;
  coverLabel: string;
  coverHue: number;
  modules: ModuleSpec[];
  capstone: {
    estimatedMinutes: number;
    briefMarkdown: string;
    rubricChecklist: string[];
  };
  finalQuiz: { passThreshold: number; questions: Q[] };
  qaNotes: string;
};

export function slugifyCourse(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function topicWords(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function shortLabel(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return words.join(" ");
  return words.slice(0, 3).join(" ");
}

function mcq(
  prompt: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
): Q {
  const choices = [correct, ...wrong];
  // Stable shuffle by rotating based on prompt length
  const rot = prompt.length % 4;
  const rotated = [...choices.slice(rot), ...choices.slice(0, rot)];
  const correctIndex = rotated.indexOf(correct);
  return { prompt, choices: rotated, correctIndex, explanation };
}

function lessonMarkdown(
  topic: string,
  moduleTitle: string,
  lessonTitle: string,
  focus: string,
): string {
  return `# ${lessonTitle}

This lesson is part of **${moduleTitle}** in the course on **${topic}**.

## Concept

${focus}

Practitioners who ship real work treat this as a product skill, not a vibes skill: name the inputs, define the done state, and leave a trail others can audit.

## Why it matters

- Messy real-world inputs are the default, not the edge case
- Unscoped work becomes unbounded cost and weak outcomes
- Clear contracts make review, handoff, and iteration possible

## Pattern

1. State the goal in one sentence a skeptical peer would accept
2. List constraints (time, tools, quality bar, what is out of scope)
3. Produce a small artifact you can test or demo
4. Capture failure modes and the recovery step

## Anti-patterns

- Skipping the contract and jumping to clever wording
- Optimizing for elegance instead of recoverability
- Shipping without a check that a stranger could run

## Checklist

- [ ] Goal is specific and testable
- [ ] Constraints are written down
- [ ] One concrete artifact exists
- [ ] At least one failure mode has a recovery step
`;
}

/**
 * Build a full course spec from a skill gap using templates + heuristics only.
 */
export function buildCourseFromSkillGap(gap: GapInput): BuiltCourseSpec {
  const topic = topicWords(gap.title);
  const category = (gap.category?.trim() || "emerging-skills").slice(0, 80);
  const baseSlug =
    slugifyCourse(gap.slugHint || gap.title) || `skill-gap-${Date.now().toString(36)}`;
  const slug = baseSlug.startsWith("course-") ? baseSlug : baseSlug;

  const audience = `Practitioners and solo operators leveling up on ${topic} (mid-level)`;
  const promise = `Build practical fluency in ${topic} — with contracts, drills, and a capstone you can ship or show in a review.`;

  const moduleBlueprints = [
    {
      title: `Foundations of ${shortLabel(topic)}`,
      purpose: `Establish vocabulary, contracts, and the minimum bar for ${topic}.`,
      focuses: [
        `Define what “good” looks like for ${topic} before you optimize tactics.`,
        `Map inputs, outputs, and failure modes so work stays reviewable.`,
        `Set a lightweight measurement loop you can run weekly without new tools.`,
      ],
      lessonTitles: [
        `What “good” means for ${shortLabel(topic)}`,
        "Inputs, outputs, and failure modes",
        "A weekly measurement loop",
      ],
    },
    {
      title: "Practice under constraints",
      purpose: `Turn concepts into repeatable drills with timeboxes and quality gates.`,
      focuses: [
        `Run a constrained drill that forces tradeoffs instead of perfect answers.`,
        `Use checklists and templates so quality does not depend on mood.`,
        `Review artifacts with a peer-ready rubric (even if the peer is future-you).`,
      ],
      lessonTitles: [
        "Timeboxed drills that force tradeoffs",
        "Checklists and templates that stick",
        "Peer-ready review without theater",
      ],
    },
    {
      title: "Ship and defend",
      purpose: `Package work so it survives contact with users, stakeholders, or production.`,
      focuses: [
        `Package a minimal shippable slice with clear acceptance criteria.`,
        `Write the defense: assumptions, risks, and what you would change next.`,
        `Plan the next iteration using signals, not vibes.`,
      ],
      lessonTitles: [
        "A minimal shippable slice",
        "Defend assumptions and risks",
        "Iterate from signals, not vibes",
      ],
    },
  ];

  const modules: ModuleSpec[] = moduleBlueprints.map((bp, mi) => {
    const order = mi + 1;
    const lessons: LessonSpec[] = bp.lessonTitles.map((lt, li) => ({
      order: li + 1,
      title: lt,
      estimatedMinutes: 8 + (li % 3),
      teachMarkdown: lessonMarkdown(topic, bp.title, lt, bp.focuses[li] ?? bp.focuses[0]),
      exercisePrompt: `For **${topic}**, produce a short artifact for “${lt}”: 5–10 bullet points or a one-page outline. Include goal, constraints, and one failure mode with recovery.`,
      exerciseType: li === 1 ? "checklist" : "pasteable",
    }));

    const quizQuestions: Q[] = [
      mcq(
        `What should you define first when leveling up on ${shortLabel(topic)}?`,
        "A clear contract for good outcomes and constraints",
        ["The most clever tactic you can invent", "A large tool purchase", "Unlimited scope"],
        "Contracts and constraints keep practice reviewable and bounded.",
      ),
      mcq(
        `In module ${order}, which habit most improves quality under time pressure?`,
        "Small artifacts plus an explicit checklist",
        ["Waiting for perfect inspiration", "Skipping review", "Expanding scope mid-drill"],
        "Checklists and small artifacts beat perfectionism when time is limited.",
      ),
      mcq(
        `What is a useful failure-mode practice for ${shortLabel(topic)}?`,
        "Name the failure and the recovery step in advance",
        ["Ignore failures until launch", "Blame the tools only", "Add more features"],
        "Pre-named recovery steps turn failures into recoverable events.",
      ),
      mcq(
        `Which review is most useful for ${shortLabel(topic)} work?`,
        "A peer-ready rubric against acceptance criteria",
        ["Only aesthetic polish feedback", "Silent approval", "Moving goalposts after the fact"],
        "Rubrics tied to acceptance criteria make feedback actionable.",
      ),
    ];

    return {
      order,
      title: bp.title,
      purpose: bp.purpose,
      lessons,
      quiz: { passThreshold: 75, questions: quizQuestions },
    };
  });

  const lessonMinutes = modules.reduce(
    (n, m) => n + m.lessons.reduce((a, l) => a + l.estimatedMinutes, 0),
    0,
  );
  const capstoneMinutes = 15;
  const quizBuffer = 12;
  const estimatedMinutes = Math.min(90, Math.max(75, lessonMinutes + capstoneMinutes + quizBuffer));

  const finalQuestions: Q[] = [
    mcq(
      `The fastest path to useful skill in ${shortLabel(topic)} is usually:`,
      "Contracts + constrained drills + reviewable artifacts",
      ["Buying more tools first", "Passive binge learning only", "Unbounded experimentation with no notes"],
      "Bounded practice with artifacts compounds faster than tool-shopping or passive consumption.",
    ),
    mcq(
      "When scope expands mid-project, the best first move is:",
      "Re-state the contract and cut or defer extras",
      ["Work longer without changing the plan", "Delete all documentation", "Start a second parallel project"],
      "Re-contracting preserves quality and honesty about tradeoffs.",
    ),
    mcq(
      "A good capstone for this course should:",
      "Ship a minimal slice with criteria, risks, and next iteration",
      ["Only describe theory with no artifact", "Require paid APIs to complete", "Be impossible to review"],
      "Capstones prove skill with a reviewable, shippable slice.",
    ),
    mcq(
      "Kill switches / pause gates in an automated catalog system exist to:",
      "Stop enroll and generation when the owner pauses operations",
      ["Increase AI spend automatically", "Bypass daily caps", "Post to social networks without drafts"],
      "Owner controls pause sales and generation; automation stays bounded.",
    ),
    mcq(
      `Which signal should drive the next iteration on ${shortLabel(topic)}?`,
      "Observed outcomes against the written contract",
      ["Whoever spoke loudest in chat", "A random new framework", "Vanity metrics alone"],
      "Signals tied to the contract beat vibes and vanity metrics.",
    ),
  ];

  return {
    slug,
    title: topic,
    audience,
    promise,
    category,
    targetMinutes: 80,
    estimatedMinutes,
    coverLabel: shortLabel(topic).slice(0, 24),
    coverHue: hashHue(topic),
    modules,
    capstone: {
      estimatedMinutes: capstoneMinutes,
      briefMarkdown: `# Capstone: Ship a slice of ${topic}

## Brief

Produce a **minimal shippable slice** related to **${topic}** that a skeptical peer could review in 15 minutes.

## Deliverables

1. One-paragraph contract (goal, audience, constraints, out-of-scope)
2. The artifact (outline, checklist, workflow, or short write-up — 1–2 pages max)
3. Failure modes: list 3 risks and the recovery step for each
4. Next iteration: what you would measure next week

## Context from the skill gap

${gap.description.trim().slice(0, 1200)}
`,
      rubricChecklist: [
        "Contract is specific and testable",
        "Artifact is concrete (not only theory)",
        "At least 3 failure modes include recovery steps",
        "Acceptance criteria are written down",
        "Next iteration names a measurable signal",
      ],
    },
    finalQuiz: { passThreshold: 80, questions: finalQuestions },
    qaNotes:
      "Free template/heuristic generation (no external AI). generationVersion=2. Owner: Jake Sumner.",
  };
}
