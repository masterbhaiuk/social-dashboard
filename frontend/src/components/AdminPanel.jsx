import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { PLATFORM_ORDER, PLATFORM_META } from '../lib/platformMeta'

const emptyGroupForm = { id: null, name: '', description: '' }

export default function AdminPanel() {
  const { pin } = useAdminAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [savingGroup, setSavingGroup] = useState(false)
  const [profileDrafts, setProfileDrafts] = useState({}) // { groupId: { platform: url } }
  const [pinForm, setPinForm] = useState({ old: '', next: '' })

  const showToast = (message, kind = 'success') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 3500)
  }

  const loadGroups = async () => {
    setLoading(true)
    const { data: groupRows } = await supabase.from('channel_groups').select('*').order('sort_order')
    const { data: profileRows } = await supabase.from('platform_profiles').select('*')

    const drafts = {}
    const assembled = (groupRows ?? []).map((g) => {
      const profiles = (profileRows ?? []).filter((p) => p.group_id === g.id)
      drafts[g.id] = {}
      for (const platform of PLATFORM_ORDER) {
        drafts[g.id][platform] = profiles.find((p) => p.platform === platform)?.profile_url ?? ''
      }
      return { ...g, profiles }
    })

    setGroups(assembled)
    setProfileDrafts(drafts)
    setLoading(false)
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const handleSaveGroup = async (e) => {
    e.preventDefault()
    if (!groupForm.name.trim()) {
      showToast('Channel group name is required.', 'error')
      return
    }
    setSavingGroup(true)
    const { error } = await supabase.rpc('admin_upsert_group', {
      p_pin: pin,
      p_id: groupForm.id,
      p_name: groupForm.name.trim(),
      p_description: groupForm.description?.trim() || null,
      p_sort_order: groups.length,
    })
    setSavingGroup(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast(groupForm.id ? 'Channel group updated.' : 'Channel group added.')
    setGroupForm(emptyGroupForm)
    loadGroups()
  }

  const handleDeleteGroup = async (id) => {
    if (!confirm('Delete this channel group and all its linked platform profiles? This cannot be undone.')) return
    const { error } = await supabase.rpc('admin_delete_group', { p_pin: pin, p_id: id })
    if (error) return showToast(error.message, 'error')
    showToast('Channel group deleted.')
    loadGroups()
  }

  const handleSaveProfile = async (groupId, platform) => {
    const url = profileDrafts[groupId]?.[platform]?.trim()
    if (!url) {
      showToast('Enter a profile URL before saving.', 'error')
      return
    }
    const { error } = await supabase.rpc('admin_upsert_profile', {
      p_pin: pin,
      p_group_id: groupId,
      p_platform: platform,
      p_profile_url: url,
      p_handle: extractHandle(url),
    })
    if (error) return showToast(error.message, 'error')
    showToast(`${PLATFORM_META[platform].label} profile saved.`)
    loadGroups()
  }

  const handleClearProfile = async (groupId, platform) => {
    const existing = groups.find((g) => g.id === groupId)?.profiles.find((p) => p.platform === platform)
    if (!existing) return
    if (!confirm(`Remove the ${PLATFORM_META[platform].label} profile for this group?`)) return
    const { error } = await supabase.rpc('admin_delete_profile', { p_pin: pin, p_id: existing.id })
    if (error) return showToast(error.message, 'error')
    setProfileDrafts((prev) => ({ ...prev, [groupId]: { ...prev[groupId], [platform]: '' } }))
    showToast('Profile removed.')
    loadGroups()
  }

  const moveGroup = async (index, direction) => {
    const next = [...groups]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= next.length) return
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    setGroups(next)
    const { error } = await supabase.rpc('admin_reorder_groups', { p_pin: pin, p_ids: next.map((g) => g.id) })
    if (error) showToast(error.message, 'error')
  }

  const handleChangePin = async (e) => {
    e.preventDefault()
    if (!/^[0-9]{4}$/.test(pinForm.next)) {
      showToast('New PIN must be exactly 4 digits.', 'error')
      return
    }
    if (pinForm.old !== pin) {
      showToast('Current PIN is incorrect.', 'error')
      return
    }
    const { error } = await supabase.rpc('admin_set_pin', { p_old_pin: pinForm.old, p_new_pin: pinForm.next })
    if (error) return showToast(error.message, 'error')
    showToast('PIN updated. Use the new PIN next time you log in.')
    setPinForm({ old: '', next: '' })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Manage channel groups and link platform profile URLs. Analytics refresh automatically — never enter stats manually.
      </p>

      {toast && (
        <div
          role="status"
          className={`mt-4 rounded-xl px-4 py-2.5 text-sm ${
            toast.kind === 'error'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Add / edit channel group */}
      <section className="card-surface mt-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {groupForm.id ? 'Edit channel group' : 'Add a new channel group'}
        </h2>
        <form onSubmit={handleSaveGroup} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Group name (e.g. Acme Corp)"
            value={groupForm.name}
            onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={groupForm.description}
            onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={savingGroup}
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {savingGroup ? 'Saving…' : groupForm.id ? 'Save changes' : 'Add group'}
            </button>
            {groupForm.id && (
              <button
                type="button"
                onClick={() => setGroupForm(emptyGroupForm)}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium dark:border-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Existing groups */}
      <section className="mt-8 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-400">Loading channel groups…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-400">No channel groups yet. Add one above.</p>
        ) : (
          groups.map((group, index) => (
            <div key={group.id} className="card-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      aria-label="Move up"
                      onClick={() => moveGroup(index, -1)}
                      disabled={index === 0}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                    >
                      ▲
                    </button>
                    <button
                      aria-label="Move down"
                      onClick={() => moveGroup(index, 1)}
                      disabled={index === groups.length - 1}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                    >
                      ▼
                    </button>
                  </div>
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    {group.description && <p className="text-xs text-slate-500">{group.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGroupForm({ id: group.id, name: group.name, description: group.description ?? '' })}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium dark:border-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="rounded-full border border-rose-300 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PLATFORM_ORDER.map((platform) => (
                  <div key={platform} className="flex items-center gap-2">
                    <span
                      className="w-20 flex-shrink-0 text-xs font-medium"
                      style={{ color: PLATFORM_META[platform].accent }}
                    >
                      {PLATFORM_META[platform].label}
                    </span>
                    <input
                      type="url"
                      placeholder={`https://${platform === 'twitter' ? 'x.com' : platform + '.com'}/@account`}
                      value={profileDrafts[group.id]?.[platform] ?? ''}
                      onChange={(e) =>
                        setProfileDrafts((prev) => ({
                          ...prev,
                          [group.id]: { ...prev[group.id], [platform]: e.target.value },
                        }))
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                    <button
                      onClick={() => handleSaveProfile(group.id, platform)}
                      className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleClearProfile(group.id, platform)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Change PIN */}
      <section className="card-surface mt-8 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Change admin PIN</h2>
        <form onSubmit={handleChangePin} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Current PIN"
            value={pinForm.old}
            onChange={(e) => setPinForm((f) => ({ ...f, old: e.target.value }))}
            className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="New PIN"
            value={pinForm.next}
            onChange={(e) => setPinForm((f) => ({ ...f, next: e.target.value }))}
            className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            Update PIN
          </button>
        </form>
      </section>
    </div>
  )
}

function extractHandle(url) {
  try {
    const path = new URL(url).pathname.replace(/^\//, '').replace(/\/+$/, '')
    return path.replace(/^@/, '').split('/')[0] || null
  } catch {
    return null
  }
}
