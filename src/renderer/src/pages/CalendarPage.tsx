import { useState, useEffect, type ReactElement } from 'react'
import { CalendarDays, Clock, Briefcase, AtSign, Camera, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import { Platform } from '@shared/types/platform'

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera,
}

const STATUS_COLORS: Record<string, string> = {
  [PostStatus.DRAFT]: 'var(--color-text-muted)',
  [PostStatus.PENDING_APPROVAL]: 'var(--color-warning)',
  [PostStatus.APPROVED]: 'var(--color-info)',
  [PostStatus.SCHEDULED]: 'var(--color-brand-primary)',
  [PostStatus.PUBLISHING]: 'var(--color-warning)',
  [PostStatus.PUBLISHED]: 'var(--color-success)',
  [PostStatus.FAILED]: 'var(--color-error)',
  [PostStatus.ARCHIVED]: 'var(--color-text-muted)',
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(posts: Post[]): Map<string, Post[]> {
  const map = new Map<string, Post[]>()
  const sorted = [...posts].sort((a, b) => {
    const da = a.scheduledAt ?? a.createdAt
    const db_ = b.scheduledAt ?? b.createdAt
    return new Date(da).getTime() - new Date(db_).getTime()
  })
  for (const post of sorted) {
    const date = formatDate(post.scheduledAt ?? post.createdAt)
    const arr = map.get(date) ?? []
    arr.push(post)
    map.set(date, arr)
  }
  return map
}

export default function CalendarPage(): ReactElement {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    const res = await ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 100 })
    if (res.ok) {
      setPosts(res.value)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const grouped = groupByDate(posts.filter((p) =>
    [PostStatus.SCHEDULED, PostStatus.APPROVED, PostStatus.PUBLISHED, PostStatus.FAILED].includes(p.status as PostStatus),
  ))
  const drafts = posts.filter((p) => [PostStatus.DRAFT, PostStatus.PENDING_APPROVAL].includes(p.status as PostStatus))

  return (
    <div className="flex flex-col h-full animate-slide-up">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-base font-semibold text-white/90">Calendar</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{posts.length} posts total</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <RefreshCw size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <div>
            <AlertCircle size={24} className="text-[var(--color-error)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Scheduled / published timeline */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {grouped.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <CalendarDays size={32} className="text-[var(--color-text-muted)] mb-3" />
                <p className="text-sm text-[var(--color-text-muted)]">No scheduled posts yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Create a post in Composer, then schedule it here</p>
              </div>
            ) : (
              [...grouped.entries()].map(([date, datePosts]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {date}
                    </div>
                    <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
                  </div>
                  <div className="space-y-2">
                    {datePosts.map((post) => {
                      const dt = post.scheduledAt ?? post.createdAt
                      const statusColor = STATUS_COLORS[post.status] ?? 'var(--color-text-muted)'
                      return (
                        <div
                          key={post.id}
                          className="glass-card p-4 rounded-xl"
                          style={{ borderLeft: `3px solid ${statusColor}` }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 flex-1">{post.body}</p>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                                <Clock size={10} />
                                {formatTime(dt)}
                              </div>
                              <div className="flex gap-1">
                                {post.platforms.map((p) => {
                                  const Icon = PLATFORM_ICONS[p]
                                  return Icon ? <Icon key={p} size={11} className="opacity-60" /> : null
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: statusColor, background: `${statusColor}20` }}>
                              {post.status}
                            </span>
                            {post.status === PostStatus.PUBLISHED && (
                              <CheckCircle size={11} className="text-[var(--color-success)]" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drafts sidebar */}
          {drafts.length > 0 && (
            <div className="w-64 border-l border-[var(--color-border-subtle)] flex flex-col">
              <div className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">
                Unscheduled Drafts ({drafts.length})
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {drafts.map((post) => (
                  <div
                    key={post.id}
                    className="glass-card p-3 rounded-lg cursor-pointer"
                    style={{ borderLeft: `2px solid var(--color-warning)` }}
                  >
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3">{post.body}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[9px] text-[var(--color-warning)]">{post.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
