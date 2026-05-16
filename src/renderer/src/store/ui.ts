import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'

const SIDEBAR_KEY = 'ghostpilot:sidebar-width'
const THEME_KEY = 'ghostpilot:theme'

export const clampSidebarWidth = (width: number): number => Math.min(360, Math.max(220, width))

function readNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) ? value : fallback
}

function readTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const value = window.localStorage.getItem(THEME_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

interface UIState {
  sidebarWidth: number
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  themeMode: ThemeMode
  setSidebarWidth: (width: number) => void
  setSidebarOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: clampSidebarWidth(readNumber(SIDEBAR_KEY, 248)),
  sidebarOpen: false,
  commandPaletteOpen: false,
  themeMode: readTheme(),
  setSidebarWidth: (width) => {
    const next = clampSidebarWidth(width)
    window.localStorage.setItem(SIDEBAR_KEY, String(next))
    set({ sidebarWidth: next })
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setThemeMode: (mode) => {
    window.localStorage.setItem(THEME_KEY, mode)
    set({ themeMode: mode })
  }
}))
