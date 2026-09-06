import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { researchAndQueueSample } from "@/lib/skill-gap-research";

export const dynamic = "force-dynamic";

/** POST: run free skill-gap research (no AI). Creates open SkillGaps only. */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await researchAndQueueSample();
  return NextResponse.json(result);
}
