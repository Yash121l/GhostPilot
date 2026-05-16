import {
  AtSign,
  Briefcase,
  Camera,
  Ghost,
  Moon,
  Search,
  Sun,
  Monitor,
  FileText,
  ListChecks,
  CalendarClock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import type { ReactElement } from 'react'
import type { AuthStatusOutput } from '@shared/ipc-types'
import { Platform } from '@shared/types/platform'
import type { ThemeMode } from '../../store/ui'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

export interface NavEntry<PageId extends string> {
  id: PageId
  label: string
  icon: React.ElementType
}

interface AppSidebarProps<PageId extends string> {
  nav: NavEntry<PageId>[]
  page: PageId
  connections: AuthStatusOutput[]
  publishingCounts?: {
    drafts: number
    review: number
    scheduled: number
    failed: number
    published: number
  }
  version: string
  themeMode: ThemeMode
  onNavigate: (page: PageId) => void
  onOpenCommandPalette: () => void
  onThemeChange: (mode: ThemeMode) => void
  onCloseMobile?: () => void
}

const SIDEBAR_CONNECTORS = [
  { platform: Platform.LINKEDIN, label: 'LinkedIn', icon: Briefcase, color: '#0a66c2' },
  { platform: Platform.TWITTER, label: 'X', icon: AtSign, color: 'var(--text)' },
  { platform: Platform.INSTAGRAM, label: 'Instagram', icon: Camera, color: '#c13584' }
]

function themeIcon(mode: ThemeMode): ReactElement {
  if (mode === 'dark') return <Moon size={13} />
  if (mode === 'light') return <Sun size={13} />
  return <Monitor size={13} />
}

export function AppSidebar<PageId extends string>({
  nav,
  page,
  connections,
  publishingCounts,
  version,
  themeMode,
  onNavigate,
  onOpenCommandPalette,
  onThemeChange,
  onCloseMobile
}: AppSidebarProps<PageId>): ReactElement {
  const cycleTheme = (): void => {
    const next = themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system'
    onThemeChange(next)
  }

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <div className="brand-mark">
          <Ghost size={20} strokeWidth={1.6} />
        </div>
        <div className="brand-name">GHOSTPILOT</div>
      </div>

      <div className="sidebar-command">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Search size={13} />}
          rightIcon={<span className="kbd-hint">⌘K</span>}
          onClick={onOpenCommandPalette}
        >
          Search actions
        </Button>
      </div>

      <div className="nav-section">Workspace</div>
      <div className="nav">
        {nav.map((item, index) => {
          const Icon = item.icon
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                onNavigate(item.id)
                onCloseMobile?.()
              }}
              title={`${item.label} · Cmd/Ctrl+${index + 1}`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {publishingCounts ? (
        <>
          <div className="nav-section">Publishing</div>
          <div className="sidebar-pipeline">
            <button className="pipeline-row" onClick={() => onNavigate('composer' as PageId)}>
              <FileText size={13} />
              <span>Drafts</span>
              <Badge variant="muted">{publishingCounts.drafts}</Badge>
            </button>
            <button
              className="pipeline-row"
              onClick={() => {
                onNavigate('composer' as PageId)
                window.dispatchEvent(new CustomEvent('composer:review-queue'))
              }}
            >
              <ListChecks size={13} />
              <span>Needs review</span>
              <Badge variant="info">{publishingCounts.review}</Badge>
            </button>
            <button className="pipeline-row" onClick={() => onNavigate('calendar' as PageId)}>
              <CalendarClock size={13} />
              <span>Scheduled</span>
              <Badge variant="default">{publishingCounts.scheduled}</Badge>
            </button>
            {publishingCounts.failed > 0 ? (
              <button className="pipeline-row" onClick={() => onNavigate('analytics' as PageId)}>
                <AlertTriangle size={13} />
                <span>Failed</span>
                <Badge variant="danger">{publishingCounts.failed}</Badge>
              </button>
            ) : null}
            {publishingCounts.published > 0 ? (
              <button className="pipeline-row" onClick={() => onNavigate('analytics' as PageId)}>
                <CheckCircle2 size={13} />
                <span>Published</span>
                <Badge variant="success">{publishingCounts.published}</Badge>
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="nav-spacer" />

      <div className="connections">
        <div className="sidebar-header">Connections</div>
        {SIDEBAR_CONNECTORS.map((p) => {
          const connected = connections.find((c) => c.platform === p.platform)?.connected
          const Icon = p.icon
          return (
            <button
              key={p.platform}
              className="connection-item"
              onClick={() => {
                onNavigate('settings' as PageId)
                window.setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent('settings:section', { detail: 'connections' })
                  )
                }, 0)
              }}
            >
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
            </button>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <Button variant="ghost" size="sm" leftIcon={themeIcon(themeMode)} onClick={cycleTheme}>
          {themeMode}
        </Button>
        <Badge variant="muted">v{version}</Badge>
      </div>
    </nav>
  )
}
