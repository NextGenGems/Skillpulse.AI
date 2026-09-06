import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSession } from "@/lib/auth";
import { getAdminPassword } from "@/lib/admin-password";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = String(body.password || "");
    let expected: string;
    try {
      expected = getAdminPassword();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Admin credentials not configured" },
        { status: 503 },
      );
    }
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
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Login error" },
      { status: 500 },
    );
  }
}
