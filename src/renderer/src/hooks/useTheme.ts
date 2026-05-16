import { useEffect } from 'react'
import { useUIStore, type ThemeMode } from '../store/ui'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
  }
  return mode
}

function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = resolved === 'dark' ? '#111111' : '#f7f6f2'
}

export function useTheme(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const mode = useUIStore((state) => state.themeMode)
  const setMode = useUIStore((state) => state.setThemeMode)

  useEffect(() => {
    applyTheme(mode)
    const media = window.matchMedia?.(DARK_QUERY)
    if (!media || mode !== 'system') return
    const onChange = (): void => applyTheme(mode)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  return { mode, setMode }
}
