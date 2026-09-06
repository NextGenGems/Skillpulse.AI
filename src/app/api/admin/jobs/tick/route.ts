import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { tickGenerationJobs } from "@/lib/generation-jobs";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await tickGenerationJobs();
  return NextResponse.json(result);
}
