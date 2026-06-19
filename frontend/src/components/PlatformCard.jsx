import { PLATFORM_META } from '../lib/platformMeta'
import PostItem from './PostItem'

function StatusBadge({ status }) {
  const styles = {
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    error: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    unavailable: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }
  const labels = {
    ok: 'Live',
    error: 'Error',
    unavailable: 'Not connected',
    pending: 'Pending',
  }
  return <span className={`badge ${styles[status] ?? styles.pending}`}>{labels[status] ?? 'Pending'}</span>
}

function SkeletonRows() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-16 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-3/5 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * One platform's card within a channel group: header (icon, label, status)
 * + scrollable list of this platform's last-7-days posts.
 */
export default function PlatformCard({ platform, data, loading }) {
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const profile = data?.profile
  const posts = data?.posts ?? []
  const status = data?.status ?? 'pending'

  return (
    <div className="card-surface flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: meta.accentSoft, color: meta.accent }}
          >
            <Icon className="h-4 w-4" style={{ width: 18, height: 18 }} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{meta.label}</p>
            {profile ? (
              <a
                href={profile.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {profile.handle ? `@${profile.handle.replace(/^@/, '')}` : 'View profile'}
              </a>
            ) : (
              <p className="text-xs text-slate-400">Not configured</p>
            )}
          </div>
        </div>
        {profile && <StatusBadge status={loading ? 'pending' : status} />}
      </div>

      <div className="post-scroll flex-1 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 340 }}>
        {loading ? (
          <SkeletonRows />
        ) : !profile ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No {meta.label} profile linked for this channel yet.
          </p>
        ) : status === 'unavailable' ? (
          <div className="py-6 text-center text-xs text-amber-600 dark:text-amber-400">
            <p className="font-medium">Live data not connected</p>
            <p className="mt-1 text-slate-400">{data?.message || 'See README for setup instructions.'}</p>
          </div>
        ) : status === 'error' ? (
          <div className="py-6 text-center text-xs text-rose-600 dark:text-rose-400">
            <p className="font-medium">Couldn't reach this account</p>
            <p className="mt-1 text-slate-400">{data?.message || 'Will retry on next scheduled refresh.'}</p>
          </div>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No content published in the last 7 days.</p>
        ) : (
          posts.map((post) => <PostItem key={post.id} post={post} accent={meta.accent} />)
        )}
      </div>
    </div>
  )
}
