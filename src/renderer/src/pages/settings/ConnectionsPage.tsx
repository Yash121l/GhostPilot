import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { Briefcase, AtSign, Camera, Link2, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import { Platform } from '@shared/types/platform'

interface PlatformDef {
  id: Platform
  name: string
  desc: string
  Icon: React.ElementType
  color: string
  bg: string
}

const PLATFORMS: PlatformDef[] = [
  {
    id: Platform.LINKEDIN,
    name: 'LinkedIn',
    Icon: Briefcase,
    desc: 'Professional posts, articles, and thought leadership',
    color: 'var(--linkedin)',
    bg: 'var(--linkedin-soft)'
  },
  {
    id: Platform.TWITTER,
    name: 'X (Twitter)',
    Icon: AtSign,
    desc: 'Tweets, threads, and real-time engagement',
    color: '#111',
    bg: 'var(--twitter-soft)'
  },
  {
    id: Platform.INSTAGRAM,
    name: 'Instagram',
    Icon: Camera,
    desc: 'Visual content, carousels, and caption publishing',
    color: 'var(--instagram)',
    bg: 'var(--instagram-soft)'
  }
]

export default function ConnectionsPage(): ReactElement {
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [connecting, setConnecting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {})
    if (res.ok) {
      const map: Record<string, boolean> = {}
      for (const c of res.value) map[c.platform] = c.connected
      setConnected(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const unsub = window.api?.on('auth:connected', () => {
      void load()
    })
    return () => {
      unsub?.()
    }
  }, [load])

  const handleConnect = async (platform: Platform): Promise<void> => {
    setConnecting(platform)
    await ipc.invoke(IPC_CHANNELS.AUTH_CONNECT, { platform })
    setConnecting(null)
    void load()
  }

  const handleDisconnect = async (platform: Platform): Promise<void> => {
    setConnecting(platform)
    await ipc.invoke(IPC_CHANNELS.CONNECTIONS_REVOKE, { platform })
    setConnecting(null)
    void load()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Connect</h1>
          <p className="page-subtitle">Link your social accounts to start publishing</p>
        </div>
        <button onClick={load} disabled={loading} className="btn ghost icon">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="page-body">
        <div className="fade-in" style={{ maxWidth: 780 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600,
              marginBottom: 12
            }}
          >
            Platforms
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : (
              PLATFORMS.map((p) => {
                const isConnected = connected[p.id] ?? false
                const isConnecting = connecting === p.id
                return (
                  <div
                    key={p.id}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: p.bg,
                        color: p.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <p.Icon size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                        {isConnected ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--success)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: 500
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--success)'
                              }}
                            />
                            Connected
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            ✕ Not connected
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                        {p.desc}
                      </div>
                    </div>
                    {isConnected ? (
                      <button
                        className="btn danger"
                        disabled={isConnecting}
                        onClick={() => handleDisconnect(p.id)}
                      >
                        {isConnecting ? <Loader2 size={13} className="animate-spin" /> : null}
                        Disconnect
                      </button>
                    ) : (
                      <button
                        className="btn primary"
                        disabled={isConnecting}
                        onClick={() => handleConnect(p.id)}
                      >
                        {isConnecting ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Link2 size={14} />
                        )}
                        {isConnecting ? 'Opening…' : 'Connect'}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600,
              marginBottom: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <ShieldCheck size={12} /> Privacy &amp; Security
          </div>
          <div
            className="card"
            style={{ padding: 18, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}
          >
            <p style={{ margin: '0 0 10px' }}>
              OAuth tokens are stored exclusively in your OS keychain (macOS Keychain / Windows
              Credential Manager / libsecret on Linux). They are <strong>never uploaded</strong> to
              any server or stored in the database.
            </p>
            <p style={{ margin: 0 }}>
              All publishing requests originate directly from this machine. Disconnecting
              immediately deletes the local token.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
