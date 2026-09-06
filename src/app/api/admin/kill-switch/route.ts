import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { setKillSwitch } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const paused = !!body.killSwitchPaused;
  const settings = await setKillSwitch(paused);
  return NextResponse.json({
    killSwitchPaused: settings.killSwitchPaused,
    ownerName: settings.ownerName,
  });
}
