import type { ReactElement, ReactNode } from 'react'

export function Tooltip({ label, children }: { label: string; children: ReactElement }): ReactNode {
  return <span title={label}>{children}</span>
}
