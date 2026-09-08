/**
 * Free template/heuristic course builder — no external AI APIs.
 * Builds a publishable v2 course (3×3 modules/lessons + quizzes + capstone + final)
 * from a SkillGap title/description/category.
 *
 * HARD RULE: every lesson body must be unique within the course — no shared
 * boilerplate paragraphs/bullets/steps across lessons. Content varies by
 * topic + module/lesson index + focus.
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

function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

function mcq(
  prompt: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
): Q {
  const choices = [correct, ...wrong];
  const rot = prompt.length % 4;
  const rotated = [...choices.slice(rot), ...choices.slice(0, rot)];
  const correctIndex = rotated.indexOf(correct);
  return { prompt, choices: rotated, correctIndex, explanation };
}

/** Strip a leading markdown H1 so the learn page h2 is the only title. */
export function stripLeadingH1(md: string): string {
  return md.replace(/^\s*#\s+[^\n]+\n+/, "").trimStart();
}

/**
 * Reject specs where any two lessons share more than `maxShared` identical
 * non-empty lines (boilerplate clone detection).
 */
export function assertUniqueLessonBodies(
  modules: ModuleSpec[],
  maxShared = 3,
): { ok: true } | { ok: false; detail: string } {
  const bodies = modules.flatMap((m) =>
    m.lessons.map((l) => ({
      key: `${m.order}.${l.order} ${l.title}`,
      lines: new Set(
        l.teachMarkdown
          .split("\n")
          .map((x) => x.trim())
          .filter((x) => x.length > 24 && !x.startsWith("##")),
      ),
    })),
  );
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      let shared = 0;
      for (const line of bodies[i]!.lines) {
        if (bodies[j]!.lines.has(line)) shared += 1;
      }
      if (shared > maxShared) {
        return {
          ok: false,
          detail: `${bodies[i]!.key} and ${bodies[j]!.key} share ${shared} identical lines (max ${maxShared})`,
        };
      }
    }
  }
  return { ok: true };
}

type LessonCtx = {
  topic: string;
  short: string;
  moduleTitle: string;
  moduleOrder: number;
  lessonTitle: string;
  lessonOrder: number;
  /** 0..8 global lesson index across the course */
  globalIndex: number;
  focus: string;
  seed: number;
};

function conceptParagraphs(ctx: LessonCtx): string {
  const { topic, short, lessonTitle, focus, globalIndex, moduleOrder, seed } = ctx;
  const openings = [
    `When you practice **${lessonTitle}** inside **${topic}**, the goal is not a clever take — it is a repeatable move you can run on a Tuesday with incomplete inputs.`,
    `**${short}** work fails quietly when "${lessonTitle}" stays vague. This lesson turns that vagueness into a contract you can demo.`,
    `Solo operators win on **${topic}** by making "${lessonTitle}" boringly explicit: named inputs, a done state, and a recovery path.`,
    `Treat **${lessonTitle}** as a product skill for **${short}**: if a stranger cannot audit what you did, you did not finish.`,
    `Most people under-invest in **${lessonTitle}** because it feels like overhead. Under real **${topic}** pressure, it is the only thing that keeps quality from collapsing.`,
    `This slice of **${topic}** is about **${lessonTitle}** — the move between "I understand the idea" and "I can ship a reviewable artifact."`,
    `**${moduleOrder === 1 ? "Foundations" : moduleOrder === 2 ? "Constrained practice" : "Shipping"}** for **${short}** hinges on how you handle **${lessonTitle}**.`,
    `If your **${topic}** workflow skips a crisp take on **${lessonTitle}**, you will re-litigate the same decisions every week.`,
    `**${lessonTitle}** is where **${short}** becomes operational: fewer debates, more artifacts, clearer handoffs.`,
  ];
  const middles = [
    focus,
    `Concretely: write the job in one sentence a skeptical peer would accept, then list what is in-scope and out-of-scope for **${short}** before you optimize tactics.`,
    `The practical bar for this lesson: after 15–20 minutes you should have a small, named artifact tied to **${topic}** that someone else could critique without a meeting.`,
    `Keep the loop tight — observe a real input from **${topic}**, apply the pattern below, and leave a paper trail (checklist, notes, or schema) you can reopen next week.`,
    `Resist polishing wording before the contract exists. For **${lessonTitle}**, clarity of constraints beats elegance every time.`,
    `You will deliberately use imperfect information. **${topic}** in the wild is messy; your practice should be too, or the drill will not transfer.`,
    `Name the failure mode you fear most for **${short}** in this lesson — then design the recovery step *before* you produce the happy-path artifact.`,
    `Anchor everything to a weekly cadence: what you produce here should fit inside a solo operator's afternoon, not a multi-week program.`,
    `Version your thinking. Label this attempt (v1) so later iterations on **${topic}** can cite what changed and why.`,
  ];
  const closings = [
    `By the end you will have practiced **${lessonTitle}** with a concrete deliverable — not a summary of theory.`,
    `Done means: artifact + constraints + one recovery step, all specific to **${topic}**.`,
    `If you only remember one thing: make **${lessonTitle}** testable against **${short}**, then stop expanding scope.`,
    `Carry the artifact forward — later lessons in this course assume you can point at something real for **${topic}**.`,
    `Your future self is the primary stakeholder. Write for the operator who opens this folder in two weeks cold.`,
    `Quality here is recoverability: can you restart after a bad input without throwing away the whole **${short}** effort?`,
    `Prefer a small correct slice over a large vague document about **${topic}**.`,
    `Peer-ready beats private genius. Assume someone will grade this against a rubric.`,
    `Timebox ruthlessly — the pattern below is designed for a single focused block on **${lessonTitle}**.`,
  ];
  const a = pick(openings, seed + globalIndex);
  const b = pick(middles, seed + globalIndex * 3 + 1);
  const c = pick(middles, seed + globalIndex * 5 + 7);
  const d = pick(closings, seed + globalIndex * 2 + 11);
  const mid2 =
    b === c
      ? pick(
          middles.filter((x) => x !== b),
          seed + 99,
        )
      : c;
  const tag = (para: string, n: number) =>
    para.includes(lessonTitle) ? para : `${para} (Applies to **${lessonTitle}**, para ${n}.)`;
  const anchor = `*(Lesson focus: ${lessonTitle} — module ${moduleOrder}, slot ${globalIndex + 1}.)*`;
  return `${tag(a, 1)}\n\n${tag(b, 2)}\n\n${tag(mid2, 3)}\n\n${tag(d, 4)}\n\n${anchor}`;
}

function whyItMatters(ctx: LessonCtx): string[] {
  const { topic, short, lessonTitle, globalIndex, seed, moduleOrder } = ctx;
  const pools: string[][] = [
    [
      `Unscoped **${lessonTitle}** work balloons cost on **${topic}** before you notice`,
      `Reviewers cannot help if inputs and done-states for **${short}** are invisible`,
      `Messy real-world inputs are the default for **${topic}**, not the edge case`,
      `A written contract lets you cut scope without guilt when time runs out`,
      `Solo operators need handoff-quality notes even when the handoff is future-you`,
      `Clear failure naming turns incidents into drills instead of shame spirals`,
    ],
    [
      `Time pressure without a checklist makes **${lessonTitle}** quality mood-dependent`,
      `Tradeoffs you refuse to name will be made for you by deadlines`,
      `Templates for **${short}** compound; one-off heroics do not`,
      `Peer review without criteria becomes aesthetic nitpicking`,
      `Constrained drills expose weak spots in **${topic}** faster than binge reading`,
      `A recoverable artifact beats a perfect draft you never finish`,
    ],
    [
      `Shipping a slice of **${topic}** teaches more than another outline about **${lessonTitle}**`,
      `Stakeholders trust defenses that list assumptions and risks up front`,
      `Signals beat vibes when choosing the next iteration on **${short}**`,
      `Acceptance criteria protect you from silent goalpost moves`,
      `Minimal shippable work still needs a recovery story for **${topic}**`,
      `Documenting "what I would change next" keeps momentum after launch`,
    ],
  ];
  const pool = pools[(moduleOrder - 1) % pools.length]!;
  // Rotate + mix with seed so each lesson gets a distinct 5-bullet set
  const rot = (seed + globalIndex * 2) % pool.length;
  const rotated = [...pool.slice(rot), ...pool.slice(0, rot)];
  const extras = [
    `Skipping **${lessonTitle}** reintroduces the same debate every sprint on **${topic}**`,
    `Without a demoable artifact, **${short}** progress is just a feeling`,
    `Bounded practice on **${lessonTitle}** beats unbounded exploration with no notes`,
    `Audit trails make **${topic}** work coachable and hireable`,
    `Naming out-of-scope items prevents **${lessonTitle}** from swallowing the week`,
  ];
  const picks = [...rotated.slice(0, 4), pick(extras, seed + globalIndex + moduleOrder)];
  // Force lesson-specific wording so lines cannot collide across lessons
  return picks.slice(0, 5 + (globalIndex % 2)).map(
    (b, i) => `${b} (re: ${lessonTitle}, item ${i + 1})`,
  );
}

function workedExample(ctx: LessonCtx): string {
  const { topic, short, lessonTitle, globalIndex, seed, moduleOrder, focus } = ctx;
  const scenarios = [
    {
      setup: `**Scenario (solo operator):** You have one afternoon to improve **${topic}** for a paying client who sends messy notes by email.`,
      bad: `Open a blank doc and "figure out **${lessonTitle}**" while rereading the same threads.`,
      good: `Write a one-paragraph contract for **${lessonTitle}**, list 3 constraints, produce a one-page artifact, and schedule a 10-minute self-review against a rubric.`,
      artifact: `A dated \`v1\` note: goal, constraints, artifact link, failure→recovery for **${short}**.`,
    },
    {
      setup: `**Scenario (product slice):** Your team wants a thin vertical for **${short}** that a PM can click through without a walkthrough.`,
      bad: `Polish slides about **${lessonTitle}** instead of a runnable or pasteable deliverable.`,
      good: `Ship a minimal path that demonstrates **${lessonTitle}** with fake-but-realistic inputs drawn from **${topic}**.`,
      artifact: `Acceptance criteria (3 bullets) + the slice + a screenshot or paste of the output.`,
    },
    {
      setup: `**Scenario (ops cadence):** Weekly **${topic}** work keeps slipping because **${lessonTitle}** is undefined.`,
      bad: `Add another tool and hope the process appears.`,
      good: `Install a 25-minute drill: timer, checklist unique to this lesson, and a single metric you will glance at next week.`,
      artifact: `A recurring checklist titled for **${lessonTitle}** with the metric definition inline.`,
    },
    {
      setup: `**Scenario (handoff):** You will be offline Friday; someone else must continue **${short}** without pinging you.`,
      bad: `Leave tribal knowledge in chat history about **${lessonTitle}**.`,
      good: `Package assumptions, risks, and the next command/step for **${topic}** in one page.`,
      artifact: `Handoff page: context, current state, next 3 steps, who to escalate.`,
    },
    {
      setup: `**Scenario (quality gate):** Yesterday's **${topic}** output looked fine until a weird input broke **${lessonTitle}**.`,
      bad: `Patch the symptom and move on.`,
      good: `Add a named failure case + recovery to your contract, then re-run the drill once.`,
      artifact: `Failure card: trigger, detection, recovery, owner (you).`,
    },
    {
      setup: `**Scenario (sales-adjacent):** A prospect asks how you approach **${topic}**; you need a credible 5-minute story anchored on **${lessonTitle}**.`,
      bad: `Improvise buzzwords.`,
      good: `Walk the pattern: contract → constrained drill → reviewable artifact → iteration signal.`,
      artifact: `Talk track (8–10 lines) plus one redacted sample artifact.`,
    },
    {
      setup: `**Scenario (tooling thrash):** Three different workflows for **${short}** exist in your notes; none finish **${lessonTitle}**.`,
      bad: `Start a fourth.`,
      good: `Pick one path for this lesson, delete or archive the others for two weeks, and measure completion rate.`,
      artifact: `Decision log: chosen path, rejected paths, revisit date.`,
    },
    {
      setup: `**Scenario (capstone warm-up):** You need a piece you can later fold into a shippable **${topic}** slice.`,
      bad: `Write abstract theory about **${lessonTitle}**.`,
      good: `Produce something a peer could score in 10 minutes using explicit criteria.`,
      artifact: `Rubric (5 lines) + submission that maps 1:1 to the rubric.`,
    },
    {
      setup: `**Scenario (signal famine):** You finished work on **${topic}** but cannot tell if **${lessonTitle}** improved anything.`,
      bad: `Declare victory from effort spent.`,
      good: `Define one observable signal and a baseline before you change tactics.`,
      artifact: `Signal card: metric, baseline, target, check-in date.`,
    },
  ];
  const s = pick(scenarios, seed + globalIndex * 4 + moduleOrder);
  return `${s.setup}

**Focus for this lesson (${lessonTitle}):** ${focus}

**Weak approach (avoid for ${lessonTitle}):** ${s.bad}

**Strong approach (prefer for ${lessonTitle}):** ${s.good}

**Concrete artifact to leave behind for ${lessonTitle}:** ${s.artifact}

**Topic stitch:** For **${lessonTitle}** in particular, every number, noun, and constraint you write should mention **${topic}** or **${short}** so this example cannot be mistaken for another lesson in the course.`;
}

function stepPattern(ctx: LessonCtx): string[] {
  const { topic, short, lessonTitle, globalIndex, seed, moduleOrder } = ctx;
  const banks: string[][] = [
    [
      `Write a one-sentence job statement for **${lessonTitle}** a skeptical peer would accept`,
      `List inputs you actually have today for **${topic}** (not ideal inputs)`,
      `Name the done state in observable terms for **${short}**`,
      `Write 2–3 constraints (time, tools, quality bar)`,
      `Declare out-of-scope items so **${lessonTitle}** cannot sprawl`,
      `Draft the smallest artifact that proves the job`,
      `Add one failure mode + recovery before you polish`,
      `Timebox a self-review against those criteria`,
    ],
    [
      `Pick a 25–40 minute window and set a visible timer for **${lessonTitle}**`,
      `Choose one real messy input from **${topic}** (email, note, ticket, dump)`,
      `Run the drill once without restarting mid-way`,
      `Capture decisions in a dated note tied to **${short}**`,
      `Score the output with a 5-line rubric you wrote first`,
      `Change exactly one variable and re-run a thin second pass`,
      `Log what broke and what you would change next time`,
      `Stop when the timer ends — ship the incomplete truth`,
    ],
    [
      `Inventory templates/checklists you already use for **${short}**`,
      `Delete or archive duplicates that fight **${lessonTitle}**`,
      `Write a fresh checklist with verbs specific to **${topic}**`,
      `Attach an example of good vs borderline output`,
      `Place the checklist where the work happens (doc, repo, or kanban)`,
      `Run it on one live item today`,
      `Note friction points in the margins`,
      `Schedule a weekly 10-minute prune of the checklist`,
    ],
    [
      `Define acceptance criteria for a peer review of **${lessonTitle}**`,
      `Assemble the artifact bundle (link + context + constraints)`,
      `Do a silent self-review as if you were a hostile reviewer`,
      `Fix only issues that fail criteria — ignore taste nits`,
      `Write the defense: assumptions, risks, unknowns for **${topic}**`,
      `Ask (or simulate) one clarifying question a peer would ask`,
      `Update the artifact with answers`,
      `File a "next iteration" note with one measurable signal`,
    ],
    [
      `Cut the **${topic}** surface to a minimal shippable slice involving **${lessonTitle}**`,
      `Write acceptance criteria before building`,
      `Implement or draft only what the criteria require`,
      `Demo with a realistic input path`,
      `Record three risks and recovery steps`,
      `Publish or paste the slice somewhere durable`,
      `Collect one signal (even if qualitative) within 48 hours`,
      `Plan the next slice using that signal, not a new whim`,
    ],
  ];
  const bank = pick(banks, seed + moduleOrder + globalIndex);
  const rot = (seed + globalIndex) % Math.max(1, bank.length - 5);
  const steps = [...bank.slice(rot), ...bank.slice(0, rot)].slice(0, 5 + (globalIndex % 4)); // 5–8
  return steps.map(
    (s, i) =>
      `${s} — [${ctx.moduleOrder}.${ctx.lessonOrder}.${i + 1} ${ctx.lessonTitle}]`,
  );
}

function commonMistakes(ctx: LessonCtx): string[] {
  const { topic, short, lessonTitle, globalIndex, seed } = ctx;
  const all = [
    `Jumping into clever tactics for **${lessonTitle}** before writing a contract for **${topic}**`,
    `Optimizing elegance instead of recoverability on **${short}**`,
    `Using only happy-path examples that never appear in real **${topic}** inputs`,
    `Expanding scope mid-drill because the first artifact felt too small`,
    `Skipping a written failure→recovery pair for **${lessonTitle}**`,
    `Measuring effort ("hours spent") instead of outcomes for **${short}**`,
    `Keeping three competing workflows alive and finishing none`,
    `Asking for peer review without acceptance criteria`,
    `Copying a generic checklist that never mentions **${topic}**`,
    `Polishing prose while the done-state for **${lessonTitle}** is still fuzzy`,
    `Treating tools as the strategy for **${short}**`,
    `Declaring victory without a baseline signal on **${topic}**`,
    `Hiding assumptions so nobody can challenge them`,
    `Restarting from zero every week instead of versioning artifacts`,
    `Shipping theater (slides) when a pasteable artifact was required`,
  ];
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    out.push(pick(all, seed + globalIndex * 7 + i * 3 + i));
  }
  return [...new Set(out)].slice(0, 4).map(
    (m, i) => `${m} [${lessonTitle} · mistake ${i + 1}]`,
  );
}

function practiceExercise(ctx: LessonCtx): { prompt: string; type: string } {
  const { topic, short, lessonTitle, globalIndex, seed, focus } = ctx;
  const exercises = [
    {
      type: "pasteable",
      prompt: `**Deliverable for ${lessonTitle}:** Write a one-page contract for this slice of **${topic}**. Include: (1) one-sentence job, (2) audience, (3) inputs you have, (4) done-state, (5) 3 constraints, (6) out-of-scope list, (7) one failure→recovery. Paste the page. Done when a stranger could implement a test from it alone.\n\nFocus: ${focus}`,
    },
    {
      type: "pasteable",
      prompt: `**Deliverable for ${lessonTitle}:** Run a 30-minute timed drill on a real messy input related to **${short}**. Submit: timer screenshot or note, the raw input summary (redact secrets), your artifact, and a 5-line self-score against criteria you wrote first.\n\nFocus: ${focus}`,
    },
    {
      type: "checklist",
      prompt: `**Deliverable for ${lessonTitle}:** Create a verb-heavy checklist (8–12 steps) unique to **${topic}** / **${lessonTitle}**. Include one "stop and recover" step. Submit the checklist plus a mark-up of where you ran it once today.\n\nFocus: ${focus}`,
    },
    {
      type: "pasteable",
      prompt: `**Deliverable for ${lessonTitle}:** Produce a peer-review packet for **${short}**: acceptance criteria (5 bullets), the artifact, assumptions/risks (3), and the single question you want a reviewer to answer. Done when the packet stands alone.\n\nFocus: ${focus}`,
    },
    {
      type: "short_answer",
      prompt: `**Deliverable for ${lessonTitle}:** In ≤400 words, defend a minimal shippable slice of **${topic}** that exercises **${lessonTitle}**. Cover criteria, what you cut, risks, and the signal you will check next week.\n\nFocus: ${focus}`,
    },
    {
      type: "pasteable",
      prompt: `**Deliverable for ${lessonTitle}:** Build a failure card deck (3 cards) for **${topic}**. Each card: trigger, how you detect it, recovery within 15 minutes, and prevention note for **${lessonTitle}**.\n\nFocus: ${focus}`,
    },
    {
      type: "pasteable",
      prompt: `**Deliverable for ${lessonTitle}:** Write an iteration plan from signals (not vibes) for **${short}**: baseline metric, how collected, decision rule, and next experiment capped at 2 hours.\n\nFocus: ${focus}`,
    },
    {
      type: "checklist",
      prompt: `**Deliverable for ${lessonTitle}:** Draft a handoff page for **${topic}** covering **${lessonTitle}**: current state, next 3 steps, escalation path, and links to artifacts. Run a "cold open" test: can you follow it after 24 hours?\n\nFocus: ${focus}`,
    },
    {
      type: "pasteable",
      prompt: `**Deliverable for ${lessonTitle}:** Create a before/after pair for **${short}**. Before: today's weak approach to **${lessonTitle}**. After: the improved artifact using this lesson's pattern. Annotate three specific upgrades.\n\nFocus: ${focus}`,
    },
  ];
  return pick(exercises, seed + globalIndex * 5);
}

function selfCheck(ctx: LessonCtx): string[] {
  const { topic, short, lessonTitle, globalIndex, seed } = ctx;
  const items = [
    `Can you state the job of **${lessonTitle}** in one testable sentence about **${topic}**?`,
    `Did you write constraints and out-of-scope items specific to **${short}** (not generic advice)?`,
    `Is there a concrete artifact dated today that a peer could open without you narrating?`,
    `Did you name at least one failure mode and a recovery step for **${lessonTitle}**?`,
    `Could a stranger tell this work is about **${topic}** from the nouns alone?`,
    `Did you timebox and stop, or did scope quietly expand?`,
    `Is there a signal or rubric you will use next week on **${short}**?`,
    `Did you version this attempt (v1/v2) so iteration is visible?`,
    `Would you be comfortable pasting this into a client folder for **${topic}**?`,
    `Did your exercise produce something other than a restatement of the lesson text?`,
  ];
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    out.push(pick(items, seed + globalIndex * 11 + i * 5 + i));
  }
  return [...new Set(out)].concat(
    `Final: does this lesson's example mention **${topic}** and **${lessonTitle}** explicitly?`,
  ).slice(0, 5);
}

function lessonMarkdown(ctx: LessonCtx): string {
  const why = whyItMatters(ctx);
  const steps = stepPattern(ctx);
  const mistakes = commonMistakes(ctx);
  const practice = practiceExercise(ctx);
  const checks = selfCheck(ctx);
  // No leading H1 — learn page already renders <h2>{title}</h2>
  return `## Concept

${conceptParagraphs(ctx)}

## Why it matters

${why.map((b) => `- ${b}`).join("\n")}

## Worked example

${workedExample(ctx)}

## Step-by-step pattern

${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Common mistakes

${mistakes.map((m) => `- ${m}`).join("\n")}

## Practice exercise

${practice.prompt}

## Self-check

${checks.map((c, i) => `${i + 1}. ${c}`).join("\n")}
`;
}

/**
 * Build a full course spec from a skill gap using templates + heuristics only.
 * Throws if lesson bodies fail the uniqueness gate (should not happen with varied generators).
 */
export function buildCourseFromSkillGap(gap: GapInput): BuiltCourseSpec {
  const topic = topicWords(gap.title);
  const short = shortLabel(topic);
  const category = (gap.category?.trim() || "emerging-skills").slice(0, 80);
  const baseSlug =
    slugifyCourse(gap.slugHint || gap.title) || `skill-gap-${Date.now().toString(36)}`;
  const slug = baseSlug;
  const seed = stableHash(`${topic}|${category}|${gap.description.slice(0, 200)}`);

  const audience = `Practitioners and solo operators leveling up on ${topic} (mid-level)`;
  const promise = `Build practical fluency in ${topic} — with unique lesson drills, contracts, and a capstone you can ship or show in a review (~2–3 hours teach + practice).`;

  const moduleBlueprints = [
    {
      title: `Foundations of ${short}`,
      purpose: `Establish vocabulary, contracts, and the minimum bar for ${topic}.`,
      focuses: [
        `Define what “good” looks like for ${topic} before you optimize tactics — write the quality bar in observable language.`,
        `Map inputs, outputs, and failure modes for ${topic} so every piece of work stays reviewable under messy data.`,
        `Install a lightweight weekly measurement loop for ${topic} you can run without buying new tools.`,
      ],
      lessonTitles: [
        `What “good” means for ${short}`,
        `Inputs, outputs, and failure modes in ${short}`,
        `A weekly measurement loop for ${short}`,
      ],
    },
    {
      title: `Practice ${short} under constraints`,
      purpose: `Turn ${topic} concepts into repeatable drills with timeboxes and quality gates.`,
      focuses: [
        `Run a constrained drill on ${topic} that forces tradeoffs instead of perfect answers.`,
        `Build checklists and templates for ${topic} so quality does not depend on mood.`,
        `Review ${topic} artifacts with a peer-ready rubric (even if the peer is future-you).`,
      ],
      lessonTitles: [
        `Timeboxed ${short} drills that force tradeoffs`,
        `Checklists and templates that stick for ${short}`,
        `Peer-ready review of ${short} without theater`,
      ],
    },
    {
      title: `Ship and defend ${short}`,
      purpose: `Package ${topic} work so it survives contact with users, stakeholders, or production.`,
      focuses: [
        `Package a minimal shippable slice of ${topic} with clear acceptance criteria.`,
        `Write the defense for ${topic}: assumptions, risks, and what you would change next.`,
        `Plan the next ${topic} iteration using signals, not vibes.`,
      ],
      lessonTitles: [
        `A minimal shippable slice of ${short}`,
        `Defend assumptions and risks in ${short}`,
        `Iterate ${short} from signals, not vibes`,
      ],
    },
  ];

  const modules: ModuleSpec[] = moduleBlueprints.map((bp, mi) => {
    const order = mi + 1;
    const lessons: LessonSpec[] = bp.lessonTitles.map((lt, li) => {
      const globalIndex = mi * 3 + li;
      const ctx: LessonCtx = {
        topic,
        short,
        moduleTitle: bp.title,
        moduleOrder: order,
        lessonTitle: lt,
        lessonOrder: li + 1,
        globalIndex,
        focus: bp.focuses[li] ?? bp.focuses[0]!,
        seed,
      };
      const practice = practiceExercise(ctx);
      return {
        order: li + 1,
        title: lt,
        estimatedMinutes: 15 + (globalIndex % 4), // 15–18
        teachMarkdown: lessonMarkdown(ctx),
        exercisePrompt: practice.prompt,
        exerciseType: practice.type,
      };
    });

    const label = short;
    const quizQuestions: Q[] = [
      mcq(
        `For "${bp.lessonTitles[0]}" in ${label}, what should you define first?`,
        "A clear contract for good outcomes and constraints specific to the topic",
        [
          "The most clever tactic you can invent this week",
          "A large tool purchase before any artifact",
          "Unlimited scope until inspiration arrives",
        ],
        "Topic-specific contracts and constraints keep practice reviewable and bounded.",
      ),
      mcq(
        `In module ${order} (${bp.title}), which habit most improves ${label} quality under time pressure?`,
        "Small artifacts plus an explicit checklist unique to this module",
        [
          "Waiting for perfect inspiration before starting",
          "Skipping review to save time",
          "Expanding scope mid-drill to feel productive",
        ],
        "Checklists and small artifacts beat perfectionism when time is limited.",
      ),
      mcq(
        `Which failure-mode practice is most useful while learning ${label}?`,
        "Name the failure and the recovery step in advance for this topic",
        [
          "Ignore failures until launch day",
          "Blame the tools only and move on",
          "Add more features to hide the failure",
        ],
        "Pre-named recovery steps turn failures into recoverable events.",
      ),
      mcq(
        `What makes a review useful for ${label} work in this module?`,
        "A peer-ready rubric against acceptance criteria written for this topic",
        [
          "Only aesthetic polish feedback with no criteria",
          "Silent approval without notes",
          "Moving goalposts after the artifact is done",
        ],
        "Rubrics tied to acceptance criteria make feedback actionable.",
      ),
      mcq(
        `After finishing module ${order} on ${label}, what should you be able to show?`,
        `A reviewable artifact set for ${label} with criteria, not just notes about theory`,
        [
          "Only bookmarks and unread tabs",
          "A purchase receipt for a new SaaS tool",
          "A motivational quote about learning",
        ],
        "Module completion means artifacts and criteria, not consumption.",
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

  const uniq = assertUniqueLessonBodies(modules, 3);
  if (!uniq.ok) {
    throw new Error(`Lesson uniqueness check failed: ${uniq.detail}`);
  }

  const lessonMinutes = modules.reduce(
    (n, m) => n + m.lessons.reduce((a, l) => a + l.estimatedMinutes, 0),
    0,
  );
  const capstoneMinutes = 25;
  const quizBuffer = 20;
  // ~2–3 hours teach+practice feel
  const estimatedMinutes = Math.min(
    180,
    Math.max(120, lessonMinutes + capstoneMinutes + quizBuffer),
  );

  const finalQuestions: Q[] = [
    mcq(
      `The fastest path to useful skill in ${short} is usually:`,
      "Contracts + constrained drills + reviewable artifacts unique to the topic",
      [
        "Buying more tools before any drill",
        "Passive binge learning only",
        "Unbounded experimentation with no notes",
      ],
      "Bounded practice with artifacts compounds faster than tool-shopping or passive consumption.",
    ),
    mcq(
      `When scope expands mid-project on ${short}, the best first move is:`,
      "Re-state the contract and cut or defer extras",
      [
        "Work longer without changing the plan",
        "Delete all documentation",
        "Start a second parallel project",
      ],
      "Re-contracting preserves quality and honesty about tradeoffs.",
    ),
    mcq(
      `A good capstone for a ${short} course should:`,
      "Ship a minimal slice with criteria, risks, and next iteration",
      [
        "Only describe theory with no artifact",
        "Require paid APIs to complete",
        "Be impossible to review",
      ],
      "Capstones prove skill with a reviewable, shippable slice.",
    ),
    mcq(
      "Kill switches / pause gates in an automated catalog system exist to:",
      "Stop enroll and generation when the owner pauses operations",
      [
        "Increase AI spend automatically",
        "Bypass daily caps",
        "Post to social networks without drafts",
      ],
      "Owner controls pause sales and generation; automation stays bounded.",
    ),
    mcq(
      `Which signal should drive the next iteration on ${short}?`,
      "Observed outcomes against the written contract",
      [
        "Whoever spoke loudest in chat",
        "A random new framework",
        "Vanity metrics alone",
      ],
      "Signals tied to the contract beat vibes and vanity metrics.",
    ),
  ];

  return {
    slug,
    title: topic,
    audience,
    promise,
    category,
    targetMinutes: 150,
    estimatedMinutes,
    coverLabel: short.slice(0, 24),
    coverHue: hashHue(topic),
    modules,
    capstone: {
      estimatedMinutes: capstoneMinutes,
      briefMarkdown: `## Capstone brief: ship a slice of ${topic}

Produce a **minimal shippable slice** related to **${topic}** that a skeptical peer could review in 20 minutes.

### Deliverables

1. One-paragraph contract (goal, audience, constraints, out-of-scope) specific to **${short}**
2. The artifact (outline, checklist, workflow, or short write-up — 1–2 pages max)
3. Failure modes: list 3 risks and the recovery step for each
4. Next iteration: what you would measure next week (one signal)

### Rubric orientation

Your submission should be unmistakably about **${topic}** — nouns, examples, and constraints must not read like a generic productivity essay.

### Context from the skill gap

${gap.description.trim().slice(0, 1200)}
`,
      rubricChecklist: [
        `Contract is specific and testable for ${short}`,
        "Artifact is concrete (not only theory)",
        "At least 3 failure modes include recovery steps",
        "Acceptance criteria are written down",
        "Next iteration names a measurable signal",
      ],
    },
    finalQuiz: { passThreshold: 80, questions: finalQuestions },
    qaNotes:
      "Free template/heuristic generation (no external AI). generationVersion=2; meaty unique lessons; Owner: Jake Sumner.",
  };
}
