import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Search, X } from 'lucide-react'
import { useUIStore } from '../../store/ui'
import { IconButton } from './IconButton'

export interface CommandAction {
  id: string
  label: string
  keywords?: string[]
  icon?: LucideIcon | React.ElementType
  disabled?: boolean
  disabledReason?: string
  run: () => void | Promise<void>
}

interface CommandPaletteProps {
  commands: CommandAction[]
}

export function CommandPalette({ commands }: CommandPaletteProps): ReactElement | null {
  const open = useUIStore((state) => state.commandPaletteOpen)
  const setOpen = useUIStore((state) => state.setCommandPaletteOpen)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((command) => {
      const haystack = [command.label, ...(command.keywords ?? [])].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  if (!open) return null

  const run = async (command: CommandAction): Promise<void> => {
    if (command.disabled) return
    await command.run()
    setOpen(false)
  }

  return (
    <div className="command-backdrop" onMouseDown={() => setOpen(false)}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-input-row">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands, pages, and actions"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((current) => Math.min(filtered.length - 1, current + 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((current) => Math.max(0, current - 1))
              }
              if (event.key === 'Enter' && filtered[activeIndex]) {
                event.preventDefault()
                void run(filtered[activeIndex])
              }
            }}
          />
          <IconButton
            label="Close command palette"
            icon={<X size={15} />}
            onClick={() => setOpen(false)}
          />
        </div>
        <div className="command-results">
          {filtered.length === 0 ? (
            <div className="command-empty">No commands found</div>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon
              return (
                <button
                  key={command.id}
                  className={`command-row ${index === activeIndex ? 'active' : ''}`}
                  disabled={command.disabled}
                  title={command.disabled ? command.disabledReason : command.label}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void run(command)}
                >
                  <span className="command-icon">{Icon ? <Icon size={15} /> : null}</span>
                  <span className="command-label">{command.label}</span>
                  {command.disabled && command.disabledReason ? (
                    <span className="command-disabled">{command.disabledReason}</span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
