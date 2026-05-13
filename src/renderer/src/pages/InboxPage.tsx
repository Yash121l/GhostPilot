import { useState, useEffect, type ReactElement } from 'react'
import { Inbox, Briefcase, AtSign, Camera, RefreshCw, Loader2, CheckCircle, MessageSquare } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { AuthStatusOutput } from '@shared/ipc-types'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera,
}

function ConnectButton({ platform, connected }: { platform: Platform; connected: boolean; onConnect: () => void }): ReactElement {
  const [connecting, setConnecting] = useState(false)
  const Icon = PLATFORM_ICONS[platform]

  const handleClick = async (): Promise<void> => {
    if (connected) return
    setConnecting(true)
    await ipc.invoke(IPC_CHANNELS.AUTH_CONNECT, { platform })
    // OAuth opens in browser — connection confirmed via 'auth:connected' event
    setConnecting(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={connected || connecting}
      className="flex items-center gap-3 w-full p-4 rounded-xl transition-all text-left"
      style={{
        background: connected ? 'hsla(142,71%,45%,0.1)' : 'hsla(225,12%,13%,0.6)',
        border: `1px solid ${connected ? 'hsla(142,71%,45%,0.3)' : 'var(--color-border-subtle)'}`,
        cursor: connected ? 'default' : 'pointer',
      }}
    >
      <Icon size={16} className={connected ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'} />
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
          {PLATFORM_LABELS[platform]}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {connected ? 'Connected' : connecting ? 'Opening browser…' : 'Click to connect'}
        </p>
      </div>
      {connected && <CheckCircle size={14} className="text-[var(--color-success)]" />}
      {connecting && <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" />}
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
    // Listen for OAuth completion events
    const unsub = window.api?.on('auth:connected', loadStatus)
    return () => unsub?.()
  }, [])

  const connectedCount = connections.filter((c) => c.connected).length

  return (
    <div className="flex flex-col h-full animate-slide-up">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-base font-semibold text-white/90">Inbox</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{connectedCount} platform{connectedCount !== 1 ? 's' : ''} connected</p>
        </div>
        <button onClick={loadStatus} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <RefreshCw size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : (
          <div className="max-w-md space-y-6">
            <div>
              <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Platform Connections</h2>
              <div className="space-y-2">
                {connections.map((c) => (
                  <ConnectButton
                    key={c.platform}
                    platform={c.platform}
                    connected={c.connected}
                    onConnect={loadStatus}
                  />
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                Clicking "Connect" opens the platform's OAuth page in your system browser. Tokens are stored in your OS keychain — never on any server.
              </p>
            </div>

            {connectedCount > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare size={12} />
                  Engagement Queue
                </h2>
                <div className="flex flex-col items-center py-8 text-center glass-card rounded-2xl">
                  <Inbox size={24} className="text-[var(--color-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">No pending replies</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Auto-reply and DM funnels coming in Phase 2
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
