import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { Plus, Target, Trash2 } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'
import type { Intent } from '@shared/types/intent'
import type { Persona } from '@shared/types/persona'
import { WorkspaceHeader } from '../../components/shell/WorkspaceHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'

type GoalObjectiveType = 'audience_growth' | 'engagement' | 'traffic' | 'cadence' | 'quality'
type GoalMetric =
  | 'followers'
  | 'impressions'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'clicks'
  | 'posts_per_week'

interface GoalMeta {
  objective: GoalObjectiveType
  platform: Platform | 'all'
  metric: GoalMetric
  current: number
  target: number
  unit: string
  cadence: number
  pillars: string
}

const OBJECTIVES: Record<GoalObjectiveType, string> = {
  audience_growth: 'Grow audience',
  engagement: 'Increase engagement',
  traffic: 'Drive website clicks',
  cadence: 'Increase posting consistency',
  quality: 'Improve content quality'
}

const METRICS: Record<GoalMetric, string> = {
  followers: 'Followers',
  impressions: 'Impressions / views',
  likes: 'Likes',
  comments: 'Comments / replies',
  shares: 'Shares / reposts',
  saves: 'Saves',
  clicks: 'Clicks',
  posts_per_week: 'Posts per week'
}

function parseMeta(intent: Intent): GoalMeta | null {
  try {
    const meta = JSON.parse(intent.description) as Partial<GoalMeta>
    if (!meta.objective || !meta.metric) return null
    return {
      objective: meta.objective,
      platform: meta.platform ?? 'all',
      metric: meta.metric,
      current: Number(meta.current ?? 0),
      target: Number(meta.target ?? 0),
      unit: meta.unit ?? '',
      cadence: Number(meta.cadence ?? 0),
      pillars: meta.pillars ?? ''
    }
  } catch {
    return null
  }
}

function GoalCard({ intent, onRemove }: { intent: Intent; onRemove: () => void }): ReactElement {
  const meta = parseMeta(intent)
  const current = meta?.current ?? intent.keyResults[0]?.current ?? 0
  const target = meta?.target ?? intent.keyResults[0]?.target ?? 0
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const platform =
    meta?.platform === 'all' || !meta?.platform ? 'All platforms' : PLATFORM_LABELS[meta.platform]

  return (
    <div className="workspace-card goal-card">
      <div className="goal-card-main">
        <div className="settings-icon-cell">
          <Target size={17} />
        </div>
        <div className="settings-row-main">
          <div className="goal-card-title">{intent.title}</div>
          <p>
            {meta
              ? `${OBJECTIVES[meta.objective]} · ${METRICS[meta.metric]} · ${platform}`
              : intent.horizon}
          </p>
        </div>
        <Badge variant={pct >= 100 ? 'success' : 'info'}>{pct}%</Badge>
      </div>
      <div className="goal-progress-row">
        <span className="mono">{current.toLocaleString()}</span>
        <div className="progress">
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="mono">{target.toLocaleString()}</span>
      </div>
      <div className="goal-meta-row">
        <span>{intent.horizon}</span>
        {meta?.cadence ? <span>{meta.cadence} posts/week</span> : null}
        {meta?.pillars ? <span>{meta.pillars}</span> : null}
        <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  )
}

function CreateGoalForm({
  personas,
  onCreated,
  onCancel
}: {
  personas: Persona[]
  onCreated: (intent: Intent) => void
  onCancel: () => void
}): ReactElement {
  const [title, setTitle] = useState('')
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? 'default')
  const [objective, setObjective] = useState<GoalObjectiveType>('audience_growth')
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [metric, setMetric] = useState<GoalMetric>('followers')
  const [current, setCurrent] = useState('0')
  const [target, setTarget] = useState('')
  const [horizon, setHorizon] = useState('12 weeks')
  const [cadence, setCadence] = useState('3')
  const [pillars, setPillars] = useState('')
  const [creating, setCreating] = useState(false)
  const canSubmit = title.trim() && Number(target) > 0

  useEffect(() => {
    if (!personaId && personas[0]) setPersonaId(personas[0].id)
  }, [personaId, personas])

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!canSubmit) return
    setCreating(true)
    const meta: GoalMeta = {
      objective,
      platform,
      metric,
      current: Number(current) || 0,
      target: Number(target),
      unit: METRICS[metric],
      cadence: Number(cadence) || 0,
      pillars: pillars.trim()
    }
    const res = await ipc.invoke(IPC_CHANNELS.INTENT_CREATE, {
      personaId: personaId || personas[0]?.id || 'default',
      title: title.trim(),
      description: JSON.stringify(meta),
      horizon
    })
    setCreating(false)
    if (res.ok) onCreated(res.value)
  }

  return (
    <form className="workspace-card goal-form" onSubmit={handleSubmit}>
      <div className="settings-section-title">
        <div>
          <span>New goal</span>
          <h2>Measurable social objective</h2>
        </div>
      </div>
      <label>
        <span className="form-label">Goal name</span>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Reach 10,000 LinkedIn followers"
          autoFocus
        />
      </label>
      <div className="settings-form-grid">
        <label>
          <span className="form-label">Objective</span>
          <Select
            value={objective}
            onChange={(event) => setObjective(event.target.value as GoalObjectiveType)}
          >
            {Object.entries(OBJECTIVES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="form-label">Persona</span>
          <Select value={personaId} onChange={(event) => setPersonaId(event.target.value)}>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="form-label">Platform</span>
          <Select
            value={platform}
            onChange={(event) => setPlatform(event.target.value as Platform | 'all')}
          >
            <option value="all">All connected platforms</option>
            {Object.values(Platform).map((value) => (
              <option key={value} value={value}>
                {PLATFORM_LABELS[value]}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="form-label">Metric</span>
          <Select value={metric} onChange={(event) => setMetric(event.target.value as GoalMetric)}>
            {Object.entries(METRICS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="form-label">Current value</span>
          <Input
            type="number"
            min="0"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>
        <label>
          <span className="form-label">Target value</span>
          <Input
            type="number"
            min="1"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="10000"
          />
        </label>
        <label>
          <span className="form-label">Timeframe</span>
          <Select value={horizon} onChange={(event) => setHorizon(event.target.value)}>
            <option>4 weeks</option>
            <option>12 weeks</option>
            <option>6 months</option>
            <option>1 year</option>
          </Select>
        </label>
        <label>
          <span className="form-label">Posting cadence</span>
          <Input
            type="number"
            min="0"
            value={cadence}
            onChange={(event) => setCadence(event.target.value)}
          />
        </label>
      </div>
      <label>
        <span className="form-label">Content pillars</span>
        <Textarea
          value={pillars}
          onChange={(event) => setPillars(event.target.value)}
          placeholder="AI products, founder lessons, customer stories"
        />
      </label>
      <div className="settings-row-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={creating}
          disabled={!canSubmit}
          leftIcon={<Plus size={14} />}
        >
          Create goal
        </Button>
      </div>
    </form>
  )
}

export default function GoalsPage(): ReactElement {
  const [goals, setGoals] = useState<Intent[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void Promise.all([
      ipc.invoke(IPC_CHANNELS.INTENT_LIST, {}),
      ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {})
    ]).then(([intentRes, personaRes]) => {
      if (intentRes.ok) setGoals(intentRes.value)
      if (personaRes.ok) setPersonas(personaRes.value)
    })
  }, [])

  const subtitle = useMemo(
    () => `${goals.length} active objective${goals.length === 1 ? '' : 's'} with explicit targets`,
    [goals.length]
  )

  return (
    <div className="workspace-page">
      <WorkspaceHeader
        title="Goals"
        subtitle={subtitle}
        actions={
          !creating ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setCreating(true)}
            >
              New goal
            </Button>
          ) : null
        }
      />
      <div className="page-body">
        <div className="workspace-stack">
          {creating ? (
            <CreateGoalForm
              personas={personas}
              onCreated={(goal) => {
                setGoals((current) => [goal, ...current])
                setCreating(false)
              }}
              onCancel={() => setCreating(false)}
            />
          ) : null}
          {goals.length === 0 && !creating ? (
            <div className="empty-state workspace-card">
              <div className="empty-icon-wrap">
                <Target size={22} />
              </div>
              <div className="empty-title">No goals yet</div>
              <div className="empty-text">
                Create a measurable platform objective. Goals do not schedule posts automatically.
              </div>
              <Button
                variant="primary"
                leftIcon={<Plus size={14} />}
                onClick={() => setCreating(true)}
              >
                New goal
              </Button>
            </div>
          ) : null}
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              intent={goal}
              onRemove={async () => {
                await ipc.invoke(IPC_CHANNELS.INTENT_DELETE, { id: goal.id })
                setGoals((current) => current.filter((item) => item.id !== goal.id))
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
