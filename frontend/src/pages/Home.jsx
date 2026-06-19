import { useChannelGroups } from '../hooks/useChannelGroups'
import ChannelGroup from '../components/ChannelGroup'

export default function Home() {
  const { groups, loading, error, reload } = useChannelGroups()

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Social Pulse</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Everything published across YouTube, TikTok, Instagram, and X in the last 7 days — refreshed automatically.
          </p>
        </div>
        <button
          onClick={reload}
          className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Refresh view
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
          Couldn't load dashboard data: {error}
        </div>
      )}

      {!loading && !error && groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500">
            No channel groups yet. Log in as admin to add your first organization.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(loading ? placeholderGroups : groups).map((group) => (
            <ChannelGroup key={group.id} group={group} loading={loading} />
          ))}
        </div>
      )}
    </main>
  )
}

// Lightweight skeleton groups so the layout doesn't jump while real data loads.
const placeholderGroups = Array.from({ length: 4 }).map((_, i) => ({
  id: `placeholder-${i}`,
  name: 'Loading…',
  description: '',
  platforms: { youtube: null, tiktok: null, instagram: null, twitter: null },
}))
