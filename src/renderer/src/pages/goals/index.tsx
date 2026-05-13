import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'

interface DemoKR {
  label: string
  done: boolean
  current: number
  target: number
}
interface DemoGoal {
  id: string
  name: string
  progress: number
  current: number
  target: number
  weekly: number
  keyResults: DemoKR[]
}

function GoalCard({ goal, onRemove }: { goal: DemoGoal; onRemove: () => void }): ReactElement {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600
            }}
          >
            North star
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, letterSpacing: '-0.01em' }}>
            {goal.name}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
            {goal.current.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            of {goal.target.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="progress" style={{ marginTop: 14 }}>
        <div className="fill" style={{ width: goal.progress * 100 + '%' }} />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 12,
          color: 'var(--text-3)'
        }}
      >
        <span>{Math.round(goal.progress * 100)}% to goal</span>
        <span>Posting {goal.weekly}/wk to stay on track</span>
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            fontWeight: 600,
            marginBottom: 10
          }}
        >
          Key results
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goal.keyResults.map((kr, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  flexShrink: 0,
                  border: '1.5px solid ' + (kr.done ? 'var(--success)' : 'var(--border-strong)'),
                  background: kr.done ? 'var(--success)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 11
                }}
              >
                {kr.done && '✓'}
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: kr.done ? 'var(--text-3)' : 'var(--text)',
                  textDecoration: kr.done ? 'line-through' : 'none'
                }}
              >
                {kr.label}
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
                {kr.current}/{kr.target}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn ghost"
          style={{ fontSize: 12, padding: '5px 10px', color: 'var(--error)' }}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

function CreateGoalForm({
  onCreated,
  onCancel
}: {
  onCreated: (g: DemoGoal) => void
  onCancel: () => void
}): ReactElement {
  const [northStar, setNorthStar] = useState('')
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!northStar.trim()) return
    setCreating(true)

    // Try real IPC first
    const personasRes = await ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {})
    const personaId =
      personasRes.ok && personasRes.value.length > 0 ? personasRes.value[0].id : 'default'

    const res = await ipc.invoke(IPC_CHANNELS.INTENT_CREATE, {
      personaId,
      title: northStar.trim(),
      description: '',
      horizon: '6 months'
    })

    setCreating(false)

    if (res.ok) {
      const intent = res.value
      onCreated({
        id: intent.id,
        name: intent.title,
        progress: 0.05,
        current: 0,
        target: 1000,
        weekly: 4,
        keyResults: intent.keyResults.map((kr) => ({
          label: kr.title,
          done: false,
          current: kr.current ?? 0,
          target: kr.target
        }))
      })
    } else {
      // Demo fallback
      onCreated({
        id: 'g' + Date.now(),
        name: northStar.trim(),
        progress: 0.05,
        current: 124,
        target: 5000,
        weekly: 4,
        keyResults: [
          { label: 'Publish 4 posts / week', done: false, current: 1, target: 4 },
          { label: 'Reach 5%+ engagement rate', done: false, current: 0, target: 5 },
          { label: 'Build a 3-week content backlog', done: false, current: 0, target: 3 }
        ]
      })
    }
  }

  return (
    <div className="card fade-in" style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>New Goal</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22 }}>
        Tell GhostPilot what you want to achieve — AI decomposes it into measurable key results.
      </div>
      <form onSubmit={handleSubmit}>
        <label className="label">North-star outcome *</label>
        <input
          className="input"
          value={northStar}
          onChange={(e) => setNorthStar(e.target.value)}
          placeholder="e.g. Reach 10,000 LinkedIn followers by Q4"
          autoFocus
        />
        <label className="label" style={{ marginTop: 16 }}>
          Timeframe
        </label>
        <select className="select" defaultValue="6 months">
          <option>4 weeks</option>
          <option>12 weeks</option>
          <option value="6 months">6 months</option>
          <option>1 year</option>
        </select>
        <label className="label" style={{ marginTop: 16 }}>
          Primary platform
        </label>
        <select className="select">
          <option>LinkedIn</option>
          <option>X (Twitter)</option>
          <option>Instagram</option>
          <option>All platforms</option>
        </select>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button type="submit" className="btn primary" disabled={creating}>
            <Sparkles size={14} />
            {creating ? 'Decomposing…' : 'Decompose with AI'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function GoalsPage(): ReactElement {
  const [goals, setGoals] = useState<DemoGoal[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.INTENT_LIST, {}).then((res) => {
      if (res.ok && res.value.length > 0) {
        const mapped: DemoGoal[] = res.value.map((intent) => {
          const avg =
            intent.keyResults.length > 0
              ? intent.keyResults.reduce(
                  (s, kr) => s + Math.min(1, kr.target > 0 ? kr.current / kr.target : 0),
                  0
                ) / intent.keyResults.length
              : 0
          return {
            id: intent.id,
            name: intent.title,
            progress: avg,
            current: intent.keyResults[0]?.current ?? 0,
            target: intent.keyResults[0]?.target ?? 1,
            weekly: 4,
            keyResults: intent.keyResults.map((kr) => ({
              label: kr.title,
              done: kr.current >= kr.target,
              current: kr.current,
              target: kr.target
            }))
          }
        })
        setGoals(mapped)
      }
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">AI breaks your north-star into a weekly posting plan</p>
        </div>
        {!creating && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> New Goal
          </button>
        )}
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {creating && (
            <CreateGoalForm
              onCreated={(g) => {
                setGoals((prev) => [g, ...prev])
                setCreating(false)
              }}
              onCancel={() => setCreating(false)}
            />
          )}
          {goals.length === 0 && !creating && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                No goals yet
              </div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>
                Create your first goal and GhostPilot will break it into a weekly posting plan.
              </div>
              <button className="btn primary" onClick={() => setCreating(true)}>
                <Plus size={14} /> New Goal
              </button>
            </div>
          )}
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onRemove={() => setGoals((prev) => prev.filter((g) => g.id !== goal.id))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
