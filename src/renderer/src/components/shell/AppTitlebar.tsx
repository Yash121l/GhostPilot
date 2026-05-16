import { Menu, Search } from 'lucide-react'
import type { ReactElement } from 'react'
import { IconButton } from '../ui/IconButton'

interface AppTitlebarProps {
  onOpenSidebar: () => void
  onOpenCommandPalette: () => void
}

export function AppTitlebar({
  onOpenSidebar,
  onOpenCommandPalette
}: AppTitlebarProps): ReactElement {
  return (
    <header className="titlebar drag-region">
      <div className="titlebar-actions no-drag">
        <IconButton label="Open sidebar" icon={<Menu size={15} />} onClick={onOpenSidebar} />
      </div>
      <div className="titlebar-title">GhostPilot</div>
      <div className="titlebar-actions titlebar-actions-right no-drag">
        <IconButton
          label="Open command palette"
          tooltip="Command palette (Cmd/Ctrl+K)"
          icon={<Search size={15} />}
          onClick={onOpenCommandPalette}
        />
      </div>
    </header>
  )
}
