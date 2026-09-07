import { tickGenerationJobs } from "./generation-jobs";
import { tickPromoJobs } from "./promo-jobs";
import { tickSkillGapResearch } from "./skill-gap-research";

/**
 * Unified autonomy tick: skill_gap research → free template course → promo drafts.
 * $0 OpEx: no paid AI, no social HTTP, no Stripe changes.
 */
export async function runAutonomyTick() {
  const research = await tickSkillGapResearch();
  const generation = await tickGenerationJobs();
  const promo = await tickPromoJobs();
  return { research, generation, promo };
}
