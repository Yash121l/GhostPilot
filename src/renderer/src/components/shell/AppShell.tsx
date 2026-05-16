import { useCallback, useRef, type ReactElement, type ReactNode } from 'react'
import type { AuthStatusOutput } from '@shared/ipc-types'
import { useUIStore, type ThemeMode } from '../../store/ui'
import { AppSidebar, type NavEntry } from './AppSidebar'
import { AppStatusbar } from './AppStatusbar'
import { AppTitlebar } from './AppTitlebar'

interface AppShellProps<PageId extends string> {
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
  aiConfigured: boolean
  dbOk: boolean
  version: string
  themeMode: ThemeMode
  children: ReactNode
  onNavigate: (page: PageId) => void
  onThemeChange: (mode: ThemeMode) => void
  onOpenCommandPalette: () => void
}

export function AppShell<PageId extends string>({
  nav,
  page,
  connections,
  publishingCounts,
  aiConfigured,
  dbOk,
  version,
  themeMode,
  children,
  onNavigate,
  onThemeChange,
  onOpenCommandPalette
}: AppShellProps<PageId>): ReactElement {
  const sidebarWidth = useUIStore((state) => state.sidebarWidth)
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen)
  const frameRef = useRef<number | null>(null)

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (window.innerWidth < 1100) return
      event.currentTarget.setPointerCapture(event.pointerId)
      document.documentElement.classList.add('no-transitions')

      const onMove = (moveEvent: PointerEvent): void => {
        if (window.innerWidth < 1100) return
        if (window.innerWidth - moveEvent.clientX < 720) return
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
        frameRef.current = requestAnimationFrame(() => setSidebarWidth(moveEvent.clientX))
      }
      const onUp = (): void => {
        document.documentElement.classList.remove('no-transitions')
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setSidebarWidth]
  )

  const connectedCount = connections.filter((connection) => connection.connected).length

  return (
    <div
      className="app-shell"
      style={{
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        ['--sidebar-width' as string]: `${sidebarWidth}px`
      }}
    >
      <AppTitlebar
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenCommandPalette={onOpenCommandPalette}
      />
      <div className={`sidebar-layer ${sidebarOpen ? 'open' : ''}`}>
        <AppSidebar
          nav={nav}
          page={page}
          connections={connections}
          publishingCounts={publishingCounts}
          version={version}
          themeMode={themeMode}
          onNavigate={onNavigate}
          onOpenCommandPalette={onOpenCommandPalette}
          onThemeChange={onThemeChange}
          onCloseMobile={() => setSidebarOpen(false)}
        />
        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startResize}
        />
      </div>
      {sidebarOpen ? (
        <button
          className="mobile-sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <main className="main-content" key={page}>
        <div className="animate-slide-up h-full min-workspace">{children}</div>
      </main>
      <AppStatusbar
        dbOk={dbOk}
        aiConfigured={aiConfigured}
        connectedCount={connectedCount}
        version={version}
        onOpenSettings={() => onNavigate('settings' as PageId)}
      />
    </div>
  )
}
