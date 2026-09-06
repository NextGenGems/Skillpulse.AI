import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const password = String(body.password || "");
  const expected = process.env.ADMIN_PASSWORD || "skillpulse-admin-change-me";
  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
