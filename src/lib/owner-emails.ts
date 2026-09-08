/**
 * Owner penny-checkout emails ($0.01).
 * Parse defensively so Vercel paste quirks (quotes, ; separators, case, spaces)
 * cannot silently fall through to full price.
 */

export function normalizeBuyerEmail(raw: string): string {
  return String(raw || "")
    .replace(/^\uFEFF/, "") // BOM
    .trim()
    .toLowerCase()
    .replace(/^["']+|["']+$/g, "") // wrapping quotes from env paste
    .trim();
}

/** Parse OWNER_EMAILS / OWNER_EMAIL into a deduped lowercase list. */
export function parseOwnerEmails(
  envValue: string | undefined = process.env.OWNER_EMAILS || process.env.OWNER_EMAIL,
): string[] {
  const raw = String(envValue || "");
  if (!raw.trim()) return [];

  const seen = new Set<string>();
  for (const part of raw.split(/[,;]+/)) {
    const email = normalizeBuyerEmail(part);
    if (email && email.includes("@")) seen.add(email);
  }
  return [...seen];
}

export function isOwnerBuyerEmail(email: string, ownerEmails = parseOwnerEmails()): boolean {
  const normalized = normalizeBuyerEmail(email);
  if (!normalized) return false;
  return ownerEmails.includes(normalized);
}

/**
 * Safe checkout log — never prints emails.
 * Helps diagnose "owner paid full price" without leaking PII.
 */
export function logOwnerPricingDecision(opts: {
  matched: boolean;
  ownerListCount: number;
  unitAmountCents: number;
  courseSlug: string;
}): void {
  const { matched, ownerListCount, unitAmountCents, courseSlug } = opts;
  if (ownerListCount === 0) {
    console.warn(
      "[checkout] OWNER_EMAILS empty — all buyers pay full price. Set Vercel OWNER_EMAILS (no quotes) and redeploy.",
    );
  }
  console.info(
    `[checkout] ownerPenny=${matched ? "1" : "0"} ownerListCount=${ownerListCount} unitAmountCents=${unitAmountCents} slug=${courseSlug}`,
  );
}
