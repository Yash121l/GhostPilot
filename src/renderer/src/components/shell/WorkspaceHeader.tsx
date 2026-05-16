import type { ReactElement, ReactNode } from 'react'

interface WorkspaceHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function WorkspaceHeader({ title, subtitle, actions }: WorkspaceHeaderProps): ReactElement {
  return (
    <div className="page-header workspace-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="workspace-header-actions">{actions}</div> : null}
    </div>
  )
}
