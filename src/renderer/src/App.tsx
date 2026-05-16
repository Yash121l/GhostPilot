import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  BarChart3,
  CalendarDays,
  Key,
  Moon,
  PenTool,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  UserCircle2
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from './lib/ipc'
import type { AuthStatusOutput, UpdateState } from '@shared/ipc-types'
import { PostStatus, type Post } from '@shared/types/post'
import { useTheme } from './hooks/useTheme'
import { useCommandPaletteShortcuts } from './hooks/useCommandPalette'
import { useUIStore } from './store/ui'
import { AppShell } from './components/shell/AppShell'
import { UpdateToast } from './components/shell/UpdateToast'
import { CommandPalette, type CommandAction } from './components/ui/CommandPalette'
import { ToastProvider } from './components/ui/Toast'

import ComposerPage from './pages/composer'
import CalendarPage from './pages/calendar'
import GoalsPage from './pages/goals'
import TrendsPage from './pages/trends'
import PersonasPage from './pages/personas'
import AnalyticsPage from './pages/analytics'
import SettingsPage from './pages/settings/AIProvidersPage'

export type Page =
  | 'composer'
  | 'calendar'
  | 'goals'
  | 'trends'
  | 'personas'
  | 'analytics'
  | 'settings'

const NAV = [
  { id: 'composer', label: 'Composer', icon: PenTool },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'personas', label: 'Personas', icon: UserCircle2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings }
] satisfies { id: Page; label: string; icon: React.ElementType }[]

const PAGES: Record<Page, ReactElement> = {
  composer: <ComposerPage />,
  calendar: <CalendarPage />,
  goals: <GoalsPage />,
  trends: <TrendsPage />,
  personas: <PersonasPage />,
  analytics: <AnalyticsPage />,
  settings: <SettingsPage />
}

function AppContent(): ReactElement {
  const [page, setPage] = useState<Page>('composer')
  const [connections, setConnections] = useState<AuthStatusOutput[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [aiConfigured, setAiConfigured] = useState(false)
  const [dbOk] = useState(true)
  const [version, setVersion] = useState('...')
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' })
  const [rosettaWarning, setRosettaWarning] = useState(false)
  const { mode, setMode } = useTheme()
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen)

  useCommandPaletteShortcuts()

  const loadConnections = async (): Promise<void> => {
    const res = await ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {})
    if (res.ok) setConnections(res.value)
  }

  const loadPosts = async (): Promise<void> => {
    const res = await ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 500 })
    if (res.ok) setPosts(res.value)
  }

  const loadAiStatus = async (): Promise<void> => {
    const [keysRes, ollamaRes, localAgentsRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}),
      ipc.invoke(IPC_CHANNELS.AI_OLLAMA_STATUS, {}),
      ipc.invoke(IPC_CHANNELS.LOCAL_AGENT_STATUS, {})
    ])
    const hasKeys = keysRes.ok && keysRes.value.length > 0
    const ollamaAvailable = ollamaRes.ok && ollamaRes.value.available
    const localAgentAvailable =
      localAgentsRes.ok &&
      localAgentsRes.value.some((agent) => agent.installed && agent.authenticated)
    setAiConfigured(hasKeys || ollamaAvailable || localAgentAvailable)
  }

  useEffect(() => {
    void loadConnections()
    void loadAiStatus()
    void loadPosts()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api?.getVersion().then((v: string) => setVersion(v))
    ipc.invoke(IPC_CHANNELS.UPDATER_GET_STATE, {}).then((state) => setUpdateState(state))
  }, [])

  useEffect(() => {
    const unsub = window.api?.on('auth:connected', () => {
      void loadConnections()
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const refreshPosts = (): void => {
      void loadPosts()
    }
    window.addEventListener('posts:changed', refreshPosts)
    const unsubPublished = ipc.on('job:published', refreshPosts)
    const unsubFailed = ipc.on('job:failed', refreshPosts)
    return () => {
      window.removeEventListener('posts:changed', refreshPosts)
      unsubPublished()
      unsubFailed()
    }
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
    const unsubState = window.api?.on(IPC_CHANNELS.UPDATER_STATE_CHANGED, (state: unknown) => {
      setUpdateState(state as UpdateState)
    })
    const unsubRosetta = window.api?.on(IPC_CHANNELS.UPDATER_ROSETTA_WARNING, () => {
      setRosettaWarning(true)
    })
    return () => {
      unsubState?.()
      unsubRosetta?.()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return
      const index = Number(event.key)
      if (!Number.isInteger(index) || index < 1 || index > NAV.length) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, [contenteditable="true"], .ProseMirror')
      )
        return
      event.preventDefault()
      setPage(NAV[index - 1].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const commands = useMemo<CommandAction[]>(
    () => [
      ...NAV.map((entry) => ({
        id: `nav:${entry.id}`,
        label: `Go to ${entry.label}`,
        keywords: ['navigate', entry.id],
        icon: entry.icon,
        run: () => setPage(entry.id)
      })),
      {
        id: 'draft:new',
        label: 'New draft',
        keywords: ['composer', 'clear', 'post'],
        icon: Sparkles,
        run: () => {
          window.dispatchEvent(new CustomEvent('composer:new-draft'))
          setPage('composer')
        }
      },
      {
        id: 'connections:refresh',
        label: 'Open account connections',
        keywords: ['connect', 'oauth', 'accounts'],
        icon: RefreshCw,
        run: () => {
          setPage('settings')
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('settings:section', { detail: 'connections' }))
          }, 0)
        }
      },
      {
        id: 'theme:cycle',
        label: `Toggle theme (${mode})`,
        keywords: ['dark', 'light', 'system'],
        icon: Moon,
        run: () => setMode(mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system')
      },
      {
        id: 'settings:keys',
        label: 'Add API key',
        keywords: ['provider', 'openai', 'anthropic', 'settings'],
        icon: Key,
        run: () => setPage('settings')
      }
    ],
    [mode, setMode]
  )

  const publishingCounts = useMemo(
    () => ({
      drafts: posts.filter((post) => post.status === PostStatus.DRAFT).length,
      review: posts.filter((post) => post.status === PostStatus.PENDING_APPROVAL).length,
      scheduled: posts.filter((post) => post.status === PostStatus.SCHEDULED).length,
      failed: posts.filter((post) => post.status === PostStatus.FAILED).length,
      published: posts.filter((post) => post.status === PostStatus.PUBLISHED).length
    }),
    [posts]
  )

  return (
    <>
      <CommandPalette commands={commands} />
      <UpdateToast
        updateState={updateState}
        rosettaWarning={rosettaWarning}
        onDismissRosetta={() => setRosettaWarning(false)}
      />
      <AppShell
        nav={NAV}
        page={page}
        connections={connections}
        publishingCounts={publishingCounts}
        aiConfigured={aiConfigured}
        dbOk={dbOk}
        version={version}
        themeMode={mode}
        onNavigate={setPage}
        onThemeChange={setMode}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      >
        {PAGES[page]}
      </AppShell>
    </>
  )
}

export default function App(): ReactElement {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
