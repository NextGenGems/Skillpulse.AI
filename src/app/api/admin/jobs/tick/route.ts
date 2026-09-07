import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { runAutonomyTick } from "@/lib/autonomy-tick";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { research, generation, promo } = await runAutonomyTick();
  return NextResponse.json({
    research,
    generation,
    promo,
    autonomy: "skill_gap → course → promote stubs",
  });
}
