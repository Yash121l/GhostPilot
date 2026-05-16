import { Bot, DatabaseZap } from 'lucide-react'
import type { ReactElement } from 'react'

interface AppStatusbarProps {
  dbOk: boolean
  aiConfigured: boolean
  connectedCount: number
  version: string
  onOpenSettings: () => void
}

export function AppStatusbar({
  dbOk,
  aiConfigured,
  connectedCount,
  version,
  onOpenSettings
}: AppStatusbarProps): ReactElement {
  return (
    <footer className="statusbar select-none">
      <span className={dbOk ? 'ok' : ''}>
        <DatabaseZap size={11} />
        DB: {dbOk ? 'Connected' : 'Error'}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: aiConfigured ? 'var(--success)' : 'var(--text-3)'
        }}
      >
        <Bot size={11} />
        AI: {aiConfigured ? 'Ready' : 'Not configured'}
      </span>
      <span style={{ color: 'var(--text-3)' }}>{connectedCount} of 3 accounts connected</span>
      <button
        className="right mono status-version"
        style={{ fontSize: 11, color: 'var(--text-3)', cursor: 'pointer' }}
        onClick={onOpenSettings}
      >
        v{version}
      </button>
    </footer>
  )
}
