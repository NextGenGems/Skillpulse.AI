import { NextRequest, NextResponse } from "next/server";
import { runAutonomyTick } from "@/lib/autonomy-tick";

export const dynamic = "force-dynamic";

function cronAuthorized(req: NextRequest): { ok: boolean; status?: number; error?: string } {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      return { ok: false, status: 503, error: "CRON_SECRET unset" };
    }
    // Local/dev: allow when CRON_SECRET unset
    return { ok: true };
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  if (bearer === secret || headerSecret === secret) {
    return { ok: true };
  }
  return { ok: false, status: 401, error: "Unauthorized" };
}

async function runTick(req: NextRequest) {
  const auth = cronAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });
  }
  const { research, generation, promo } = await runAutonomyTick();
  return NextResponse.json({
    research,
    generation,
    promo,
    autonomy: "skill_gap → course → promote stubs",
  });
}

/** Vercel Cron invokes GET */
export async function GET(req: NextRequest) {
  return runTick(req);
}

/** External crons / GitHub Actions may POST */
export async function POST(req: NextRequest) {
  return runTick(req);
}
