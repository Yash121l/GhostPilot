import { useState, useEffect, type ReactElement } from 'react'
import {
  PenTool,
  CalendarDays,
  Link2,
  Target,
  TrendingUp,
  UserCircle2,
  BarChart3,
  Settings,
  DatabaseZap,
  Bot,
  Ghost,
  Briefcase,
  AtSign,
  Camera
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from './lib/ipc'
import type { AuthStatusOutput } from '@shared/ipc-types'
import { Platform } from '@shared/types/platform'

const SIDEBAR_CONNECTORS = [
  { platform: Platform.LINKEDIN, label: 'LinkedIn', icon: Briefcase, color: '#0a66c2' },
  { platform: Platform.TWITTER, label: 'X', icon: AtSign, color: '#1d1d1f' },
  { platform: Platform.INSTAGRAM, label: 'Instagram', icon: Camera, color: '#d6336c' }
]

import ComposerPage from './pages/composer'
import CalendarPage from './pages/calendar'
import GoalsPage from './pages/goals'
import TrendsPage from './pages/trends'
import PersonasPage from './pages/personas'
import AnalyticsPage from './pages/analytics'
import ConnectionsPage from './pages/settings/ConnectionsPage'
import AIProvidersPage from './pages/settings/AIProvidersPage'

type Page =
  | 'composer'
  | 'calendar'
  | 'inbox'
  | 'goals'
  | 'trends'
  | 'personas'
  | 'analytics'
  | 'settings'

interface NavEntry {
  id: Page
  label: string
  icon: React.ElementType
}

const NAV: NavEntry[] = [
  { id: 'composer', label: 'Composer', icon: PenTool },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'inbox', label: 'Connect', icon: Link2 },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'personas', label: 'Personas', icon: UserCircle2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings }
]

const PAGES: Record<Page, ReactElement> = {
  composer: <ComposerPage />,
  calendar: <CalendarPage />,
  inbox: <ConnectionsPage />,
  goals: <GoalsPage />,
  trends: <TrendsPage />,
  personas: <PersonasPage />,
  analytics: <AnalyticsPage />,
  settings: <AIProvidersPage />
}

export default function App(): ReactElement {
  const [page, setPage] = useState<Page>('composer')
  const [connections, setConnections] = useState<AuthStatusOutput[]>([])
  const [aiConfigured, setAiConfigured] = useState(false)
  const [dbOk] = useState(true)
  const [version, setVersion] = useState('...')
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)

  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {}).then((res) => {
      if (res.ok) setConnections(res.value)
    })
    ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}).then((res) => {
      if (res.ok) setAiConfigured(res.value.length > 0)
    })
    ipc.invoke(IPC_CHANNELS.AI_OLLAMA_STATUS, {}).then((res) => {
      if (res.ok && res.value.available) setAiConfigured(true)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api?.getVersion().then((v: string) => setVersion(v))
  }, [])

  useEffect(() => {
    const unsub = window.api?.on('auth:connected', () => {
      ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {}).then((res) => {
        if (res.ok) setConnections(res.value)
      })
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const handler = (e: Event): void => {
      const { hasKeys, ollamaAvailable } = (
        e as CustomEvent<{ hasKeys: boolean; ollamaAvailable: boolean }>
      ).detail
      setAiConfigured(hasKeys || ollamaAvailable)
    }
    window.addEventListener('ai:status-changed', handler)
    return () => window.removeEventListener('ai:status-changed', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<Page | { page: Page; prefill?: string }>).detail
      const target = typeof detail === 'string' ? detail : detail.page
      if (NAV.some((n) => n.id === target)) setPage(target)
    }
    window.addEventListener('nav', handler)
    return () => window.removeEventListener('nav', handler)
  }, [])

  useEffect(() => {
    const unsub = window.api?.on('updater:update-available', (info: unknown) => {
      const { version: v } = info as { version: string }
      setUpdateVersion(v)
    })
    return () => unsub?.()
  }, [])

  const connectedCount = connections.filter((c) => c.connected).length

  return (
    <div className="app-shell">
      {/* ── Titlebar ── */}
      <header className="titlebar">
        <div className="titlebar-title">GhostPilot</div>
      </header>

      {/* ── Sidebar ── */}
      <nav className="sidebar" aria-label="Main navigation">
        {/* Brand */}
        <div className="brand">
          <div className="brand-mark">
            <Ghost size={20} strokeWidth={1.6} />
          </div>
          <div className="brand-name">GHOSTPILOT</div>
        </div>

        {/* Nav */}
        <div className="nav-section">Workspace</div>
        <div className="nav">
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = page === item.id
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
              >
                <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="nav-spacer" />

        {/* Connections */}
        <div className="connections">
          <div className="sidebar-header">Connections</div>
          {SIDEBAR_CONNECTORS.map((p) => {
            const connected = connections.find((c) => c.platform === p.platform)?.connected
            const Icon = p.icon
            return (
              <div key={p.platform} className="connection-item" onClick={() => setPage('inbox')}>
                <Icon
                  size={13}
                  style={{ color: connected ? p.color : 'var(--text-4)', flexShrink: 0 }}
                />
                <span
                  className="connection-label"
                  style={{ color: connected ? 'var(--text-2)' : 'var(--text-4)' }}
                >
                  {p.label}
                </span>
                <div className={`connection-dot ${connected ? 'on' : ''}`} />
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="main-content" key={page}>
        <div className="animate-slide-up h-full">{PAGES[page]}</div>
      </main>

      {/* ── Update notification ── */}
      {updateVersion && (
        <div style={{
          position: 'fixed', bottom: 36, right: 16, zIndex: 9999,
          background: 'var(--bg-card)', border: '1px solid var(--accent)',
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: 'var(--text-2)' }}>
            Update <strong>v{updateVersion}</strong> available
          </span>
          <button
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(window as any).api.invoke('updater:open-releases', {})
            }}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '5px 12px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Download
          </button>
          <button
            onClick={() => setUpdateVersion(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-3)',
              cursor: 'pointer', fontSize: 14, lineHeight: '1', padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Status bar ── */}
      <footer className="statusbar select-none">
        <span className="ok">
          <DatabaseZap size={11} />
          DB: {dbOk ? 'Connected' : 'Error'}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: aiConfigured ? 'var(--success)' : 'var(--text-3)'
          }}
        >
          <Bot size={11} />
          AI: {aiConfigured ? 'Ready' : 'Not configured'}
        </span>
        <span style={{ color: 'var(--text-3)' }}>{connectedCount} of 3 accounts connected</span>
        <span
          className="right mono"
          style={{ fontSize: 11, color: 'var(--text-3)', cursor: 'pointer' }}
          onClick={() => setPage('settings')}
        >
          ⌖ v{version}
        </span>
      </footer>
    </div>
  )
}
