# Social Media Analytics Dashboard

A free-to-host dashboard that tracks multiple organizations across **YouTube, TikTok, Instagram, and X (Twitter)**,
showing every post/video published in the **last 7 days** with view/like/comment counts, thumbnails, and
direct links back to the original content.

- **Frontend:** React + Vite + Tailwind CSS → deployed on **Netlify** (free tier)
- **Database/Auth/Backend:** **Supabase** (free tier) — Postgres + Edge Functions
- **Scheduled refresh:** Supabase `pg_cron` (or Netlify Scheduled Function as a fallback) calls an Edge Function
  that fetches fresh data and writes it to a cache table. The frontend **only ever reads from the cache** — it
  never calls third-party APIs directly, so there are no CORS issues and no API keys are ever exposed to the browser.

---

## 1. Why this architecture

Social platforms differ wildly in how "free" their public data is:

| Platform  | Official free API access                              | Used here |
|-----------|---------------------------------------------------------|-----------|
| YouTube   | YouTube Data API v3 — generous free quota, official, stable | **API-based** (real, recommended) |
| X (Twitter) | Free tier API is read-restricted / effectively paid for search | **API-based, optional** — falls back to "unavailable" state with clear messaging |
| TikTok    | No public free API for arbitrary creators' post stats     | **Scraper adapter** (modular, swappable) |
| Instagram | Graph API requires the account to be a Business/Creator account linked to a Facebook Page you administer | **API-based for accounts you own**, scraper adapter otherwise |

Because of this, the data layer is **modular**: every platform is a separate "provider" module implementing the
same interface (`fetchRecentPosts(profileUrl) -> Post[]`). You can swap any provider's implementation (e.g. plug
in a paid scraping service like Apify, Bright Data, RapidAPI, or an official partner API) without touching the
frontend, database schema, or the rest of the pipeline at all.

**This is the most important architectural decision in this project** — it means the dashboard is fully
functional and deployable today using YouTube's real API, with the other three platforms ready to "light up"
the moment you plug in credentials for a scraping/API provider of your choice, with zero refactor.

---

## 2. Project structure

```
social-dashboard/
├── frontend/                      # React + Vite + Tailwind app (deployed to Netlify)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ThemeToggle.jsx
│   │   │   ├── ChannelGroup.jsx
│   │   │   ├── PlatformCard.jsx
│   │   │   ├── PostItem.jsx
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   └── EmptyState.jsx / Skeletons.jsx
│   │   ├── hooks/useChannelGroups.js
│   │   ├── lib/supabaseClient.js
│   │   ├── pages/Home.jsx / Admin.jsx
│   │   ├── App.jsx, main.jsx, index.css
│   ├── index.html, tailwind.config.js, vite.config.js, netlify.toml
│
├── supabase/
│   ├── migrations/0001_init.sql   # full DB schema, RLS policies, seed data
│   └── functions/
│       └── fetch-analytics/       # Deno Edge Function — scheduled data refresh
│           ├── index.ts
│           └── providers/
│               ├── youtube.ts
│               ├── tiktok.ts
│               ├── instagram.ts
│               └── twitter.ts
│
└── netlify/functions/
    └── trigger-refresh.js         # optional: Netlify Scheduled Function fallback trigger
```

---

## 3. Database schema (Supabase / Postgres)

See `supabase/migrations/0001_init.sql`. Summary:

- **`admin_settings`** — single row storing the bcrypt-hashed 4-digit PIN.
- **`channel_groups`** — one row per organization (e.g. "Acme Corp"), with `sort_order` for drag/reorder.
- **`platform_profiles`** — one row per platform per group (`platform`, `profile_url`, `handle`), FK → `channel_groups`.
- **`cached_posts`** — the analytics cache: one row per post/video, FK → `platform_profiles`, with `published_at`,
  `view_count`, `like_count`, `comment_count`, `thumbnail_url`, `permalink`, `fetched_at`.
- **`fetch_logs`** — last fetch status/error per profile, used to show "couldn't reach this account" in the UI.

Row Level Security:
- Public (anon) role: **read-only** on `channel_groups`, `platform_profiles`, `cached_posts`, `fetch_logs`.
- Writes only via the `service_role` key (Edge Functions) or via authenticated admin RPC calls guarded by PIN check.

---

## 4. Admin authentication (PIN-only)

There's no user table and no email/password. A single PIN (default `1234`, **change this immediately**) is stored
bcrypt-hashed in `admin_settings`. On login, the frontend calls the Postgres RPC `verify_admin_pin(pin)`, which
compares against the bcrypt hash server-side and returns true/false — the raw PIN is never stored in the
database and the hash never leaves it. Once verified, the PIN is kept only in `sessionStorage` (cleared when the
tab closes) and is re-sent with every subsequent admin mutation (`admin_upsert_group`, `admin_delete_group`,
`admin_upsert_profile`, `admin_delete_profile`, `admin_reorder_groups`, `admin_set_pin`) — each of these is a
`security definer` RPC that **re-verifies the PIN server-side before doing anything**, so the anon key alone can
never mutate data even if someone inspects network calls; they'd need the correct 4-digit PIN on every request.

---

## 5. Setup instructions

### 5.1 Supabase project
1. Create a free project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. In **Project Settings → API**, copy the `Project URL` and `anon public` key — you'll need these for the frontend `.env`.
4. In **Project Settings → API**, copy the `service_role` key — used **only** inside the Edge Function (never in the frontend).
5. Set the admin PIN: run `select set_admin_pin('1234');` once (then change it from the Admin Panel later).

### 5.2 Deploy the Edge Function
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy fetch-analytics
supabase secrets set YOUTUBE_API_KEY=xxxxx
# Optional, only if you plug these providers in later:
supabase secrets set TIKTOK_PROVIDER_API_KEY=xxxxx
supabase secrets set INSTAGRAM_ACCESS_TOKEN=xxxxx
supabase secrets set TWITTER_BEARER_TOKEN=xxxxx
```

### 5.3 Schedule the refresh (every 30–60 minutes, free)
In the Supabase SQL editor (requires `pg_cron` + `pg_net` extensions, both free and pre-available on Supabase):
```sql
select cron.schedule(
  'refresh-analytics-every-30-min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.functions.supabase.co/fetch-analytics',
    headers := jsonb_build_object('Authorization', 'Bearer <service_role_key>')
  );
  $$
);
```
This costs nothing extra on the free tier and means **the frontend never triggers fetches itself** — it just reads cached rows, so page loads stay fast.

### 5.4 YouTube Data API (free)
1. Go to https://console.cloud.google.com/ → create a project.
2. Enable **YouTube Data API v3**.
3. Create an API key, restrict it to that API.
4. Free quota: 10,000 units/day (a search+stats lookup for one channel costs ~100-150 units, so ~60-90 channel refreshes/day comfortably covers a dashboard refreshed every 30 min for several channels).

### 5.5 TikTok / Instagram / X
These three are intentionally shipped as **modular stub providers** (`supabase/functions/fetch-analytics/providers/*.ts`)
because there is no full-coverage, truly free, ToS-compliant API for arbitrary public creator analytics on these
platforms as of writing:
- **Instagram**: works fully free via the **Instagram Graph API** if the account is a Business/Creator account
  you (the admin) manage and link to a Facebook Page + Meta Developer App. Fill in `INSTAGRAM_ACCESS_TOKEN` and
  the provider will fetch real data. For accounts you don't manage, swap in a third-party scraper API.
- **TikTok**: TikTok's official "Display API" only returns data for accounts that have explicitly authorized
  your app (OAuth), it cannot pull arbitrary public creators. For arbitrary creators, plug in a scraping provider
  (e.g. Apify's TikTok Scraper, RapidAPI TikTok endpoints) — just implement `fetchRecentPosts()` in `tiktok.ts`.
- **X (Twitter)**: the free API tier no longer allows recent-search/timeline reads for arbitrary accounts. Plug
  in the Basic/Pro tier bearer token, or a third-party provider, in `twitter.ts`.

Until configured, these three providers return an empty list with a `status: 'unavailable'` flag, and the UI
shows a clear "Live data not connected — see docs" badge **instead of fake data**.

### 5.6 Frontend `.env`
Create `frontend/.env`:
```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

### 5.7 Local dev
```bash
cd frontend
npm install
npm run dev
```

### 5.8 Deploy to Netlify
1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import from Git**.
3. Base directory: `frontend`. Build command: `npm run build`. Publish directory: `frontend/dist`.
4. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify site settings.
5. Deploy. `netlify.toml` already includes the SPA redirect rule so client-side routing (`/admin`) works.

---

## 6. How "last 7 days" + caching works

- The Edge Function fetches the latest posts per profile, computes `published_at >= now() - interval '7 days'`,
  and upserts into `cached_posts` (keyed by `platform` + `external_id`, so re-running is idempotent).
- It also deletes cached rows older than 7 days so the table stays small and queries stay fast.
- The frontend queries Supabase directly (`select * from cached_posts where profile_id = ... order by published_at desc`)
  — no server round trip beyond Supabase's own (fast, cached at the edge) Postgres REST layer.

---

## 7. Accessibility & SEO notes
- Semantic HTML (`<main>`, `<section>`, `<article>`, `<nav>`), all images have `alt`, all interactive cards are
  real `<a>` tags (keyboard accessible, opens in new tab via `target="_blank" rel="noopener noreferrer"`).
- Color contrast checked for both light/dark themes (Tailwind `slate` palette).
- `<title>` / meta description set per page; dashboard content is server-renderable-friendly (plain data fetch,
  no client-only blocking renders beyond the initial skeleton state).

---

## 8. Extending later
- Add a new platform: create `providers/newplatform.ts` implementing `fetchRecentPosts(profileUrl)`, add it to
  the `PROVIDERS` map in `index.ts`, add an enum value via migration, add a `PlatformCard` icon mapping — done.
- Add unlimited channel groups from the Admin Panel; no code changes needed, the grid is fully data-driven.
