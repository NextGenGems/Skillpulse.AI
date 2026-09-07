import { tickGenerationJobs } from "./generation-jobs";
import { tickPromoJobs } from "./promo-jobs";
import { tickSkillGapResearch } from "./skill-gap-research";

/**
 * Unified autonomy tick: skill_gap research → course generate/publish → promo.
 * $0 OpEx path: templates + optional free Groq + optional Bluesky AT Protocol.
 * Kill switch pauses research/generation/promo posts.
 */
export async function runAutonomyTick() {
  const research = await tickSkillGapResearch();
  const generation = await tickGenerationJobs();
  const promo = await tickPromoJobs();
  return { research, generation, promo };
}
