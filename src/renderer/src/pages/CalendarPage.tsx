import { useState, useEffect, type ReactElement } from 'react'
import {
  CalendarDays, Clock, Briefcase, AtSign, Camera,
  CheckCircle, AlertCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import { Platform } from '@shared/types/platform'

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera,
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  [PostStatus.DRAFT]:            { color: 'var(--color-text-muted)',     label: 'Draft' },
  [PostStatus.PENDING_APPROVAL]: { color: 'var(--color-warning)',        label: 'Pending' },
  [PostStatus.APPROVED]:         { color: 'var(--color-info)',           label: 'Approved' },
  [PostStatus.SCHEDULED]:        { color: 'var(--color-brand-primary)',  label: 'Scheduled' },
  [PostStatus.PUBLISHING]:       { color: 'var(--color-warning)',        label: 'Publishing' },
  [PostStatus.PUBLISHED]:        { color: 'var(--color-success)',        label: 'Published' },
  [PostStatus.FAILED]:           { color: 'var(--color-error)',          label: 'Failed' },
  [PostStatus.ARCHIVED]:         { color: 'var(--color-text-muted)',     label: 'Archived' },
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(posts: Post[]): Map<string, Post[]> {
  const map = new Map<string, Post[]>()
  const sorted = [...posts].sort((a, b) => {
    const da = a.scheduledAt ?? a.createdAt
    const db = b.scheduledAt ?? b.createdAt
    return new Date(da).getTime() - new Date(db).getTime()
  })
  for (const post of sorted) {
    const key = fmtDate(post.scheduledAt ?? post.createdAt)
    const arr = map.get(key) ?? []
    arr.push(post)
    map.set(key, arr)
  }
  return map
}

function MiniCalendar({ posts }: { posts: Post[] }): ReactElement {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = firstDay.getDay()
  const monthLabel = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const postDays = new Set(
    posts
      .map((p) => {
        const d = new Date(p.scheduledAt ?? p.createdAt)
        if (d.getFullYear() === year && d.getMonth() === month) return d.getDate()
        return null
      })
      .filter((x): x is number => x !== null),
  )

  const prevMonth = (): void => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1)
  }
  const nextMonth = (): void => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (d: number): boolean =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="btn btn-ghost btn-icon">
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{monthLabel}</span>
        <button onClick={nextMonth} className="btn btn-ghost btn-icon">
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-[9px] text-center text-[var(--color-text-muted)] py-1 font-semibold tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) =>
          d === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <div
              key={d}
              className="relative flex flex-col items-center justify-center aspect-square rounded-lg text-[11px] transition-colors"
              style={{
                color: isToday(d)
                  ? '#fff'
                  : postDays.has(d)
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-muted)',
                background: isToday(d)
                  ? 'var(--color-brand-primary)'
                  : 'transparent',
                fontWeight: isToday(d) || postDays.has(d) ? '600' : '400',
              }}
            >
              {d}
              {postDays.has(d) && !isToday(d) && (
                <div
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ background: 'var(--color-brand-primary)' }}
                />
              )}
            </div>
          ),
        )}
      </div>

      {postDays.size > 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-4 text-center">
          {postDays.size} day{postDays.size !== 1 ? 's' : ''} with posts this month
        </p>
      )}
    </div>
  )
}

export default function CalendarPage(): ReactElement {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    const res = await ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 100 })
    if (res.ok) setPosts(res.value)
    else setError(res.error.message)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const scheduled = posts.filter((p) =>
    [PostStatus.SCHEDULED, PostStatus.APPROVED, PostStatus.PUBLISHED, PostStatus.FAILED].includes(p.status as PostStatus),
  )
  const drafts = posts.filter((p) =>
    [PostStatus.DRAFT, PostStatus.PENDING_APPROVAL].includes(p.status as PostStatus),
  )
  const grouped = groupByDate(scheduled)

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">{posts.length} posts · {scheduled.length} scheduled</p>
        </div>
        <button onClick={load} className="btn btn-ghost btn-icon" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="empty-state flex-1">
          <Loader2 size={22} className="animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : error ? (
        <div className="empty-state flex-1">
          <div className="empty-icon-wrap">
            <AlertCircle size={22} className="text-[var(--color-error)]" />
          </div>
          <p className="empty-title">Failed to load</p>
          <p className="empty-text">{error}</p>
          <button onClick={load} className="btn btn-secondary btn-sm">Retry</button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Timeline */}
          <div className="flex-1 page-body space-y-5">
            {grouped.size === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrap">
                  <CalendarDays size={24} />
                </div>
                <p className="empty-title">Nothing scheduled</p>
                <p className="empty-text">Create a post in Composer and schedule it — it will appear here.</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('nav', { detail: 'composer' }))}
                >
                  Open Composer
                </button>
              </div>
            ) : (
              [...grouped.entries()].map(([date, datePosts]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {date}
                    </span>
                    <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {datePosts.length} post{datePosts.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2 pl-1">
                    {datePosts.map((post) => {
                      const dt = post.scheduledAt ?? post.createdAt
                      const cfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG[PostStatus.DRAFT]
                      return (
                        <div
                          key={post.id}
                          className="glass-card p-4 rounded-xl"
                          style={{ borderLeft: `3px solid ${cfg.color}` }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 leading-snug">
                                {post.body}
                              </p>
                              <div className="flex items-center gap-3 mt-2.5">
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                  style={{ color: cfg.color, background: `${cfg.color}18` }}
                                >
                                  {cfg.label}
                                </span>
                                <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                                  <Clock size={9} />
                                  {fmtTime(dt)}
                                </div>
                                {post.status === PostStatus.PUBLISHED && (
                                  <CheckCircle size={11} className="text-[var(--color-success)]" />
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0 pt-0.5">
                              {post.platforms.map((p) => {
                                const Icon = PLATFORM_ICONS[p]
                                return Icon ? <Icon key={p} size={12} className="opacity-50" /> : null
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right sidebar: mini calendar + drafts */}
          <div
            className="w-64 flex flex-col flex-shrink-0"
            style={{ borderLeft: '1px solid var(--color-border-subtle)' }}
          >
            <div className="sub-panel-header">
              <CalendarDays size={12} className="text-[var(--color-text-muted)]" />
              <span className="sub-panel-title">Overview</span>
            </div>
            <MiniCalendar posts={posts} />

            {drafts.length > 0 && (
              <>
                <div
                  className="sub-panel-header"
                  style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                >
                  <span className="sub-panel-title">Unscheduled ({drafts.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto py-3 space-y-2" style={{ paddingLeft: 12, paddingRight: 12 }}>
                  {drafts.map((post) => (
                    <div
                      key={post.id}
                      className="glass-card p-3 rounded-xl"
                      style={{ borderLeft: '2px solid var(--color-warning)' }}
                    >
                      <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                        {post.body}
                      </p>
                      <span className="text-[9px] text-[var(--color-warning)] mt-1.5 block font-semibold uppercase tracking-wide">
                        {STATUS_CONFIG[post.status]?.label ?? post.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
