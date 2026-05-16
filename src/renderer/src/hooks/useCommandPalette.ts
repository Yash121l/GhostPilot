import { useEffect } from 'react'
import { useUIStore } from '../store/ui'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .ProseMirror'))
}

export function useCommandPaletteShortcuts(): void {
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      if (event.key === 'Escape') {
        setCommandPaletteOpen(false)
      }

      if (isEditableTarget(event.target)) return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCommandPaletteOpen])
}
