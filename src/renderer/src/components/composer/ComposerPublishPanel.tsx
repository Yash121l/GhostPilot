import type { ReactElement } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface ComposerPublishPanelProps {
  scheduleAt: string
  onScheduleAtChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ComposerPublishPanel({
  scheduleAt,
  onScheduleAtChange,
  onConfirm,
  onCancel
}: ComposerPublishPanelProps): ReactElement {
  return (
    <div className="composer-schedule-panel">
      <Input
        type="datetime-local"
        value={scheduleAt}
        min={new Date().toISOString().slice(0, 16)}
        onChange={(event) => onScheduleAtChange(event.target.value)}
        aria-label="Schedule date and time"
      />
      <Button variant="primary" size="sm" disabled={!scheduleAt} onClick={onConfirm}>
        Confirm
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
