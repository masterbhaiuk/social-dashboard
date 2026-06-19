// Shared contract every platform provider must implement.
// This is the ONLY interface the rest of the system depends on —
// swap any provider's internals freely without touching anything else.

export interface NormalizedPost {
  externalId: string;       // platform-native post/video id
  title: string;             // title or caption (truncate to ~300 chars upstream)
  permalink: string;         // URL back to the original post
  thumbnailUrl: string | null;
  publishedAt: string;       // ISO timestamp
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export type ProviderStatus = "ok" | "error" | "unavailable";

export interface ProviderResult {
  status: ProviderStatus;
  message?: string;
  posts: NormalizedPost[];
}

export interface Provider {
  /** Fetch posts/videos published in the last 7 days for the given profile URL. */
  fetchRecentPosts(profileUrl: string): Promise<ProviderResult>;
}
