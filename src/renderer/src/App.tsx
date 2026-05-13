import { useState, useEffect, type ReactElement } from 'react'
import {
  PenTool, CalendarDays, Link2, Target, TrendingUp,
  UserCircle2, BarChart3, Settings, DatabaseZap, Bot, Sparkles, Ghost,
  Briefcase, AtSign, Camera,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from './lib/ipc'
import type { AuthStatusOutput } from '@shared/ipc-types'
import { Platform } from '@shared/types/platform'

// Single source of truth for sidebar connection icons — add new platforms here
const SIDEBAR_CONNECTORS = [
  { platform: Platform.LINKEDIN,  label: 'LinkedIn',    icon: Briefcase, color: '#0077B5' },
  { platform: Platform.TWITTER,   label: 'X',           icon: AtSign,    color: '#1D9BF0' },
  { platform: Platform.INSTAGRAM, label: 'Instagram',   icon: Camera,    color: '#E1306C' },
]

import ComposerPage from './pages/ComposerPage'
import CalendarPage from './pages/CalendarPage'
import InboxPage from './pages/InboxPage'
import GoalsPage from './pages/GoalsPage'
import TrendsPage from './pages/TrendsPage'
import PersonasPage from './pages/PersonasPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'

type Page = 'composer' | 'calendar' | 'inbox' | 'goals' | 'trends' | 'personas' | 'analytics' | 'settings'

interface NavEntry { id: Page; label: string; icon: React.ElementType }

const NAV: NavEntry[] = [
  { id: 'composer',  label: 'Composer',  icon: PenTool },
  { id: 'calendar',  label: 'Calendar',  icon: CalendarDays },
  { id: 'inbox',     label: 'Connect',   icon: Link2 },
  { id: 'goals',     label: 'Goals',     icon: Target },
  { id: 'trends',    label: 'Trends',    icon: TrendingUp },
  { id: 'personas',  label: 'Personas',  icon: UserCircle2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings',  label: 'Settings',  icon: Settings },
]

const PAGES: Record<Page, ReactElement> = {
  composer:  <ComposerPage />,
  calendar:  <CalendarPage />,
  inbox:     <InboxPage />,
  goals:     <GoalsPage />,
  trends:    <TrendsPage />,
  personas:  <PersonasPage />,
  analytics: <AnalyticsPage />,
  settings:  <SettingsPage />,
}

export default function App(): ReactElement {
  const [page, setPage] = useState<Page>('composer')
  const [connections, setConnections] = useState<AuthStatusOutput[]>([])
  const [aiConfigured, setAiConfigured] = useState(false)
  const [dbOk] = useState(true)

  // Load connection + AI status on mount
  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {}).then((res) => {
      if (res.ok) setConnections(res.value)
    })
    ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}).then((res) => {
      if (res.ok) setAiConfigured(res.value.length > 0)
    })
    // Also check Ollama
    ipc.invoke(IPC_CHANNELS.AI_OLLAMA_STATUS, {}).then((res) => {
      if (res.ok && res.value.available) setAiConfigured(true)
    })
  }, [])

  // Listen for auth events from main process
  useEffect(() => {
    const unsub = window.api?.on('auth:connected', () => {
      ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {}).then((res) => {
        if (res.ok) setConnections(res.value)
      })
    })
    return () => unsub?.()
  }, [])

  // Listen for programmatic nav events (e.g., Composer → Calendar)
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<Page | { page: Page; prefill?: string }>).detail
      const target = typeof detail === 'string' ? detail : detail.page
      if (NAV.some((n) => n.id === target)) setPage(target)
    }
    window.addEventListener('nav', handler)
    return () => window.removeEventListener('nav', handler)
  }, [])

  return (
    <div className="app-shell">
      {/* ── Title Bar ── */}
      <header className="titlebar select-none">
        <div className="flex items-center gap-2">
          <Ghost size={14} strokeWidth={2.5} className="text-[var(--color-primary)]" />
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-gradient">
            GhostPilot
          </div>
        </div>
        <div className="flex-1" />
        <div className="badge badge-brand flex items-center gap-1.5">
          <Sparkles size={10} />
          <span className="text-[9px]">Phase 1</span>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <nav className="sidebar pt-6 flex flex-col" aria-label="Main navigation">
        <div className="sidebar-header">Workspace</div>

        <div className="flex-1 flex flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
              >
                <Icon size={16} strokeWidth={page === item.id ? 2.5 : 2} className="opacity-70 transition-all duration-300" />
                <span className="tracking-wide">{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Connection status */}
        <div style={{ marginTop: 'auto', paddingBottom: '32px', paddingTop: '24px' }}>
          <div className="sidebar-header">Connections</div>
          <div className="connection-list">
            {SIDEBAR_CONNECTORS.map((p) => {
              const connected = connections.find((c) => c.platform === p.platform)?.connected
              const Icon = p.icon
              return (
                <div
                  key={p.platform}
                  className="connection-item"
                  onClick={() => setPage('inbox')}
                >
                  <Icon size={12} className="shrink-0" style={{ color: connected ? p.color : 'var(--color-text-muted)', opacity: connected ? 1 : 0.5 }} />
                  <span className="connection-label">{p.label}</span>
                  <div
                    className="connection-dot"
                    style={{
                      background: connected ? 'var(--color-success)' : undefined,
                      boxShadow: connected ? '0 0 8px var(--color-success)' : undefined,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="main-content" key={page}>
        <div className="animate-slide-up h-full">
          {PAGES[page]}
        </div>
      </main>

      {/* ── Status Bar ── */}
      <footer className="statusbar select-none text-[10px]">
        <div className="flex items-center gap-2 opacity-80">
          <DatabaseZap size={12} className={dbOk ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'} />
          <span className="tracking-wide">DB: {dbOk ? 'Connected' : 'Error'}</span>
        </div>
        <div className="flex items-center gap-2 opacity-80">
          <Bot size={12} className={aiConfigured ? 'text-[var(--color-brand-primary)]' : 'text-[var(--color-text-muted)]'} />
          <span className="tracking-wide">AI: {aiConfigured ? 'Ready' : 'Not configured'}</span>
        </div>
        <div className="flex-1" />
        <div
          className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={() => setPage('settings')}
        >
          <Settings size={10} />
          <span className="font-mono">v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}
