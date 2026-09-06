import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "sp_admin";

function secretKey() {
  const s = process.env.ADMIN_SESSION_SECRET || "dev-session-secret-change-in-prod-min-32-chars";
  return new TextEncoder().encode(s);
}

export async function createAdminSession(): Promise<string> {
  return new SignJWT({ role: "admin", owner: "Jake Sumner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  return verifyAdminSession(token);
}

export { COOKIE as ADMIN_COOKIE };
