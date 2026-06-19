// Instagram provider — works via the Instagram Graph API for Business/Creator accounts
// that you (the admin) manage and have linked to a Meta Developer App + Facebook Page.
// Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
//
// For arbitrary public accounts you don't manage, Meta does NOT offer a free public API.
// Swap this implementation for a third-party scraping provider (Apify, RapidAPI, Bright Data)
// by editing fetchRecentPosts() below — the rest of the system is unaffected.

import type { Provider, ProviderResult, NormalizedPost } from "./types.ts";

const ACCESS_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";
const IG_USER_ID = Deno.env.get("INSTAGRAM_BUSINESS_USER_ID") ?? ""; // the Business Account ID (not the username)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const instagramProvider: Provider = {
  async fetchRecentPosts(_profileUrl: string): Promise<ProviderResult> {
    if (!ACCESS_TOKEN || !IG_USER_ID) {
      return {
        status: "unavailable",
        message:
          "Instagram Graph API not configured. Requires a Business/Creator account + Meta app token. See README §5.5.",
        posts: [],
      };
    }

    try {
      const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${IG_USER_ID}/media?fields=${fields}&access_token=${ACCESS_TOKEN}`
      );
      const json = await res.json();
      if (json.error) {
        return { status: "error", message: json.error.message, posts: [] };
      }

      const cutoff = Date.now() - SEVEN_DAYS_MS;
      const posts: NormalizedPost[] = (json.data ?? [])
        .filter((m: any) => new Date(m.timestamp).getTime() >= cutoff)
        .map((m: any) => ({
          externalId: m.id,
          title: (m.caption ?? "").slice(0, 300),
          permalink: m.permalink,
          thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
          publishedAt: new Date(m.timestamp).toISOString(),
          viewCount: 0, // Graph API doesn't expose view/impression counts for basic media fields
          likeCount: Number(m.like_count ?? 0),
          commentCount: Number(m.comments_count ?? 0),
        }));

      return { status: "ok", posts };
    } catch (err) {
      return { status: "error", message: String(err), posts: [] };
    }
  },
};
