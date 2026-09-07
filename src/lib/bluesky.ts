/**
 * Minimal Bluesky AT Protocol client for owner-disclosed promo posts ($0).
 * createSession → createRecord(app.bsky.feed.post). No SDK dependency.
 */

const DEFAULT_PDS = "https://bsky.social";

export type BlueskyCreds = {
  handle: string;
  appPassword: string;
};

export type BlueskyPostResult = {
  uri: string;
  cid: string;
};

export function getBlueskyCreds(): BlueskyCreds | null {
  const handle = process.env.BLUESKY_HANDLE?.trim() ?? "";
  const appPassword = process.env.BLUESKY_APP_PASSWORD?.trim() ?? "";
  if (!handle || !appPassword) return null;
  return { handle, appPassword };
}

export function isBlueskyConfigured(): boolean {
  return getBlueskyCreds() !== null;
}

/** SOCIAL_POSTING_ENABLED=false explicitly disables outbound Bluesky posts. */
export function isSocialPostingEnabled(): boolean {
  const v = process.env.SOCIAL_POSTING_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  // Default: allow when Bluesky creds present; true also enables social-ready flag.
  return true;
}

type Session = { did: string; accessJwt: string };

async function createSession(creds: BlueskyCreds): Promise<Session> {
  const res = await fetch(`${DEFAULT_PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: creds.handle,
      password: creds.appPassword,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `bluesky_createSession_failed:${res.status}:${body.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as { did?: string; accessJwt?: string };
  if (!data.did || !data.accessJwt) {
    throw new Error("bluesky_createSession_missing_tokens");
  }
  return { did: data.did, accessJwt: data.accessJwt };
}

/**
 * Post a short text record. Max ~300 graphemes preferred for Bluesky.
 */
export async function postBlueskyText(text: string): Promise<BlueskyPostResult> {
  const creds = getBlueskyCreds();
  if (!creds) throw new Error("bluesky_creds_missing");
  if (!isSocialPostingEnabled()) throw new Error("social_posting_disabled");

  const truncated = text.length > 280 ? `${text.slice(0, 277)}...` : text;
  const session = await createSession(creds);

  const res = await fetch(`${DEFAULT_PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: truncated,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `bluesky_createRecord_failed:${res.status}:${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { uri?: string; cid?: string };
  if (!data.uri || !data.cid) {
    throw new Error("bluesky_createRecord_missing_uri_cid");
  }
  return { uri: data.uri, cid: data.cid };
}

export function buildBlueskyPromoText(course: {
  title: string;
  slug: string;
  promise: string;
}): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://skillpulse-ai-ten.vercel.app";
  const url = `${base}/courses/${course.slug}`;
  const promiseBit = course.promise.slice(0, 100);
  return [
    `${course.title} — short practical course.`,
    promiseBit,
    url,
    "— Jake Sumner / Skill Flex (owner-disclosed)",
  ].join("\n");
}
