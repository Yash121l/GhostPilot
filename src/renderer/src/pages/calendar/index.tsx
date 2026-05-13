import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { Briefcase, AtSign, Camera, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import { Platform } from '@shared/types/platform'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import type { RateLimitInfo } from '@shared/ipc-types'

const ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera,
}
const COLORS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'var(--linkedin)',
  [Platform.TWITTER]: '#111',
  [Platform.INSTAGRAM]: 'var(--instagram)',
}
const BG: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'var(--linkedin-soft)',
  [Platform.TWITTER]: 'var(--twitter-soft)',
  [Platform.INSTAGRAM]: 'var(--instagram-soft)',
}
const LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.TWITTER]: 'X',
  [Platform.INSTAGRAM]: 'Instagram',
}

interface DayPost {
  id: string
  day: number
  hour: number
  platform: Platform
  title: string
  status: string
}

function toDayPost(p: Post): DayPost {
  const dt = new Date(p.scheduledAt ?? p.createdAt)
  return {
    id: p.id,
    day: dt.getDate(),
    hour: dt.getHours(),
    platform: (p.platforms[0] as Platform) ?? Platform.LINKEDIN,
    title: p.body.slice(0, 80),
    status: p.status,
  }
}

function PostRow({ post, onDelete }: { post: DayPost; onDelete: () => void }): ReactElement {
  const Icon = ICONS[post.platform] ?? Briefcase
  const color = COLORS[post.platform] ?? 'var(--accent)'
  const bg = BG[post.platform] ?? 'var(--accent-soft)'
  const label = LABELS[post.platform] ?? post.platform
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 12px',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg-card)',
      }}
    >
      <div className="mono" style={{ width: 50, color: 'var(--text-3)', fontSize: 13 }}>
        {String(post.hour).padStart(2, '0')}:00
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {post.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          {post.status === PostStatus.SCHEDULED ? (
            <span style={{ color: 'var(--success)' }}>● Scheduled</span>
          ) : (
            <span>○ {post.status}</span>
          )}
          {' · '}
          {label}
        </div>
      </div>
      <button
        className="btn ghost icon"
        onClick={onDelete}
        style={{ width: 28, height: 28, padding: 0, fontSize: 16, color: 'var(--text-3)' }}
      >
        ×
      </button>
    </div>
  )
}

export default function CalendarPage(): ReactElement {
  const today = new Date()
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [posts, setPosts] = useState<Post[]>([])
  const [rateLimits, setRateLimits] = useState<Map<Platform, RateLimitInfo>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 200 })
    if (res.ok) setPosts(res.value)
    setLoading(false)
  }, [])

  const loadRateLimits = useCallback(async (): Promise<void> => {
    const platforms = [Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM]
    const map = new Map<Platform, RateLimitInfo>()
    for (const p of platforms) {
      const res = await ipc.invoke(IPC_CHANNELS.CONNECTIONS_RATE_LIMIT_STATE, { platform: p })
      if (res.ok) map.set(p, res.value)
    }
    setRateLimits(map)
  }, [])

  useEffect(() => {
    void load()
    void loadRateLimits()
    const unsub1 = ipc.on('job:published', () => void load())
    const unsub2 = ipc.on('job:failed', () => void load())
    return () => {
      unsub1()
      unsub2()
    }
  }, [load, loadRateLimits])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = new Date(year, month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const dayPosts: DayPost[] = posts
    .filter((p) => {
      const dt = new Date(p.scheduledAt ?? p.createdAt)
      return (
        dt.getFullYear() === year &&
        dt.getMonth() === month &&
        dt.getDate() === selectedDay
      )
    })
    .map(toDayPost)
    .sort((a, b) => a.hour - b.hour)

  const hasPosts = (d: number): boolean =>
    posts.some((p) => {
      const dt = new Date(p.scheduledAt ?? p.createdAt)
      return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === d
    })

  const scheduledCount = posts.filter((p) => p.status === PostStatus.SCHEDULED).length
  const draftCount = posts.filter(
    (p) => p.status === PostStatus.DRAFT || p.status === PostStatus.PENDING_APPROVAL,
  ).length
  const publishedCount = posts.filter((p) => p.status === PostStatus.PUBLISHED).length

  const isToday = (d: number): boolean =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const selDate = new Date(year, month, selectedDay)
  const dayName = selDate.toLocaleString('en-US', { weekday: 'short' })
  const monthName = selDate.toLocaleString('en-US', { month: 'long' })

  const prevMonth = (): void => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }
  const nextMonth = (): void => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  const RATE_ROWS: { platform: Platform; label: string }[] = [
    { platform: Platform.LINKEDIN, label: 'LinkedIn' },
    { platform: Platform.TWITTER, label: 'X' },
    { platform: Platform.INSTAGRAM, label: 'Instagram' },
  ]

  return (
    <div
      className="fade-in"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 24,
        height: '100%',
        padding: '24px 28px',
        overflow: 'hidden',
      }}
    >
      {/* ── DAY DETAIL ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {dayName}, {monthName} {selectedDay}
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{dayPosts.length} scheduled</div>
        </div>

        <div className="card" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  animation: 'spin 900ms linear infinite',
                  display: 'inline-block',
                }}
              />
            </div>
          ) : dayPosts.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 14px',
                  borderRadius: 12,
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)',
                }}
              >
                <CalendarDays size={20} style={{ color: 'var(--text-3)' }} />
              </div>
              <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>
                Nothing scheduled
              </div>
              <div style={{ marginTop: 4 }}>Open Composer to draft and schedule a post.</div>
              <button
                className="btn primary"
                style={{ marginTop: 18 }}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('nav', { detail: 'composer' }))
                }
              >
                Open Composer
              </button>
            </div>
          ) : (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dayPosts.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  onDelete={async () => {
                    await ipc.invoke(IPC_CHANNELS.POST_DELETE, { id: p.id })
                    setPosts((prev) => prev.filter((x) => x.id !== p.id))
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
        {/* Mini calendar */}
        <div className="card" style={{ padding: 14, flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-3)',
                fontWeight: 600,
              }}
            >
              {monthLabel}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn ghost icon"
                style={{ width: 26, height: 26, padding: 0 }}
                onClick={prevMonth}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="btn ghost icon"
                style={{ width: 26, height: 26, padding: 0 }}
                onClick={nextMonth}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7,1fr)',
              gap: 4,
              marginBottom: 6,
            }}
          >
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div
                key={d}
                style={{
                  fontSize: 10,
                  color: 'var(--text-3)',
                  textAlign: 'center',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />
              const isSel = d === selectedDay
              const today_ = isToday(d)
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(d)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    background: isSel
                      ? 'var(--accent)'
                      : today_
                        ? 'var(--accent-soft)'
                        : 'transparent',
                    color: isSel ? '#fff' : today_ ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 12,
                    fontWeight: isSel || today_ ? 600 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {d}
                  {hasPosts(d) && !isSel && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Rate limits */}
        <div className="card" style={{ padding: 14, flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Rate limits
          </div>
          {rateLimits.size === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>
              Connect accounts to see rate limits
            </div>
          ) : (
            RATE_ROWS.map(({ platform, label }) => {
              const rl = rateLimits.get(platform)
              if (!rl) return null
              const pct = Math.round((rl.remaining / rl.limit) * 100)
              const Icon = ICONS[platform]
              const color = COLORS[platform]
              return (
                <div key={platform} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Icon size={12} /> {label}
                    </span>
                    <span className="mono" style={{ color: 'var(--text-3)' }}>
                      {rl.remaining}/{rl.limit}
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="fill"
                      style={{
                        width: pct + '%',
                        background: rl.exceeded ? 'var(--error)' : color,
                      }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* This Week */}
        <div className="card" style={{ padding: 14, flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            This Week
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{scheduledCount}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Scheduled</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{draftCount}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Drafts</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
                {publishedCount}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Published</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
