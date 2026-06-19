// Supabase Edge Function: fetch-analytics
//
// Triggered on a schedule (pg_cron, see README §5.3) — or manually via POST for testing.
// For every active platform_profile in the database:
//   1. Calls the matching provider's fetchRecentPosts()
//   2. Upserts results into cached_posts (idempotent on platform+external_id)
//   3. Records fetch status into fetch_logs (so the UI can show error/unavailable states)
// Finally purges any cached posts older than 7 days.
//
// Deploy: supabase functions deploy fetch-analytics
// Secrets needed: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase),
//                 YOUTUBE_API_KEY, and optionally INSTAGRAM_ACCESS_TOKEN,
//                 INSTAGRAM_BUSINESS_USER_ID, TIKTOK_PROVIDER_API_KEY, TWITTER_BEARER_TOKEN.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Provider } from "./providers/types.ts";
import { youtubeProvider } from "./providers/youtube.ts";
import { tiktokProvider } from "./providers/tiktok.ts";
import { instagramProvider } from "./providers/instagram.ts";
import { twitterProvider } from "./providers/twitter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Modular provider registry — add a new platform by adding one line here.
const PROVIDERS: Record<string, Provider> = {
  youtube: youtubeProvider,
  tiktok: tiktokProvider,
  instagram: instagramProvider,
  twitter: twitterProvider,
};

Deno.serve(async (req: Request) => {
  // Simple shared-secret check so randos can't trigger refreshes / burn your API quota.
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { data: profiles, error } = await supabase
    .from("platform_profiles")
    .select("id, platform, profile_url")
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const profile of profiles ?? []) {
    const provider = PROVIDERS[profile.platform];
    if (!provider) {
      results.push({ profile: profile.id, status: "error", message: "No provider registered" });
      continue;
    }

    let outcome;
    try {
      outcome = await provider.fetchRecentPosts(profile.profile_url);
    } catch (err) {
      outcome = { status: "error" as const, message: String(err), posts: [] };
    }

    // Log fetch status regardless of outcome (drives "couldn't reach this account" UI)
    await supabase.from("fetch_logs").upsert({
      profile_id: profile.id,
      status: outcome.status,
      message: outcome.message ?? null,
      last_attempt_at: new Date().toISOString(),
    });

    if (outcome.status === "ok" && outcome.posts.length > 0) {
      const rows = outcome.posts.map((p) => ({
        profile_id: profile.id,
        platform: profile.platform,
        external_id: p.externalId,
        title: p.title,
        permalink: p.permalink,
        thumbnail_url: p.thumbnailUrl,
        published_at: p.publishedAt,
        view_count: p.viewCount,
        like_count: p.likeCount,
        comment_count: p.commentCount,
        fetched_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from("cached_posts")
        .upsert(rows, { onConflict: "platform,external_id" });

      if (upsertError) {
        results.push({ profile: profile.id, status: "db_error", message: upsertError.message });
        continue;
      }
    }

    results.push({ profile: profile.id, platform: profile.platform, status: outcome.status, count: outcome.posts.length });
  }

  // Keep the cache table lean — drop anything older than 7 days.
  await supabase.rpc("purge_old_posts");

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
