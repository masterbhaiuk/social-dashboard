// YouTube provider — fully functional via the official YouTube Data API v3 (free quota).
// Docs: https://developers.google.com/youtube/v3/docs

import type { Provider, ProviderResult, NormalizedPost } from "./types.ts";

const API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function extractHandleOrId(profileUrl: string): { handle?: string; channelId?: string } {
  const url = new URL(profileUrl);
  const path = url.pathname.replace(/\/+$/, "");
  // formats: /@handle  |  /channel/UC...  |  /c/CustomName  |  /user/Username
  const handleMatch = path.match(/\/@([^/]+)/);
  if (handleMatch) return { handle: handleMatch[1] };
  const channelMatch = path.match(/\/channel\/([^/]+)/);
  if (channelMatch) return { channelId: channelMatch[1] };
  const fallback = path.replace(/^\/(c|user)\//, "");
  return { handle: fallback || undefined };
}

async function resolveChannelId(profileUrl: string): Promise<string | null> {
  const { handle, channelId } = extractHandleOrId(profileUrl);
  if (channelId) return channelId;
  if (!handle) return null;

  // The "forHandle" param resolves @handles directly (supported by the Data API).
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${API_KEY}`
  );
  const json = await res.json();
  return json.items?.[0]?.id ?? null;
}

export const youtubeProvider: Provider = {
  async fetchRecentPosts(profileUrl: string): Promise<ProviderResult> {
    if (!API_KEY) {
      return { status: "unavailable", message: "YOUTUBE_API_KEY not configured", posts: [] };
    }

    try {
      const channelId = await resolveChannelId(profileUrl);
      if (!channelId) {
        return { status: "error", message: "Could not resolve channel from URL", posts: [] };
      }

      // 1. Get the channel's "uploads" playlist id
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
      );
      const chJson = await chRes.json();
      const uploadsPlaylistId = chJson.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        return { status: "error", message: "Channel has no uploads playlist", posts: [] };
      }

      // 2. List recent uploads (most recent first by default)
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=25&key=${API_KEY}`
      );
      const plJson = await plRes.json();
      const items = (plJson.items ?? []) as any[];

      const cutoff = Date.now() - SEVEN_DAYS_MS;
      const recent = items.filter((it) => {
        const published = new Date(it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt).getTime();
        return published >= cutoff;
      });

      if (recent.length === 0) {
        return { status: "ok", posts: [] };
      }

      // 3. Batch-fetch statistics for the recent video ids
      const videoIds = recent.map((it) => it.contentDetails.videoId).join(",");
      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${API_KEY}`
      );
      const statsJson = await statsRes.json();
      const statsById: Record<string, any> = {};
      for (const v of statsJson.items ?? []) statsById[v.id] = v;

      const posts: NormalizedPost[] = recent.map((it) => {
        const vid = it.contentDetails.videoId;
        const stats = statsById[vid]?.statistics ?? {};
        const snippet = it.snippet;
        return {
          externalId: vid,
          title: snippet.title,
          permalink: `https://www.youtube.com/watch?v=${vid}`,
          thumbnailUrl:
            snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null,
          publishedAt: new Date(it.contentDetails.videoPublishedAt ?? snippet.publishedAt).toISOString(),
          viewCount: Number(stats.viewCount ?? 0),
          likeCount: Number(stats.likeCount ?? 0),
          commentCount: Number(stats.commentCount ?? 0),
        };
      });

      return { status: "ok", posts };
    } catch (err) {
      return { status: "error", message: String(err), posts: [] };
    }
  },
};
