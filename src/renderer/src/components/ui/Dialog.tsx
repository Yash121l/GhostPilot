import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from './IconButton'

interface DialogProps {
  open: boolean
  title: string
  description?: string
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

export function Dialog({
  open,
  title,
  description,
  onOpenChange,
  children,
  className = ''
}: DialogProps): ReactNode {
  if (!open) return null

  return (
    <div className="ui-dialog-backdrop" role="presentation" onMouseDown={() => onOpenChange(false)}>
      <section
        className={`ui-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ui-dialog-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description ? <p id="dialog-description">{description}</p> : null}
          </div>
          <IconButton
            label="Close dialog"
            icon={<X size={16} />}
            onClick={() => onOpenChange(false)}
          />
        </header>
        {children}
      </section>
    </div>
  )
}
