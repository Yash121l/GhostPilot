import type { ReactElement, ReactNode } from 'react'

export function ComposerWorkspace({ children }: { children: ReactNode }): ReactElement {
  return <div className="composer-workspace">{children}</div>
}
