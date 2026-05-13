/**
 * @module App
 * Root application component. Sets up layout shell and navigation.
 * Upgraded with premium UI/UX, Lucide icons, and refined layouts.
 */

import { useState, type ReactElement } from 'react'
import {
  PenTool,
  CalendarDays,
  Inbox,
  Target,
  TrendingUp,
  UserCircle2,
  BarChart3,
  Settings,
  DatabaseZap,
  Bot,
  Sparkles,
  Command,
  Ghost
} from 'lucide-react'

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
  { id: 'composer',  label: 'Composer',  icon: PenTool },
  { id: 'calendar',  label: 'Calendar',  icon: CalendarDays },
  { id: 'inbox',     label: 'Inbox',     icon: Inbox },
  { id: 'goals',     label: 'Goals',     icon: Target },
  { id: 'trends',    label: 'Trends',    icon: TrendingUp },
  { id: 'personas',  label: 'Personas',  icon: UserCircle2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings',  label: 'Settings',  icon: Settings },
]

function Placeholder({ page }: { page: Page }): ReactElement {
  const activeNav = NAV.find((n) => n.id === page)
  const Icon = activeNav?.icon || Ghost

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full w-full p-8 animate-slide-up">
      <div className="flex flex-col items-center max-w-md w-full text-center">
        {/* Soft glowing icon container */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[var(--color-brand-primary)] opacity-20 blur-2xl rounded-full" />
          <div className="relative bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-md">
            <Icon size={42} strokeWidth={1.5} className="text-[var(--color-text-primary)]" />
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold mb-3 tracking-tight text-white/90">{activeNav?.label}</h2>
        
        <p className="text-[var(--color-text-muted)] mb-10 text-sm leading-relaxed">
          This module is part of the GhostPilot architecture. It will be implemented in a subsequent phase.
        </p>
        
        {/* Sleek status indicator */}
        <div className="flex items-center gap-2.5 bg-black/20 px-5 py-2.5 rounded-full border border-white/5 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)] animate-pulse" />
          <span className="text-[11px] font-medium tracking-widest text-[var(--color-text-secondary)] uppercase">
            Scaffold Complete
          </span>
        </div>
      </div>
    </div>
  )
}

export default function App(): ReactElement {
  const [page, setPage] = useState<Page>('calendar')

  return (
    <div className="app-shell">
      {/* ── Title Bar ── */}
      <header className="titlebar select-none">
        <div className="flex items-center gap-2 opacity-90">
          <Ghost size={14} strokeWidth={2.5} className="text-[var(--color-brand-primary)]" />
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-gradient">
            GhostPilot
          </div>
        </div>
        <div className="flex-1" />
        <div className="badge badge-brand animate-pulse-glow flex items-center gap-1.5 shadow-lg opacity-90 scale-90 origin-right">
          <Sparkles size={10} />
          <span className="text-[9px]">Phase 0</span>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <nav className="sidebar pt-6 flex flex-col" aria-label="Main navigation">
        <div className="sidebar-header">
          Workspace
        </div>
        
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

        {/* Connection status indicators */}
        <div style={{ marginTop: 'auto', paddingBottom: '32px', paddingTop: '24px' }}>
          <div className="sidebar-header">
            Connections
          </div>
          
          <div className="connection-list">
            {[
              { id: 'linkedin', label: 'LinkedIn' },
              { id: 'twitter', label: 'X (Twitter)' },
              { id: 'instagram', label: 'Instagram' }
            ].map((p) => (
              <div key={p.id} className="connection-item">
                <span className="connection-label">{p.label}</span>
                <div className="connection-dot" />
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="main-content" key={page}>
        <Placeholder page={page} />
      </main>

      {/* ── Status Bar ── */}
      <footer className="statusbar select-none text-[10px]">
        <div className="flex items-center gap-2 opacity-80">
          <DatabaseZap size={12} className="text-[var(--color-success)]" />
          <span className="tracking-wide">DB: Connected</span>
        </div>
        
        <div className="flex items-center gap-2 opacity-80">
          <Bot size={12} className="text-[var(--color-text-muted)]" />
          <span className="tracking-wide">AI: Not configured</span>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-default">
          <Command size={10} />
          <span className="font-mono">v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}
