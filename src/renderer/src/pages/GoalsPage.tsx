import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { Target, Plus, Trash2, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Intent, KeyResult } from '@shared/types/intent'

function ProgressBar({ current, target }: { current: number; target: number }): ReactElement {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0)
  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: pct >= 100 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-brand-primary)' : 'var(--color-warning)',
        }}
      />
    </div>
  )
}

function KRRow({ kr }: { kr: KeyResult }): ReactElement {
  return (
    <div className="ml-6 border-l border-[var(--color-border-subtle)] pl-4 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[var(--color-text-secondary)]">{kr.title}</span>
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          {kr.current}/{kr.target} {kr.unit}
        </span>
      </div>
      <ProgressBar current={kr.current} target={kr.target} />
      <div className="flex gap-3 mt-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {kr.weeklyQuota.postsPerWeek} posts/week
        </span>
        {Object.entries(kr.weeklyQuota.breakdown).map(([platform, count]) => (
          <span key={platform} className="text-[10px] text-[var(--color-text-muted)]">
            {platform}: {count}
          </span>
        ))}
      </div>
    </div>
  )
}

function IntentCard({ intent, onDelete }: { intent: Intent; onDelete: () => void }): ReactElement {
  const [expanded, setExpanded] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (): Promise<void> => {
    setDeleting(true)
    await ipc.invoke(IPC_CHANNELS.INTENT_DELETE, { id: intent.id })
    onDelete()
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'hsla(265,89%,65%,0.15)' }}>
          <Target size={14} className="text-[var(--color-brand-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90 truncate">{intent.title}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{intent.horizon} · {intent.keyResults.length} key results</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete() }}
          disabled={deleting}
          className="p-1.5 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          {deleting
            ? <Loader2 size={12} className="animate-spin text-[var(--color-error)]" />
            : <Trash2 size={12} className="text-[var(--color-error)]" />
          }
        </button>
        {expanded ? <ChevronDown size={14} className="text-[var(--color-text-muted)]" /> : <ChevronRight size={14} className="text-[var(--color-text-muted)]" />}
      </div>

      {expanded && intent.keyResults.length > 0 && (
        <div className="px-4 pb-4 space-y-1">
          {intent.keyResults.map((kr) => <KRRow key={kr.id} kr={kr} />)}
        </div>
      )}
    </div>
  )
}

function CreateIntentForm({
  personaId,
  onCreated,
  onCancel,
}: {
  personaId: string
  onCreated: (i: Intent) => void
  onCancel: () => void
}): ReactElement {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [horizon, setHorizon] = useState('Q3 2025')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!personaId) { setError('Create a persona first'); return }

    setCreating(true)
    setError(null)

    const res = await ipc.invoke(IPC_CHANNELS.INTENT_CREATE, {
      personaId,
      title: title.trim(),
      description: description.trim(),
      horizon: horizon.trim(),
    })

    setCreating(false)
    if (res.ok) {
      onCreated(res.value)
    } else {
      setError(res.error.message)
    }
  }

  const inputClass = 'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors'

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 rounded-2xl space-y-4">
      <h3 className="text-sm font-semibold text-white/90">New Goal</h3>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">What do you want to achieve? *</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grow LinkedIn followers from 1K to 5K" />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Why (optional)</label>
        <textarea className={`${inputClass} resize-none h-16`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Context that helps AI break it into actionable steps..." />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Horizon</label>
        <input className={inputClass} value={horizon} onChange={(e) => setHorizon(e.target.value)} placeholder="Q3 2025" />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[var(--color-error)] text-xs">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={creating} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'hsla(265,89%,65%,0.9)' }}>
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
          {creating ? 'Decomposing with AI…' : 'Create Goal'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:bg-white/5">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function GoalsPage(): ReactElement {
  const [intents, setIntents] = useState<Intent[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [personaId, setPersonaId] = useState('')

  const load = async (): Promise<void> => {
    setLoading(true)
    const [intentsRes, personasRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.INTENT_LIST, {}),
      ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {}),
    ])
    if (intentsRes.ok) setIntents(intentsRes.value)
    if (personasRes.ok && personasRes.value.length > 0) setPersonaId(personasRes.value[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col h-full animate-slide-up">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-base font-semibold text-white/90">Goals</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">AI breaks your north-star into weekly content quotas</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: 'hsla(265,89%,65%,0.15)', color: 'var(--color-brand-primary)' }}>
            <Plus size={12} />
            New Goal
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {creating && (
          <CreateIntentForm
            personaId={personaId}
            onCreated={(i) => { setIntents((prev) => [i, ...prev]); setCreating(false) }}
            onCancel={() => setCreating(false)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : intents.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Target size={32} className="text-[var(--color-text-muted)] mb-4" />
            <p className="text-sm font-medium text-white/70 mb-1">No goals yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-xs">
              Tell GhostPilot what you want to achieve and AI will decompose it into a weekly posting plan.
            </p>
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'hsla(265,89%,65%,0.9)' }}>
              <Plus size={14} />
              Set your first goal
            </button>
          </div>
        ) : (
          intents.map((intent) => (
            <IntentCard
              key={intent.id}
              intent={intent}
              onDelete={() => setIntents((prev) => prev.filter((i) => i.id !== intent.id))}
            />
          ))
        )}
      </div>
    </div>
  )
}
