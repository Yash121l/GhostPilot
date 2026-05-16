import type { ReactElement, ReactNode } from 'react'

interface ComposerToolbarRowProps {
  label: string
  children: ReactNode
}

export function ComposerToolbarRow({ label, children }: ComposerToolbarRowProps): ReactElement {
  return (
    <div className="composer-toolbar-row">
      <span className="workspace-kicker composer-toolbar-label">{label}</span>
      <div className="composer-toolbar-content">{children}</div>
    </div>
  )
}
