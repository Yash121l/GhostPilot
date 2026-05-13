import { useState, useEffect, useCallback, type ReactElement } from 'react'
import {
  Briefcase, AtSign, Camera, RefreshCw, Loader2,
  CheckCircle, AlertTriangle, XCircle, Link2, Unlink,
  ShieldCheck, BarChart2,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { ConnectionInfo, RateLimitInfo } from '@shared/ipc-types'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'

// ─── Static platform metadata ─────────────────────────────────────────────────

const PLATFORM_DEFS = [
  {
    platform: Platform.LINKEDIN,
    icon: Briefcase,
    color: '#0077B5',
    bg: 'rgba(0,119,181,0.08)',
    description: 'Professional posts, articles, and thought leadership',
    scopes: 'Read profile · Write posts',
  },
  {
    platform: Platform.TWITTER,
    icon: AtSign,
    color: '#1D9BF0',
    bg: 'rgba(29,155,240,0.08)',
    description: 'Tweets, threads, and real-time engagement',
    scopes: 'Read · Write tweets · Moderate',
  },
  {
    platform: Platform.INSTAGRAM,
    icon: Camera,
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.08)',
    description: 'Visual content, carousels, and caption publishing',
    scopes: 'Basic · Content Publish · Insights',
  },
] as const

type ConnStatus = 'active' | 'expiring' | 'disconnected'

function resolveStatus(conn: ConnectionInfo | undefined): ConnStatus {
  if (!conn?.connected) return 'disconnected'
  if (conn.needsReauth) return 'expiring'
  return 'active'
}

const STATUS_META: Record<ConnStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  active:       { label: 'Active',         color: 'var(--color-success)',    bg: 'rgba(16,185,129,0.1)', Icon: CheckCircle },
  expiring:     { label: 'Token expiring', color: 'var(--color-warning)',    bg: 'rgba(245,158,11,0.1)', Icon: AlertTriangle },
  disconnected: { label: 'Not connected',  color: 'var(--color-text-muted)', bg: 'var(--color-surface-3)', Icon: XCircle },
}

// ─── Platform connection card ─────────────────────────────────────────────────

interface CardProps {
  def: (typeof PLATFORM_DEFS)[number]
  conn: ConnectionInfo | undefined
  rateLimit: RateLimitInfo | undefined
  onRefresh: () => void
}

function ConnectionCard({ def, conn, rateLimit, onRefresh }: CardProps): ReactElement {
  const [connecting, setConnecting]       = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [cardError, setCardError]         = useState<string | null>(null)

  const Icon      = def.icon
  const status    = resolveStatus(conn)
  const meta      = STATUS_META[status]
  const StatusIcon = meta.Icon

  const ratePct = rateLimit
    ? Math.max(0, Math.round((rateLimit.remaining / rateLimit.limit) * 100))
    : null

  const handleConnect = async (): Promise<void> => {
    setConnecting(true)
    setCardError(null)
    const res = await ipc.invoke(IPC_CHANNELS.AUTH_CONNECT, { platform: def.platform })
    setConnecting(false)
    if (!res.ok) setCardError(res.error.message)
  }

  const handleDisconnect = async (): Promise<void> => {
    setDisconnecting(true)
    setCardError(null)
    const res = await ipc.invoke(IPC_CHANNELS.CONNECTIONS_REVOKE, { platform: def.platform })
    setDisconnecting(false)
    if (res.ok) onRefresh()
    else setCardError(res.error.message)
  }

  return (
    <div
      className="glass-card"
      style={{
        padding: '16px 20px',
        borderLeft: `3px solid ${conn?.connected ? def.color : 'var(--color-border)'}`,
      }}
    >
      <div className="flex items-start gap-4 min-w-0">
        {/* Platform icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: conn?.connected ? def.bg : 'var(--color-surface-3)' }}
        >
          <Icon size={18} style={{ color: conn?.connected ? def.color : 'var(--color-text-muted)' }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {PLATFORM_LABELS[def.platform]}
            </p>
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
              style={{ color: meta.color, background: meta.bg }}
            >
              <StatusIcon size={9} />
              {meta.label}
            </span>
          </div>

          {conn?.connected && conn.displayName && (
            <p className="text-xs font-medium mb-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
              {conn.displayName}
            </p>
          )}

          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {conn?.connected ? def.scopes : def.description}
          </p>

          {/* Rate-limit bar */}
          {conn?.connected && ratePct !== null && (
            <div className="flex items-center gap-2 mt-2.5">
              <BarChart2
                size={10}
                style={{ color: rateLimit?.exceeded ? 'var(--color-error)' : 'var(--color-text-muted)' }}
              />
              <div className="progress-track" style={{ width: 88, flexShrink: 0 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${ratePct}%`,
                    background: rateLimit?.exceeded ? 'var(--color-error)' : def.color,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                {rateLimit?.remaining}/{rateLimit?.limit}
              </span>
              {rateLimit?.exceeded && (
                <span className="text-[10px] shrink-0" style={{ color: 'var(--color-error)' }}>
                  Rate limited
                </span>
              )}
            </div>
          )}

          {cardError && (
            <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--color-error)' }}>
              <XCircle size={10} className="shrink-0 mt-0.5" />
              <span className="line-clamp-2">{cardError}</span>
            </p>
          )}
        </div>

        {/* Actions — column to prevent overflow */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          {conn?.connected ? (
            <>
              {status === 'expiring' && (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="btn btn-secondary btn-sm"
                >
                  {connecting
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Link2 size={11} />}
                  Reconnect
                </button>
              )}
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--color-error)' }}
              >
                {disconnecting
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Unlink size={11} />}
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn btn-primary btn-sm"
            >
              {connecting
                ? <Loader2 size={11} className="animate-spin" />
                : <Link2 size={11} />}
              {connecting ? 'Opening…' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage(): ReactElement {
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [rateLimits, setRateLimits]   = useState<Map<Platform, RateLimitInfo>>(new Map())
  const [loading, setLoading]         = useState(true)
  const [pageError, setPageError]     = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setPageError(null)

    const [connRes, liRes, twRes, igRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.CONNECTIONS_LIST, {}),
      ipc.invoke(IPC_CHANNELS.CONNECTIONS_RATE_LIMIT_STATE, { platform: Platform.LINKEDIN }),
      ipc.invoke(IPC_CHANNELS.CONNECTIONS_RATE_LIMIT_STATE, { platform: Platform.TWITTER }),
      ipc.invoke(IPC_CHANNELS.CONNECTIONS_RATE_LIMIT_STATE, { platform: Platform.INSTAGRAM }),
    ])

    if (connRes.ok) {
      setConnections(connRes.value)
    } else {
      setPageError(connRes.error.message)
    }

    const map = new Map<Platform, RateLimitInfo>()
    if (liRes.ok) map.set(Platform.LINKEDIN, liRes.value)
    if (twRes.ok) map.set(Platform.TWITTER, twRes.value)
    if (igRes.ok) map.set(Platform.INSTAGRAM, igRes.value)
    setRateLimits(map)

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const unsub = window.api.on('auth:connected', () => { load() })
    return () => { unsub() }
  }, [load])

  const connectedCount = connections.filter((c) => c.connected).length

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Connect Accounts</h1>
          <p className="page-subtitle">
            {connectedCount === 0
              ? 'Link your social accounts to start publishing'
              : `${connectedCount} of ${PLATFORM_DEFS.length} platforms connected`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn btn-ghost btn-icon"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 600 }}>
          {pageError && (
            <div
              className="flex items-center gap-2 text-xs px-4 py-3 rounded-xl mb-6"
              style={{
                color: 'var(--color-error)',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <AlertTriangle size={13} className="shrink-0" />
              <span className="flex-1 min-w-0 line-clamp-2">{pageError}</span>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <Loader2 size={22} className="animate-spin text-[var(--color-primary)]" />
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <p className="section-label">Platforms</p>
                <div className="space-y-3">
                  {PLATFORM_DEFS.map((def) => (
                    <ConnectionCard
                      key={def.platform}
                      def={def}
                      conn={connections.find((c) => c.platform === def.platform)}
                      rateLimit={rateLimits.get(def.platform)}
                      onRefresh={load}
                    />
                  ))}
                </div>
              </section>

              <section>
                <p className="section-label flex items-center gap-2">
                  <ShieldCheck size={11} />
                  Privacy &amp; Security
                </p>
                <div
                  className="glass-card text-xs leading-relaxed space-y-2"
                  style={{ padding: '16px 20px', color: 'var(--color-text-muted)' }}
                >
                  <p>
                    OAuth tokens are stored exclusively in your OS keychain (macOS Keychain / Windows
                    Credential Manager / libsecret on Linux). They are{' '}
                    <strong style={{ color: 'var(--color-text-secondary)' }}>never uploaded</strong> to
                    any server or stored in the database.
                  </p>
                  <p>
                    All publishing requests originate directly from this machine. Disconnecting
                    immediately deletes the local token.
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
