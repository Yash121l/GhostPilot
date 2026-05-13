import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { Target, Plus, Trash2, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Intent, KeyResult } from '@shared/types/intent'

function ProgressRing({ pct }: { pct: number }): ReactElement {
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={44} height={44} className="shrink-0">
      <circle cx={22} cy={22} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={3} />
      <circle
        cx={22} cy={22} r={r}
        fill="none"
        stroke={pct >= 100 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-brand-primary)' : 'var(--color-warning)'}
        strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)' }}
      />
      <text x={22} y={22} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={9} fontWeight={700}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  )
}

function KRRow({ kr }: { kr: KeyResult }): ReactElement {
  const pct = Math.min(100, kr.target > 0 ? (kr.current / kr.target) * 100 : 0)
  return (
    <div className="pl-4 py-3 border-l border-[var(--color-border-subtle)] ml-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--color-text-secondary)] font-medium">{kr.title}</span>
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          {kr.current} / {kr.target} {kr.unit}
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-brand-primary)' : 'var(--color-warning)',
          }}
        />
      </div>
      <div className="flex gap-4 mt-2">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {kr.weeklyQuota.postsPerWeek} posts/week
        </span>
        {Object.entries(kr.weeklyQuota.breakdown).map(([platform, count]) => (
          <span key={platform} className="text-[10px] text-[var(--color-text-muted)] capitalize">
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

  const avgPct = intent.keyResults.length > 0
    ? intent.keyResults.reduce((sum, kr) => sum + Math.min(100, kr.target > 0 ? (kr.current / kr.target) * 100 : 0), 0) / intent.keyResults.length
    : 0

  const handleDelete = async (): Promise<void> => {
    setDeleting(true)
    await ipc.invoke(IPC_CHANNELS.INTENT_DELETE, { id: intent.id })
    onDelete()
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden group">
      <div
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <ProgressRing pct={avgPct} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90 truncate">{intent.title}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {intent.horizon} · {intent.keyResults.length} key result{intent.keyResults.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); handleDelete() }}
          disabled={deleting}
          className="btn btn-ghost btn-icon opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-error)' }}
        >
          {deleting
            ? <Loader2 size={13} className="animate-spin" />
            : <Trash2 size={13} />}
        </button>
        {expanded
          ? <ChevronDown size={14} className="text-[var(--color-text-muted)] shrink-0" />
          : <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0" />}
      </div>

      {expanded && intent.keyResults.length > 0 && (
        <div className="px-4 pb-4 space-y-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <div className="pt-3 space-y-1">
            {intent.keyResults.map((kr) => <KRRow key={kr.id} kr={kr} />)}
          </div>
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
    if (!personaId) { setError('Create a persona first in the Personas page'); return }

    setCreating(true)
    setError(null)
    const res = await ipc.invoke(IPC_CHANNELS.INTENT_CREATE, {
      personaId,
      title: title.trim(),
      description: description.trim(),
      horizon: horizon.trim(),
    })
    setCreating(false)
    if (res.ok) onCreated(res.value)
    else setError(res.error.message)
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'hsla(265,89%,65%,0.15)' }}
        >
          <Target size={16} className="text-[var(--color-brand-primary)]" />
        </div>
        <h3 className="text-sm font-semibold text-white/90">New Goal</h3>
      </div>

      <div>
        <label className="form-label">What do you want to achieve? *</label>
        <input
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Grow LinkedIn followers from 1K to 5K"
          autoFocus
        />
      </div>

      <div>
        <label className="form-label">Context (optional)</label>
        <textarea
          className="form-input resize-none"
          style={{ height: 72 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why this goal matters — AI uses this context to plan your content…"
        />
      </div>

      <div>
        <label className="form-label">Horizon</label>
        <input
          className="form-input"
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
          placeholder="Q3 2025"
        />
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl"
          style={{ color: 'var(--color-error)', background: 'hsla(0,84%,60%,0.08)', border: '1px solid hsla(0,84%,60%,0.2)' }}
        >
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={creating} className="btn btn-primary">
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
          {creating ? 'AI is planning…' : 'Create Goal'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
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
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">AI breaks your north-star into a weekly posting plan</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn btn-secondary btn-sm">
            <Plus size={13} />
            New Goal
          </button>
        )}
      </div>

      <div className="page-body space-y-5 max-w-xl">
        {creating && (
          <CreateIntentForm
            personaId={personaId}
            onCreated={(i) => { setIntents((prev) => [i, ...prev]); setCreating(false) }}
            onCancel={() => setCreating(false)}
          />
        )}

        {loading ? (
          <div className="empty-state">
            <Loader2 size={22} className="animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : intents.length === 0 && !creating ? (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <Target size={24} />
            </div>
            <p className="empty-title">No goals yet</p>
            <p className="empty-text">
              Tell GhostPilot what you want to achieve — AI decomposes it into measurable key results and weekly quotas.
            </p>
            <button onClick={() => setCreating(true)} className="btn btn-primary">
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
