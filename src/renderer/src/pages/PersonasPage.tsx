import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { UserCircle2, Plus, Save, Trash2, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Persona } from '@shared/types/persona'

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
    if (res.ok) {
      onSave(res.value)
    } else {
      setError(res.error.message)
    }
  }

  const inputClass = 'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Name *</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yash — Tech Founder" />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Bio</label>
        <textarea className={`${inputClass} resize-none h-20`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio that AI uses to understand your background..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Content Pillars (comma-separated)</label>
        <input className={inputClass} value={pillars} onChange={(e) => setPillars(e.target.value)} placeholder="AI, indie hacking, product building..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Style Hints</label>
        <textarea className={`${inputClass} resize-none h-16`} value={styleHints} onChange={(e) => setStyleHints(e.target.value)} placeholder="Casual and direct, use short sentences, avoid corporate jargon..." />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[var(--color-error)] text-xs">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'hsla(265,89%,65%,0.9)' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial ? 'Update' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:bg-white/5">
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
    <div className="flex h-full animate-slide-up">
      {/* List */}
      <div className="w-72 border-r border-[var(--color-border-subtle)] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <h1 className="text-sm font-semibold text-white/90">Personas</h1>
          <button
            onClick={() => { setCreating(true); setSelected(null) }}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <Plus size={14} className="text-[var(--color-brand-primary)]" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : personas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <UserCircle2 size={24} className="text-[var(--color-text-muted)] mb-2" />
            <p className="text-xs text-[var(--color-text-muted)]">No personas yet</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-3 text-xs text-[var(--color-brand-primary)] hover:underline"
            >
              Create your first persona
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setCreating(false) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:bg-white/5"
                style={{
                  background: selected?.id === p.id ? 'hsla(265,89%,65%,0.1)' : 'transparent',
                  border: selected?.id === p.id ? '1px solid hsla(265,89%,65%,0.3)' : '1px solid transparent',
                }}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-xs font-semibold text-[var(--color-brand-primary)]">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/90 truncate">{p.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] truncate">{p.pillars.slice(0, 2).join(', ')}</div>
                </div>
                <ChevronRight size={12} className="text-[var(--color-text-muted)] opacity-50" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail / form panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {creating ? (
          <div>
            <h2 className="text-sm font-semibold text-white/90 mb-6">New Persona</h2>
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
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-3)] flex items-center justify-center text-lg font-semibold text-[var(--color-brand-primary)]">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white/90">{selected.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {selected.latestFingerprint
                      ? `Fingerprint: ${selected.latestFingerprint.tone} · ${selected.latestFingerprint.avgSentenceLength.toFixed(0)}w avg sentence`
                      : 'No fingerprint yet'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(selected.id)}
                disabled={deleteId === selected.id}
                className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                {deleteId === selected.id
                  ? <Loader2 size={14} className="animate-spin text-[var(--color-error)]" />
                  : <Trash2 size={14} className="text-[var(--color-error)]" />
                }
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
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Style Fingerprint</h3>
                <div className="glass-card p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">Tone</span>
                    <span className="text-[var(--color-text-secondary)]">{selected.latestFingerprint.tone}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">Avg sentence length</span>
                    <span className="text-[var(--color-text-secondary)]">{selected.latestFingerprint.avgSentenceLength.toFixed(1)} words</span>
                  </div>
                  {selected.latestFingerprint.descriptors.length > 0 && (
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-2">Descriptors</div>
                      <div className="flex flex-wrap gap-1">
                        {selected.latestFingerprint.descriptors.map((d, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <UserCircle2 size={32} className="text-[var(--color-text-muted)] mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">Select a persona to view or edit</p>
          </div>
        )}
      </div>
    </div>
  )
}
