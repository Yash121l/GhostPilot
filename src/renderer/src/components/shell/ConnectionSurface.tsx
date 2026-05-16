import type { ReactElement, ReactNode } from 'react'

interface ConnectionSurfaceProps {
  connected: boolean
  children: ReactNode
}

export function ConnectionSurface({ connected, children }: ConnectionSurfaceProps): ReactElement {
  return (
    <div className="connection-surface" data-connected={connected ? 'true' : 'false'}>
      {children}
    </div>
  )
}
