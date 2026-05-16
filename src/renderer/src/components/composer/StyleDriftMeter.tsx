import { type ReactElement, useState, useEffect, useRef } from 'react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import { Fingerprint } from 'lucide-react'

interface StyleDriftMeterProps {
  personaId: string
  text: string
  /** Debounce in ms before triggering the IPC call. Default 800. */
  debounceMs?: number
}

function scoreLabel(score: number): string {
  if (score >= 0.85) return 'Sounds like you'
  if (score >= 0.7) return 'Close to your voice'
  if (score >= 0.5) return 'Slightly off-brand'
  return 'Sounds different'
}

function scoreColor(score: number): string {
  if (score >= 0.7) return 'var(--color-success)'
  if (score >= 0.5) return 'var(--color-warning)'
  return 'var(--color-error)'
}

export function StyleDriftMeter({
  personaId,
  text,
  debounceMs = 800
}: StyleDriftMeterProps): ReactElement {
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!personaId || !text.trim()) {
      setScore(null)
      return
    }

    // Debounce the IPC call
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const res = await ipc.invoke(IPC_CHANNELS.AI_STYLE_DRIFT, { personaId, text })
      setLoading(false)
      if (res.ok) setScore(res.value.score)
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [personaId, text, debounceMs])

  if (!personaId || (!loading && score === null)) return <></>

  const pct = score !== null ? Math.round(score * 100) : 0
  const color = score !== null ? scoreColor(score) : 'var(--color-text-muted)'

  return (
    <div className="flex items-center gap-2.5">
      <Fingerprint
        size={12}
        style={{ color, flexShrink: 0 }}
        className={loading ? 'animate-pulse' : ''}
      />
      <div className="flex items-center gap-2 flex-1">
        <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--color-border)' }}>
          {!loading && score !== null && (
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: color }}
            />
          )}
        </div>
        <span className="text-[10px] font-mono shrink-0" style={{ color, minWidth: 28 }}>
          {loading ? '…' : `${pct}%`}
        </span>
      </div>
      {!loading && score !== null && (
        <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
          {scoreLabel(score)}
          {score < 0.7 && (
            <span
              className="ml-1 px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}
            >
              ⚠
            </span>
          )}
        </span>
      )}
    </div>
  )
}
