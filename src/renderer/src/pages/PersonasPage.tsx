import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { UserCircle2, Plus, Save, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Persona } from '@shared/types/persona'

const AVATAR_COLORS = [
  'hsl(265,89%,65%)', 'hsl(190,90%,55%)', 'hsl(330,85%,65%)',
  'hsl(38,92%,55%)', 'hsl(142,71%,45%)', 'hsl(200,80%,55%)',
]

function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 36 }: { name: string; size?: number }): ReactElement {
  const color = avatarColor(name)
  return (
    <div
      className="rounded-xl flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        background: `${color}20`,
        border: `1.5px solid ${color}40`,
        color,
        fontSize: size * 0.4,
        borderRadius: size * 0.28,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function PersonaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Persona
  onSave: (p: Persona) => void
  onCancel: () => void
}): ReactElement {
  const [name, setName] = useState(initial?.name ?? '')
  const [bio, setBio] = useState(initial?.bio ?? '')
  const [pillars, setPillars] = useState((initial?.pillars ?? []).join(', '))
  const [styleHints, setStyleHints] = useState(initial?.styleHints ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)

    const payload = {
      name: name.trim(),
      bio: bio.trim(),
      pillars: pillars.split(',').map((s) => s.trim()).filter(Boolean),
      styleHints: styleHints.trim(),
    }

    const res = initial
      ? await ipc.invoke(IPC_CHANNELS.PERSONA_UPDATE, { id: initial.id, ...payload })
      : await ipc.invoke(IPC_CHANNELS.PERSONA_CREATE, payload)

    setSaving(false)
    if (res.ok) onSave(res.value)
    else setError(res.error.message)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="form-label">Name *</label>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Yash — Tech Founder"
          autoFocus={!initial}
        />
      </div>

      <div>
        <label className="form-label">Bio</label>
        <textarea
          className="form-input resize-none"
          style={{ height: 80 }}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short bio — AI uses this as context when writing in your voice…"
        />
      </div>

      <div>
        <label className="form-label">Content Pillars</label>
        <input
          className="form-input"
          value={pillars}
          onChange={(e) => setPillars(e.target.value)}
          placeholder="AI, indie hacking, product building"
        />
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">Comma-separated topics you consistently post about</p>
      </div>

      <div>
        <label className="form-label">Style Hints</label>
        <textarea
          className="form-input resize-none"
          style={{ height: 64 }}
          value={styleHints}
          onChange={(e) => setStyleHints(e.target.value)}
          placeholder="Casual and direct, use short sentences, avoid corporate jargon…"
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
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial ? 'Update Persona' : 'Create Persona'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function PersonasPage(): ReactElement {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Persona | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    const res = await ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {})
    if (res.ok) setPersonas(res.value)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string): Promise<void> => {
    setDeleteId(id)
    const res = await ipc.invoke(IPC_CHANNELS.PERSONA_DELETE, { id })
    setDeleteId(null)
    if (res.ok) {
      setPersonas((prev) => prev.filter((p) => p.id !== id))
      if (selected?.id === id) setSelected(null)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: persona list */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{ width: 260, borderRight: '1px solid var(--color-border-subtle)' }}
      >
        <div className="page-header" style={{ padding: '14px 16px 12px' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: 15 }}>Personas</h1>
          </div>
          <button
            onClick={() => { setCreating(true); setSelected(null) }}
            className="btn btn-ghost btn-icon"
            title="New persona"
          >
            <Plus size={15} className="text-[var(--color-brand-primary)]" />
          </button>
        </div>

        {loading ? (
          <div className="empty-state flex-1">
            <Loader2 size={18} className="animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : personas.length === 0 ? (
          <div className="empty-state flex-1">
            <UserCircle2 size={24} className="text-[var(--color-text-muted)] mb-3" />
            <p className="empty-text" style={{ marginBottom: 12 }}>No personas yet</p>
            <button onClick={() => setCreating(true)} className="btn btn-secondary btn-sm">
              <Plus size={12} />
              Create one
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {personas.map((p) => {
              const isSelected = selected?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setCreating(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected ? 'hsla(265,89%,65%,0.1)' : 'transparent',
                    border: isSelected ? '1px solid hsla(265,89%,65%,0.3)' : '1px solid transparent',
                  }}
                >
                  <Avatar name={p.name} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white/90 truncate">{p.name}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                      {p.pillars.slice(0, 2).join(', ') || 'No pillars set'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: detail / form */}
      <div className="flex-1 overflow-y-auto py-6" style={{ paddingLeft: 32, paddingRight: 32 }}>
        {creating ? (
          <div>
            <h2 className="text-base font-semibold text-white/90 mb-5">New Persona</h2>
            <PersonaForm
              onSave={(p) => {
                setPersonas((prev) => [...prev, p])
                setSelected(p)
                setCreating(false)
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        ) : selected ? (
          <div>
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-4">
                <Avatar name={selected.name} size={52} />
                <div>
                  <h2 className="text-base font-bold text-white/95">{selected.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {selected.latestFingerprint
                      ? `${selected.latestFingerprint.tone} · ${selected.latestFingerprint.avgSentenceLength.toFixed(0)}w avg sentence`
                      : 'No style fingerprint yet'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(selected.id)}
                disabled={deleteId === selected.id}
                className="btn btn-ghost btn-icon"
                style={{ color: 'var(--color-error)' }}
              >
                {deleteId === selected.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
              </button>
            </div>

            <PersonaForm
              initial={selected}
              onSave={(p) => {
                setPersonas((prev) => prev.map((x) => x.id === p.id ? p : x))
                setSelected(p)
              }}
              onCancel={() => setSelected(null)}
            />

            {selected.latestFingerprint && (
              <div className="mt-8">
                <p className="section-label">Style Fingerprint</p>
                <div className="glass-card p-5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--color-text-muted)]">Tone</span>
                    <span className="font-medium text-[var(--color-text-secondary)] capitalize">
                      {selected.latestFingerprint.tone}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--color-text-muted)]">Avg sentence</span>
                    <span className="font-mono text-[var(--color-text-secondary)]">
                      {selected.latestFingerprint.avgSentenceLength.toFixed(1)} words
                    </span>
                  </div>
                  {selected.latestFingerprint.descriptors.length > 0 && (
                    <div>
                      <p className="text-[11px] text-[var(--color-text-muted)] mb-2">Descriptors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.latestFingerprint.descriptors.map((d, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)' }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state h-full">
            <div className="empty-icon-wrap">
              <UserCircle2 size={24} />
            </div>
            <p className="empty-title">Select a persona</p>
            <p className="empty-text">Pick one from the list or create a new persona to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
