// X (Twitter) provider — uses the official X API v2 when a bearer token with sufficient
// access tier is configured. The free "Essential" tier no longer permits the user-timeline
// or recent-search endpoints needed for arbitrary accounts; this requires at least the
// Basic ($) tier, or a third-party provider. The function is written so that if/when you
// have a valid bearer token with timeline access, it works out of the box.

import type { Provider, ProviderResult, NormalizedPost } from "./types.ts";

const BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN") ?? "";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function extractHandle(profileUrl: string): string | null {
  try {
    const path = new URL(profileUrl).pathname.replace(/^\//, "").replace(/\/+$/, "");
    return path || null;
  } catch {
    return null;
  }
}

export const twitterProvider: Provider = {
  async fetchRecentPosts(profileUrl: string): Promise<ProviderResult> {
    const handle = extractHandle(profileUrl);
    if (!BEARER_TOKEN) {
      return {
        status: "unavailable",
        message: "X API not configured (requires a paid-tier bearer token, or a third-party provider). See README §5.5.",
        posts: [],
      };
    }
    if (!handle) {
      return { status: "error", message: "Could not parse handle from URL", posts: [] };
    }

    try {
      const userRes = await fetch(`https://api.twitter.com/2/users/by/username/${handle}`, {
        headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
      });
      const userJson = await userRes.json();
      const userId = userJson.data?.id;
      if (!userId) {
        return { status: "error", message: "Could not resolve user id", posts: [] };
      }

      const tweetsRes = await fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?max_results=25&tweet.fields=created_at,public_metrics&exclude=retweets,replies`,
        { headers: { Authorization: `Bearer ${BEARER_TOKEN}` } }
      );
      const tweetsJson = await tweetsRes.json();
      const cutoff = Date.now() - SEVEN_DAYS_MS;

      const posts: NormalizedPost[] = (tweetsJson.data ?? [])
        .filter((t: any) => new Date(t.created_at).getTime() >= cutoff)
        .map((t: any) => ({
          externalId: t.id,
          title: t.text,
          permalink: `https://x.com/${handle}/status/${t.id}`,
          thumbnailUrl: null, // requires expansion of attachments.media_keys; omitted for simplicity
          publishedAt: new Date(t.created_at).toISOString(),
          viewCount: Number(t.public_metrics?.impression_count ?? 0),
          likeCount: Number(t.public_metrics?.like_count ?? 0),
          commentCount: Number(t.public_metrics?.reply_count ?? 0),
        }));

      return { status: "ok", posts };
    } catch (err) {
      return { status: "error", message: String(err), posts: [] };
    }
  },
};
