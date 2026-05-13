import { useState, useEffect, useCallback, type ReactElement } from 'react'
import {
  CalendarDays, Clock, Briefcase, AtSign, Camera,
  CheckCircle, AlertCircle, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import { Platform } from '@shared/types/platform'
import type { RateLimitInfo } from '@shared/ipc-types'

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera,
}

const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.LINKEDIN]: '#0077B5',
  [Platform.TWITTER]: '#1D9BF0',
  [Platform.INSTAGRAM]: '#E1306C',
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  [PostStatus.DRAFT]:            { color: 'var(--color-text-muted)', label: 'Draft' },
  [PostStatus.PENDING_APPROVAL]: { color: 'var(--color-warning)',    label: 'Pending' },
  [PostStatus.APPROVED]:         { color: 'var(--color-info)',       label: 'Approved' },
  [PostStatus.SCHEDULED]:        { color: 'var(--color-primary)',    label: 'Scheduled' },
  [PostStatus.PUBLISHING]:       { color: 'var(--color-warning)',    label: 'Publishing' },
  [PostStatus.PUBLISHED]:        { color: 'var(--color-success)',    label: 'Published' },
  [PostStatus.FAILED]:           { color: 'var(--color-error)',      label: 'Failed' },
  [PostStatus.ARCHIVED]:         { color: 'var(--color-text-muted)', label: 'Archived' },
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(d: Date | string): string {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
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

// ─── Draggable post card ─────────────────────────────────────────────────────

function DraggablePostCard({ post, rateLimits }: { post: Post; rateLimits: Map<Platform, RateLimitInfo> }): ReactElement {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id })
  const cfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG[PostStatus.DRAFT]
  const dt = post.scheduledAt ?? post.createdAt

  // Check if any platform in this post has exceeded rate limit
  const hasRateLimitIssue = post.platforms.some((p) => rateLimits.get(p)?.exceeded)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="glass-card p-4 rounded-xl cursor-grab active:cursor-grabbing"
      style={{
        borderLeft: `3px solid ${hasRateLimitIssue ? 'var(--color-error)' : cfg.color}`,
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none',
      }}
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
            {post.status === PostStatus.PUBLISHED && <CheckCircle size={11} className="text-[var(--color-success)]" />}
            {hasRateLimitIssue && (
              <span className="text-[10px]" style={{ color: 'var(--color-error)' }}>⚠ Rate limit</span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0 pt-0.5">
          {post.platforms.map((p) => {
            const Icon = PLATFORM_ICONS[p]
            const limited = rateLimits.get(p)?.exceeded
            return Icon ? (
              <Icon key={p} size={12} style={{ opacity: limited ? 1 : 0.5, color: limited ? 'var(--color-error)' : PLATFORM_COLORS[p] }} />
            ) : null
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Droppable date slot ──────────────────────────────────────────────────────

function DroppableDateSlot({ date, label, posts, rateLimits, isOver }: {
  date: string
  label: string
  posts: Post[]
  rateLimits: Map<Platform, RateLimitInfo>
  isOver: boolean
}): ReactElement {
  const { setNodeRef } = useDroppable({ id: `slot-${date}` })

  return (
    <div ref={setNodeRef}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: isOver ? 'var(--color-primary)' : 'var(--color-border)' }}
        />
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {posts.length} post{posts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div
        className="space-y-2 pl-1 rounded-xl transition-colors"
        style={{
          minHeight: 60,
          padding: isOver ? '8px' : undefined,
          background: isOver ? 'rgba(99,102,241,0.04)' : undefined,
          border: isOver ? '1.5px dashed var(--color-primary)' : undefined,
        }}
      >
        {posts.map((post) => (
          <DraggablePostCard key={post.id} post={post} rateLimits={rateLimits} />
        ))}
        {posts.length === 0 && isOver && (
          <p className="text-[11px] text-[var(--color-primary)] text-center py-2">Drop here to reschedule</p>
        )}
      </div>
    </div>
  )
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

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

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (d: number): boolean =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)} className="btn btn-ghost btn-icon">
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{monthLabel}</span>
        <button onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)} className="btn btn-ghost btn-icon">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-[9px] text-center text-[var(--color-text-muted)] py-1 font-semibold tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) =>
          d === null ? <div key={`e${i}`} /> : (
            <div
              key={d}
              className="relative flex flex-col items-center justify-center aspect-square rounded-lg text-[11px] transition-colors"
              style={{
                color: isToday(d) ? '#fff' : postDays.has(d) ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                background: isToday(d) ? 'var(--color-primary)' : 'transparent',
                fontWeight: isToday(d) || postDays.has(d) ? '600' : '400',
              }}
            >
              {d}
              {postDays.has(d) && !isToday(d) && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: 'var(--color-primary)' }} />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage(): ReactElement {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimits, setRateLimits] = useState<Map<Platform, RateLimitInfo>>(new Map())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overSlot, setOverSlot] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    const res = await ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 200 })
    if (res.ok) setPosts(res.value)
    else setError(res.error.message)
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
    load()
    loadRateLimits()
  }, [load, loadRateLimits])

  // Listen for publisher events
  useEffect(() => {
    const unsub1 = ipc.on('job:published', () => { load() })
    const unsub2 = ipc.on('job:failed', () => { load() })
    return () => { unsub1(); unsub2() }
  }, [load])

  const handleDragStart = ({ active }: DragStartEvent): void => {
    setActiveId(active.id as string)
  }

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent): Promise<void> => {
    setActiveId(null)
    setOverSlot(null)
    if (!over) return

    const overId = over.id as string
    if (!overId.startsWith('slot-')) return

    const slotDate = overId.replace('slot-', '')
    const post = posts.find((p) => p.id === active.id)
    if (!post || !post.scheduledAt) return

    // Reschedule: keep same time, change date
    const orig = new Date(post.scheduledAt)
    const [y, mo, d] = slotDate.split('-').map(Number)
    const newDt = new Date(y, mo - 1, d, orig.getHours(), orig.getMinutes())

    if (newDt.getTime() === orig.getTime()) return

    // Pick the first variant matching the first platform
    const platform = post.platforms[0]
    const variant = post.variants.find((v) => v.platform === platform)
    if (!variant) return

    const res = await ipc.invoke(IPC_CHANNELS.POST_SCHEDULE, {
      postId: post.id,
      variantId: variant.id,
      platform,
      scheduledAt: newDt.toISOString(),
    })

    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) => p.id === post.id ? { ...p, scheduledAt: newDt } : p),
      )
    }
  }, [posts])

  const scheduled = posts.filter((p) =>
    [PostStatus.SCHEDULED, PostStatus.APPROVED, PostStatus.PUBLISHED, PostStatus.FAILED].includes(p.status as PostStatus),
  )
  const drafts = posts.filter((p) =>
    [PostStatus.DRAFT, PostStatus.PENDING_APPROVAL].includes(p.status as PostStatus),
  )
  const grouped = groupByDate(scheduled)

  const activePost = activeId ? posts.find((p) => p.id === activeId) : null

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
          <span className="w-5 h-5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin inline-block" />
        </div>
      ) : error ? (
        <div className="empty-state flex-1">
          <div className="empty-icon-wrap"><AlertCircle size={22} className="text-[var(--color-error)]" /></div>
          <p className="empty-title">Failed to load</p>
          <p className="empty-text">{error}</p>
          <button onClick={load} className="btn btn-secondary btn-sm">Retry</button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={({ over }) => setOverSlot(over ? (over.id as string) : null)}
        >
          <div className="flex flex-1 overflow-hidden">
            {/* Timeline */}
            <div className="flex-1 page-body space-y-5">
              {grouped.size === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon-wrap"><CalendarDays size={24} /></div>
                  <p className="empty-title">Nothing scheduled</p>
                  <p className="empty-text">Create a post in Composer and schedule it.</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent('nav', { detail: 'composer' }))}
                  >
                    Open Composer
                  </button>
                </div>
              ) : (
                [...grouped.entries()].map(([dateLabel, datePosts]) => {
                  const slotDate = dayKey(datePosts[0].scheduledAt ?? datePosts[0].createdAt)
                  return (
                    <DroppableDateSlot
                      key={dateLabel}
                      date={slotDate}
                      label={dateLabel}
                      posts={datePosts}
                      rateLimits={rateLimits}
                      isOver={overSlot === `slot-${slotDate}`}
                    />
                  )
                })
              )}
            </div>

            {/* Right sidebar */}
            <div
              className="w-64 flex flex-col flex-shrink-0"
              style={{ borderLeft: '1px solid var(--color-border)' }}
            >
              <div className="sub-panel-header">
                <CalendarDays size={12} className="text-[var(--color-text-muted)]" />
                <span className="sub-panel-title">Overview</span>
              </div>
              <MiniCalendar posts={posts} />

              {/* Rate limit badges */}
              {rateLimits.size > 0 && (
                <>
                  <div className="sub-panel-header" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <span className="sub-panel-title">Rate Limits</span>
                  </div>
                  <div className="px-4 pb-3 space-y-2">
                    {([Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM] as Platform[]).map((p) => {
                      const rl = rateLimits.get(p)
                      if (!rl) return null
                      const pct = Math.round((rl.remaining / rl.limit) * 100)
                      const Icon = PLATFORM_ICONS[p]
                      return (
                        <div key={p} className="flex items-center gap-2">
                          <Icon size={10} style={{ color: rl.exceeded ? 'var(--color-error)' : PLATFORM_COLORS[p] }} />
                          <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--color-border)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: rl.exceeded ? 'var(--color-error)' : PLATFORM_COLORS[p],
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-mono" style={{ color: rl.exceeded ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                            {rl.remaining}/{rl.limit}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {drafts.length > 0 && (
                <>
                  <div className="sub-panel-header" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <span className="sub-panel-title">Unscheduled ({drafts.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto py-3 space-y-2 px-3">
                    {drafts.map((post) => (
                      <div
                        key={post.id}
                        className="glass-card p-3 rounded-xl"
                        style={{ borderLeft: '2px solid var(--color-warning)', cursor: 'pointer' }}
                        onClick={() => window.dispatchEvent(new CustomEvent('nav', { detail: 'composer' }))}
                      >
                        <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">{post.body}</p>
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

          {/* Drag overlay */}
          <DragOverlay>
            {activePost ? (
              <div
                className="glass-card p-4 rounded-xl shadow-lg"
                style={{ borderLeft: `3px solid ${STATUS_CONFIG[activePost.status]?.color ?? 'var(--color-primary)'}`, opacity: 0.9, width: 340 }}
              >
                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{activePost.body}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
