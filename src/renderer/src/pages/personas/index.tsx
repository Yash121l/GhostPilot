import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { Plus, Save, Trash2, Loader2, Sparkles } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'

interface DemoPersona {
  id: string
  name: string
  bio: string
  pillars: string
  style: string
  posts: number
  voice: number
}

const SEED_PERSONAS: DemoPersona[] = []

function PersonaField({
  label,
  value,
  chips
}: {
  label: string
  value: string
  chips?: boolean
}): ReactElement {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          fontWeight: 600,
          marginBottom: 6
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        {chips
          ? value.split(',').map((p, i) => (
              <span key={i} className="chip" style={{ marginRight: 6, marginBottom: 6 }}>
                {p.trim()}
              </span>
            ))
          : value}
      </div>
    </div>
  )
}

function PersonaDetail({
  persona,
  onDelete
}: {
  persona: DemoPersona
  onDelete: () => void
}): ReactElement {
  return (
    <div style={{ maxWidth: 680 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700
            }}
          >
            {persona.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {persona.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {persona.posts} posts · voice match {persona.voice}%
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn danger" onClick={onDelete}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
        <PersonaField label="Bio" value={persona.bio} />
        <PersonaField label="Content pillars" value={persona.pillars} chips />
        <PersonaField label="Style hints" value={persona.style} />
      </div>

      <div
        style={{
          marginTop: 28,
          padding: 18,
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 10
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            fontWeight: 600,
            marginBottom: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Sparkles size={12} /> Voice training
        </div>
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          AI matches your voice with <strong>{persona.voice}% confidence</strong> based on{' '}
          {persona.posts} published posts.
        </div>
        <div className="progress">
          <div className="fill" style={{ width: persona.voice + '%' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
          {persona.voice >= 75
            ? 'Your voice is well-trained. AI variants should feel native.'
            : 'Publish 5+ posts to improve voice accuracy.'}
        </div>
      </div>
    </div>
  )
}

function PersonaForm({
  onSave,
  onCancel
}: {
  onSave: (p: DemoPersona) => void
  onCancel: () => void
}): ReactElement {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [pillars, setPillars] = useState('')
  const [style, setStyle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const res = await ipc.invoke(IPC_CHANNELS.PERSONA_CREATE, {
      name: name.trim(),
      bio: bio.trim(),
      pillars: pillars
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      styleHints: style.trim()
    })
    setSaving(false)
    if (res.ok) {
      onSave({
        id: res.value.id,
        name: res.value.name,
        bio: bio.trim(),
        pillars: pillars.trim(),
        style: style.trim(),
        posts: 0,
        voice: 50
      })
    } else {
      // Demo fallback
      onSave({
        id: 'p' + Date.now(),
        name: name.trim(),
        bio: bio.trim(),
        pillars: pillars.trim(),
        style: style.trim(),
        posts: 0,
        voice: 50
      })
    }
  }

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>New Persona</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22 }}>
        Personas let GhostPilot adapt voice, pillars, and style per audience.
      </div>
      <form onSubmit={handleSave}>
        <label className="label">Name *</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Yash — Tech Founder"
          autoFocus
        />
        <label className="label" style={{ marginTop: 16 }}>
          Bio
        </label>
        <textarea
          className="textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short bio — AI uses this as context when writing in your voice…"
          style={{ minHeight: 90 }}
        />
        <label className="label" style={{ marginTop: 16 }}>
          Content pillars
        </label>
        <input
          className="input"
          value={pillars}
          onChange={(e) => setPillars(e.target.value)}
          placeholder="AI, indie hacking, product building"
        />
        <div className="helper">Comma-separated topics you consistently post about</div>
        <label className="label" style={{ marginTop: 16 }}>
          Style hints
        </label>
        <textarea
          className="textarea"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="Casual and direct, use short sentences, avoid corporate jargon…"
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Create Persona'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function PersonasPage(): ReactElement {
  const [personas, setPersonas] = useState<DemoPersona[]>(SEED_PERSONAS)
  const [selected, setSelected] = useState<string>(SEED_PERSONAS[0]?.id ?? '')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {}).then((res) => {
      if (res.ok && res.value.length > 0) {
        const mapped: DemoPersona[] = res.value.map((p) => ({
          id: p.id,
          name: p.name,
          bio: p.bio ?? '',
          pillars: (p.pillars ?? []).join(', '),
          style: p.styleHints ?? '',
          posts: 0,
          voice: 50
        }))
        setPersonas(mapped)
        setSelected(mapped[0]?.id ?? '')
      }
    })
  }, [])

  const persona = personas.find((p) => p.id === selected) ?? null

  return (
    <div
      className="fade-in"
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 0,
        height: '100%',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--bg-card)',
        margin: '24px 28px'
      }}
    >
      {/* List panel */}
      <div
        style={{
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>Personas</div>
          <button
            className="btn ghost icon"
            style={{ width: 28, height: 28, padding: 0 }}
            onClick={() => {
              setCreating(true)
              setSelected('')
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p.id)
                setCreating(false)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                marginBottom: 2,
                background: selected === p.id ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                padding: '10px 12px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: selected === p.id ? 'var(--accent)' : 'var(--text)'
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: selected === p.id ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: selected === p.id ? '#fff' : 'var(--text-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid ' + (selected === p.id ? 'var(--accent)' : 'var(--border)')
                }}
              >
                {p.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {p.posts} posts · voice {p.voice}%
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail / create panel */}
      <div style={{ overflow: 'auto', padding: 28 }}>
        {creating ? (
          <PersonaForm
            onSave={(p) => {
              setPersonas((prev) => [...prev, p])
              setSelected(p.id)
              setCreating(false)
            }}
            onCancel={() => {
              setCreating(false)
              setSelected(personas[0]?.id ?? '')
            }}
          />
        ) : persona ? (
          <PersonaDetail
            persona={persona}
            onDelete={async () => {
              await ipc.invoke(IPC_CHANNELS.PERSONA_DELETE, { id: persona.id })
              setPersonas((prev) => prev.filter((p) => p.id !== persona.id))
              setSelected(personas.find((p) => p.id !== persona.id)?.id ?? '')
            }}
          />
        ) : (
          <div style={{ color: 'var(--text-3)' }}>Select a persona or create a new one.</div>
        )}
      </div>
    </div>
  )
}
