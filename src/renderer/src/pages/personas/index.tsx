import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import {
  AtSign,
  Briefcase,
  Camera,
  FileText,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserCircle2
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { Persona } from '@shared/types/persona'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'
import { WorkspaceHeader } from '../../components/shell/WorkspaceHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'

type PersonaTab = 'profile' | 'training' | 'platform' | 'samples'

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera
}

function voiceConfidence(postCount: number, sampleCount: number): number | null {
  const total = postCount + sampleCount
  if (total === 0) return null
  return Math.min(92, 35 + total * 9)
}

function PersonaForm({
  onSave,
  onCancel
}: {
  onSave: (persona: Persona) => void
  onCancel: () => void
}): ReactElement {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [pillars, setPillars] = useState('')
  const [style, setStyle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const res = await ipc.invoke(IPC_CHANNELS.PERSONA_CREATE, {
      name: name.trim(),
      bio: bio.trim(),
      pillars: pillars
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      styleHints: style.trim()
    })
    setSaving(false)
    if (res.ok) onSave(res.value)
  }

  return (
    <form className="workspace-card persona-form" onSubmit={handleSubmit}>
      <div className="settings-section-title">
        <div>
          <span>New persona</span>
          <h2>Voice profile</h2>
        </div>
      </div>
      <label>
        <span className="form-label">Name</span>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Yash - Tech Founder"
          autoFocus
        />
      </label>
      <label>
        <span className="form-label">Bio</span>
        <Textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Short context GhostPilot should know when writing in this voice."
        />
      </label>
      <label>
        <span className="form-label">Content pillars</span>
        <Input
          value={pillars}
          onChange={(event) => setPillars(event.target.value)}
          placeholder="AI, indie hacking, product building"
        />
      </label>
      <label>
        <span className="form-label">Style hints</span>
        <Textarea
          value={style}
          onChange={(event) => setStyle(event.target.value)}
          placeholder="Direct, short sentences, avoid corporate jargon."
        />
      </label>
      <div className="settings-row-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={!name.trim()}
          leftIcon={<Save size={14} />}
        >
          Create persona
        </Button>
      </div>
    </form>
  )
}

function PersonaDetail({
  persona,
  posts,
  onDelete
}: {
  persona: Persona
  posts: Post[]
  onDelete: () => void
}): ReactElement {
  const [tab, setTab] = useState<PersonaTab>('profile')
  const personaPosts = posts.filter((post) => post.personaId === persona.id)
  const published = personaPosts.filter((post) => post.status === PostStatus.PUBLISHED)
  const confidence = voiceConfidence(published.length, 0)
  const pillars = persona.pillars ?? []

  return (
    <div className="persona-detail">
      <div className="persona-detail-header">
        <div className="persona-avatar">{persona.name.charAt(0).toUpperCase()}</div>
        <div className="settings-row-main">
          <h2>{persona.name}</h2>
          <p>
            {published.length} published posts ·{' '}
            {confidence == null ? 'voice not trained' : `voice confidence ${confidence}%`}
          </p>
        </div>
        <Button variant="destructive" size="sm" leftIcon={<Trash2 size={13} />} onClick={onDelete}>
          Delete
        </Button>
      </div>
      <div className="settings-tabs persona-tabs">
        {(['profile', 'training', 'platform', 'samples'] as PersonaTab[]).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item === 'profile'
              ? 'Profile'
              : item === 'training'
                ? 'Training'
                : item === 'platform'
                  ? 'Platform voice'
                  : 'Samples'}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="persona-panel-grid">
          <div className="workspace-card settings-muted-card">
            <span className="workspace-kicker">Bio</span>
            <p>{persona.bio || 'No bio yet.'}</p>
          </div>
          <div className="workspace-card settings-muted-card">
            <span className="workspace-kicker">Content pillars</span>
            <div className="persona-chip-row">
              {pillars.length ? (
                pillars.map((pillar) => (
                  <Badge key={pillar} variant="muted">
                    {pillar}
                  </Badge>
                ))
              ) : (
                <span>No pillars yet.</span>
              )}
            </div>
          </div>
          <div className="workspace-card settings-muted-card">
            <span className="workspace-kicker">Style hints</span>
            <p>{persona.styleHints || 'No style hints yet.'}</p>
          </div>
        </div>
      ) : null}

      {tab === 'training' ? (
        <div className="workspace-card persona-training-card">
          <div className="settings-section-title">
            <div>
              <span>Voice training</span>
              <h2>{confidence == null ? 'Not enough data' : `${confidence}% confidence`}</h2>
            </div>
            <Badge variant={confidence == null ? 'warning' : 'success'}>
              {published.length} posts
            </Badge>
          </div>
          <div className="progress">
            <div className="fill" style={{ width: `${confidence ?? 0}%` }} />
          </div>
          <p>
            Add manual samples, publish GhostPilot posts, or connect platform analytics to train
            this persona from top-performing content.
          </p>
        </div>
      ) : null}

      {tab === 'platform' ? (
        <div className="persona-platform-grid">
          {Object.values(Platform).map((platform) => {
            const Icon = PLATFORM_ICONS[platform]
            const count = published.filter((post) => post.platforms.includes(platform)).length
            const score = voiceConfidence(count, 0)
            return (
              <div key={platform} className="workspace-card settings-key-row">
                <div className="settings-icon-cell">
                  <Icon size={16} />
                </div>
                <div className="settings-row-main">
                  <strong>{PLATFORM_LABELS[platform]}</strong>
                  <p>
                    {score == null
                      ? 'No published samples yet.'
                      : `${score}% confidence from ${count} posts.`}
                  </p>
                </div>
                <Badge variant={score == null ? 'muted' : 'info'}>
                  {score == null ? 'No data' : `${score}%`}
                </Badge>
              </div>
            )
          })}
        </div>
      ) : null}

      {tab === 'samples' ? (
        <div className="workspace-card">
          {personaPosts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <FileText size={20} />
              </div>
              <div className="empty-title">No samples yet</div>
              <div className="empty-text">
                Draft and publish posts with this persona to build a voice profile.
              </div>
            </div>
          ) : (
            <div className="settings-list">
              {personaPosts.slice(0, 8).map((post) => (
                <div key={post.id} className="settings-key-row">
                  <div className="settings-icon-cell">
                    <FileText size={15} />
                  </div>
                  <div className="settings-row-main">
                    <strong>{post.body.slice(0, 80) || '(empty)'}</strong>
                    <p>{post.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function PersonasPage(): ReactElement {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void Promise.all([
      ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {}),
      ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 500 })
    ]).then(([personaRes, postRes]) => {
      if (personaRes.ok) {
        setPersonas(personaRes.value)
        setSelected(personaRes.value[0]?.id ?? '')
      }
      if (postRes.ok) setPosts(postRes.value)
    })
  }, [])

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selected) ?? null,
    [personas, selected]
  )

  return (
    <div className="workspace-page">
      <WorkspaceHeader
        title="Personas"
        subtitle="Voice profiles, training sources, and platform-specific writing patterns."
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setCreating(true)}
          >
            New persona
          </Button>
        }
      />
      <div className="personas-workspace">
        <aside className="persona-list-panel">
          <div className="settings-section-title">
            <div>
              <span>Profiles</span>
              <h2>{personas.length} personas</h2>
            </div>
          </div>
          <div className="settings-list">
            {personas.map((persona) => {
              const postCount = posts.filter((post) => post.personaId === persona.id).length
              return (
                <button
                  key={persona.id}
                  className={`persona-list-item ${selected === persona.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelected(persona.id)
                    setCreating(false)
                  }}
                >
                  <span className="persona-list-avatar">
                    {persona.name.charAt(0).toUpperCase()}
                  </span>
                  <span>
                    <strong>{persona.name}</strong>
                    <small>{postCount} posts</small>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>
        <main className="persona-main-panel">
          {creating ? (
            <PersonaForm
              onSave={(persona) => {
                setPersonas((current) => [...current, persona])
                setSelected(persona.id)
                setCreating(false)
              }}
              onCancel={() => setCreating(false)}
            />
          ) : selectedPersona ? (
            <PersonaDetail
              persona={selectedPersona}
              posts={posts}
              onDelete={async () => {
                await ipc.invoke(IPC_CHANNELS.PERSONA_DELETE, { id: selectedPersona.id })
                setPersonas((current) => current.filter((item) => item.id !== selectedPersona.id))
                setSelected(personas.find((item) => item.id !== selectedPersona.id)?.id ?? '')
              }}
            />
          ) : (
            <div className="empty-state workspace-card">
              <div className="empty-icon-wrap">
                <UserCircle2 size={22} />
              </div>
              <div className="empty-title">No persona selected</div>
              <div className="empty-text">Create a persona to train platform-specific voice.</div>
              <Button
                variant="primary"
                leftIcon={<Sparkles size={14} />}
                onClick={() => setCreating(true)}
              >
                Create persona
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
