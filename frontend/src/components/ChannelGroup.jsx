import { PLATFORM_ORDER } from '../lib/platformMeta'
import PlatformCard from './PlatformCard'

export default function ChannelGroup({ group, loading }) {
  return (
    <section
      aria-labelledby={`group-${group.id}`}
      className="rounded-3xl border border-slate-200 bg-slate-100/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-3">
        {group.logo_url ? (
          <img src={group.logo_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
            {group.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div>
          <h2 id={`group-${group.id}`} className="text-lg font-semibold tracking-tight">
            {group.name}
          </h2>
          {group.description && <p className="text-sm text-slate-500 dark:text-slate-400">{group.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLATFORM_ORDER.map((platform) => (
          <PlatformCard key={platform} platform={platform} data={group.platforms[platform]} loading={loading} />
        ))}
      </div>
    </section>
  )
}
