import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitter']

/**
 * Reads everything the dashboard needs in a small number of queries, then
 * assembles it client-side into:
 *   [{ ...group, profiles: { youtube: { profile, posts, status, message }, tiktok: {...}, ... } }]
 *
 * Notice this hook NEVER calls any third-party social API — it only reads
 * from Supabase's cache tables, which are kept fresh by the scheduled
 * Edge Function. That's what keeps page loads fast and avoids hammering
 * rate limits on every visitor.
 */
export function useChannelGroups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: groupRows, error: gErr }, { data: profileRows, error: pErr }] = await Promise.all([
        supabase.from('channel_groups').select('*').order('sort_order', { ascending: true }),
        supabase.from('platform_profiles').select('*').eq('is_active', true),
      ])
      if (gErr) throw gErr
      if (pErr) throw pErr

      const profileIds = (profileRows ?? []).map((p) => p.id)

      let postRows = []
      let logRows = []
      if (profileIds.length > 0) {
        const [{ data: posts, error: postErr }, { data: logs, error: logErr }] = await Promise.all([
          supabase
            .from('cached_posts')
            .select('*')
            .in('profile_id', profileIds)
            .order('published_at', { ascending: false }),
          supabase.from('fetch_logs').select('*').in('profile_id', profileIds),
        ])
        if (postErr) throw postErr
        if (logErr) throw logErr
        postRows = posts ?? []
        logRows = logs ?? []
      }

      const postsByProfile = {}
      for (const post of postRows) {
        if (!postsByProfile[post.profile_id]) postsByProfile[post.profile_id] = []
        postsByProfile[post.profile_id].push(post)
      }
      const logByProfile = {}
      for (const log of logRows) logByProfile[log.profile_id] = log

      const profilesByGroup = {}
      for (const profile of profileRows ?? []) {
        if (!profilesByGroup[profile.group_id]) profilesByGroup[profile.group_id] = {}
        profilesByGroup[profile.group_id][profile.platform] = {
          profile,
          posts: postsByProfile[profile.id] ?? [],
          status: logByProfile[profile.id]?.status ?? 'pending',
          message: logByProfile[profile.id]?.message ?? null,
        }
      }

      const assembled = (groupRows ?? []).map((group) => {
        const platforms = {}
        for (const platform of PLATFORMS) {
          platforms[platform] = profilesByGroup[group.id]?.[platform] ?? null
        }
        return { ...group, platforms }
      })

      setGroups(assembled)
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { groups, loading, error, reload: load }
}

export { PLATFORMS }
