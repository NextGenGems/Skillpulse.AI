/** SkillPulse domain types — v2 course model */

export type CourseStatus = "draft" | "ready" | "published" | "unpublished";

export type QuizKind = "module" | "final";

export type ExerciseType = "pasteable" | "checklist" | "short_answer";

export interface OwnerSettings {
  ownerName: string;
  killSwitchPaused: boolean;
  allowedPurpose: "skill_gap_courses_sales_only";
  maxGenerationJobsPerDay: number;
  stripeAccountNote?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  kind: QuizKind;
  passThreshold: number;
  questions: QuizQuestion[];
}

export interface Lesson {
  id: string;
  order: number;
  title: string;
  estimatedMinutes: number;
  teachMarkdown: string;
  exercisePrompt: string;
  exerciseType: ExerciseType;
}

export interface Module {
  id: string;
  order: number;
  title: string;
  lessons: Lesson[];
  quiz: Quiz;
}

export interface Capstone {
  id: string;
  briefMarkdown: string;
  rubricChecklist: string[];
  estimatedMinutes: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  audience: string;
  promise: string;
  category: string;
  targetMinutes: number;
  estimatedMinutes: number;
  generationVersion: number;
  status: CourseStatus;
  outlineJson?: unknown;
  qaNotes?: string;
  exerciseCount: number;
  hasCapstone: boolean;
  cover: { label: string; hue: number };
  priceCents: number;
  modules: Module[];
  capstone: Capstone;
  finalQuiz: Quiz;
}

export type GenerationJobStage =
  | "research"
  | "outline"
  | "draft"
  | "qa"
  | "publish";

export type GenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

/** Schema stub — runner deferred until free AI credits exist */
export interface GenerationJob {
  id: string;
  skillGapId: string;
  courseId?: string;
  stage: GenerationJobStage;
  status: GenerationJobStatus;
  error?: string;
  attempts: number;
  lastOutputJson?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentProgress {
  enrollmentToken: string;
  courseSlug: string;
  email?: string;
  paidAt?: string;
  stripeSessionId?: string;
  completedLessonIds: string[];
  moduleQuizScores: Record<string, number>;
  finalQuizScore?: number;
  capstoneAnswers: string;
  capstoneComplete: boolean;
  certificateIssuedAt?: string;
  updatedAt: string;
}
