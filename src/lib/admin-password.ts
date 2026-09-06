const WEAK_ADMIN_PASSWORDS = new Set([
  "",
  "changeme",
  "skillpulse-admin-change-me",
  "password",
  "admin",
]);

const DEV_SESSION_FALLBACK = "dev-session-secret-change-in-prod-min-32-chars";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isWeakAdminPassword(password: string | undefined | null): boolean {
  if (password == null) return true;
  return WEAK_ADMIN_PASSWORDS.has(password);
}

/** Resolve the expected admin password. Throws in production if missing/weak. */
export function getAdminPassword(): string {
  const raw = process.env.ADMIN_PASSWORD;
  if (isProduction()) {
    if (!raw || isWeakAdminPassword(raw)) {
      throw new Error(
        "ADMIN_PASSWORD must be set to a strong value in production (not empty/changeme/password/admin).",
      );
    }
    return raw;
  }
  // Local/dev: allow env or weak fallback for convenience
  return raw || "changeme";
}

/** Resolve session signing secret. Throws in production if missing/weak/short. */
export function getAdminSessionSecret(): string {
  const raw = process.env.ADMIN_SESSION_SECRET;
  if (isProduction()) {
    if (!raw || raw === DEV_SESSION_FALLBACK || raw.length < 32) {
      throw new Error(
        "ADMIN_SESSION_SECRET must be set in production to a unique value of at least 32 characters.",
      );
    }
    return raw;
  }
  return raw || DEV_SESSION_FALLBACK;
}

export function assertAdminCredentialsConfigured(): void {
  getAdminPassword();
  getAdminSessionSecret();
}
