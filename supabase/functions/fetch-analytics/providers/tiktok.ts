// TikTok provider — modular stub.
//
// TikTok's official "Display API" only returns data for accounts that have explicitly
// completed OAuth with your app; there is no free official way to pull arbitrary public
// creators' post stats. To enable real data here, plug in a third-party provider such as:
//   - Apify's TikTok Scraper actor (has a free tier)
//   - A RapidAPI TikTok endpoint
//   - Bright Data's TikTok dataset API
//
// Implementation pattern (example using a generic REST scraping provider):
//
//   const API_KEY = Deno.env.get("TIKTOK_PROVIDER_API_KEY") ?? "";
//   const res = await fetch(`https://api.yourscraper.com/tiktok/user-videos?handle=${handle}`, {
//     headers: { Authorization: `Bearer ${API_KEY}` },
//   });
//   ... map response fields into NormalizedPost[] ...
//
// Until configured, this returns "unavailable" so the UI shows an honest status badge
// instead of fabricated data.

import type { Provider, ProviderResult } from "./types.ts";

const API_KEY = Deno.env.get("TIKTOK_PROVIDER_API_KEY") ?? "";

function extractHandle(profileUrl: string): string | null {
  try {
    const path = new URL(profileUrl).pathname;
    const match = path.match(/@([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export const tiktokProvider: Provider = {
  async fetchRecentPosts(profileUrl: string): Promise<ProviderResult> {
    const handle = extractHandle(profileUrl);

    if (!API_KEY) {
      return {
        status: "unavailable",
        message:
          "No TikTok data provider configured. Plug a scraping/API provider into providers/tiktok.ts (see comments). See README §5.5.",
        posts: [],
      };
    }

    // --- Example integration shape (commented out — wire up your chosen provider) ---
    // const res = await fetch(`https://api.yourscraper.com/tiktok/user-videos?handle=${handle}`, {
    //   headers: { Authorization: `Bearer ${API_KEY}` },
    // });
    // const json = await res.json();
    // const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // const posts = json.videos
    //   .filter((v) => new Date(v.createTime * 1000).getTime() >= cutoff)
    //   .map((v) => ({
    //     externalId: v.id,
    //     title: v.desc,
    //     permalink: `https://www.tiktok.com/@${handle}/video/${v.id}`,
    //     thumbnailUrl: v.cover,
    //     publishedAt: new Date(v.createTime * 1000).toISOString(),
    //     viewCount: v.stats.playCount,
    //     likeCount: v.stats.diggCount,
    //     commentCount: v.stats.commentCount,
    //   }));
    // return { status: "ok", posts };

    return { status: "unavailable", message: `Provider not implemented for handle @${handle}`, posts: [] };
  },
};
