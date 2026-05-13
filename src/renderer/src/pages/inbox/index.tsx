import { useState, useEffect, type ReactElement } from 'react'
import {
  Briefcase, AtSign, Camera, RefreshCw, Loader2, CheckCircle,
  MessageSquare, Inbox, Plus, Link2,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { AuthStatusOutput } from '@shared/ipc-types'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'

interface ConnectorDef {
  platform: Platform
  icon: React.ElementType
  description: string
  color: string
  bg: string
}

// Add new platforms here — sidebar and InboxPage auto-update
const CONNECTORS: ConnectorDef[] = [
  {
    platform: Platform.LINKEDIN,
    icon: Briefcase,
    description: 'Professional posts, articles, and thought leadership',
    color: '#0077B5',
    bg: 'rgba(0,119,181,0.08)',
  },
  {
    platform: Platform.TWITTER,
    icon: AtSign,
    description: 'Short-form updates, threads, and real-time engagement',
    color: '#1D9BF0',
    bg: 'rgba(29,155,240,0.08)',
  },
  {
    platform: Platform.INSTAGRAM,
    icon: Camera,
    description: 'Visual content, reels, and story-driven posts',
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.08)',
  },
]

// Platforms planned for Phase 2 — drives UI automatically
const COMING_SOON = [
  { label: 'Threads', description: 'Text-based conversations by Meta' },
  { label: 'Bluesky', description: 'Decentralized social networking' },
  { label: 'YouTube', description: 'Long-form video and Shorts' },
]

function ConnectCard({
  def,
  connected,
}: {
  def: ConnectorDef
  connected: boolean
}): ReactElement {
  const [connecting, setConnecting] = useState(false)
  const Icon = def.icon

  const handleClick = async (): Promise<void> => {
    if (connected || connecting) return
    setConnecting(true)
    await ipc.invoke(IPC_CHANNELS.AUTH_CONNECT, { platform: def.platform })
    setConnecting(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={connected}
      className={`connector-card ${connected ? 'connected' : ''}`}
    >
      <div className="connector-icon" style={{ background: connected ? 'rgba(16,185,129,0.08)' : def.bg }}>
        <Icon
          size={20}
          style={{ color: connected ? 'var(--color-success)' : def.color }}
        />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <p
          className="text-sm font-semibold"
          style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-primary)' }}
        >
          {PLATFORM_LABELS[def.platform]}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-snug">{def.description}</p>
        <p
          className="text-[11px] mt-2 font-medium"
          style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}
        >
          {connected ? 'Connected' : connecting ? 'Opening browser…' : 'Click to connect via OAuth'}
        </p>
      </div>

      <div className="flex items-center shrink-0">
        {connected ? (
          <CheckCircle size={18} className="text-[var(--color-success)]" />
        ) : connecting ? (
          <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" />
        ) : (
          <div
            className="btn btn-secondary btn-sm"
            style={{ pointerEvents: 'none' }}
          >
            <Link2 size={11} />
            Connect
          </div>
        )}
      </div>
    </button>
  )
}

export default function InboxPage(): ReactElement {
  const [connections, setConnections] = useState<AuthStatusOutput[]>([])
  const [loading, setLoading] = useState(true)

  const loadStatus = async (): Promise<void> => {
    setLoading(true)
    const res = await ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {})
    if (res.ok) setConnections(res.value)
    setLoading(false)
  }

  useEffect(() => {
    loadStatus()
    const unsub = window.api?.on('auth:connected', loadStatus)
    return () => unsub?.()
  }, [])

  const connectedCount = connections.filter((c) => c.connected).length

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Connect</h1>
          <p className="page-subtitle">
            {connectedCount === 0
              ? 'Link your social accounts to start publishing'
              : `${connectedCount} of ${CONNECTORS.length} platforms connected`}
          </p>
        </div>
        <button onClick={loadStatus} className="btn btn-ghost btn-icon" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="page-body space-y-6 max-w-xl">
        {loading ? (
          <div className="empty-state">
            <Loader2 size={22} className="animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : (
          <>
            {/* Active connectors */}
            <div>
              <p className="section-label">Platforms</p>
              <div className="flex flex-col gap-3">
                {CONNECTORS.map((def) => {
                  const status = connections.find((c) => c.platform === def.platform)
                  return (
                    <ConnectCard
                      key={def.platform}
                      def={def}
                      connected={status?.connected ?? false}
                    />
                  )
                })}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-4 leading-relaxed">
                OAuth tokens are stored in your OS keychain — they never leave this machine or pass through any server.
              </p>
            </div>

            {/* Engagement queue */}
            {connectedCount > 0 && (
              <div>
                <p className="section-label flex items-center gap-2">
                  <MessageSquare size={11} />
                  Engagement Queue
                </p>
                <div
                  className="glass-card rounded-2xl p-8 flex flex-col items-center text-center"
                >
                  <Inbox size={28} className="text-[var(--color-text-muted)] mb-3" />
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">No pending items</p>
                  <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                    Auto-replies, DM funnels, and engagement suggestions arrive here in Phase 2.
                  </p>
                </div>
              </div>
            )}

            {/* Coming soon */}
            <div>
              <p className="section-label flex items-center gap-2">
                <Plus size={11} />
                Coming Soon
              </p>
              <div className="flex flex-col gap-3">
                {COMING_SOON.map(({ label, description }) => (
                  <div key={label} className="connector-card coming-soon">
                    <div
                      className="connector-icon"
                      style={{ background: 'var(--color-surface-3)' }}
                    >
                      <Link2 size={16} className="text-[var(--color-text-muted)]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
                    </div>
                    <span
                      className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}
                    >
                      Phase 2
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
