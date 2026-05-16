import { ImagePlus, Paperclip, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Persona } from '@shared/types/persona'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'

interface ComposerHeaderProps {
  personas: Persona[]
  personaId: string
  providerId: string
  providerOptions: Array<{ id: string; label: string; disabled?: boolean }>
  hasVariant: boolean
  aiReady?: boolean
  onPersonaChange: (personaId: string) => void
  onProviderChange: (providerId: string) => void
  onClear: () => void
  onAttachImage: () => void
  onOpenImageGenerator: () => void
}

export function ComposerHeader({
  personas,
  personaId,
  providerId,
  providerOptions,
  hasVariant,
  aiReady = true,
  onPersonaChange,
  onProviderChange,
  onClear,
  onAttachImage,
  onOpenImageGenerator
}: ComposerHeaderProps): ReactElement {
  return (
    <header className="composer-header">
      <div className="composer-title-group">
        <h1>Composer</h1>
        <p>
          {hasVariant
            ? 'Review platform variants and publish from the right panel.'
            : 'Draft once, then adapt for each connected audience.'}
        </p>
      </div>
      <div className="composer-header-actions">
        <Badge variant={aiReady ? 'success' : 'warning'}>
          {aiReady ? 'AI ready' : 'AI setup needed'}
        </Badge>
        {personas.length > 0 ? (
          <Select
            value={personaId}
            onChange={(event) => onPersonaChange(event.target.value)}
            aria-label="Persona"
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          value={providerId}
          onChange={(event) => onProviderChange(event.target.value)}
          aria-label="Generation provider"
          title="Choose which API key, local agent, or SDK GhostPilot uses for generation"
        >
          {providerOptions.map((option) => (
            <option key={option.id} value={option.id} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Paperclip size={13} />}
          onClick={onAttachImage}
        >
          Attach
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ImagePlus size={13} />}
          onClick={onOpenImageGenerator}
        >
          Image
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} onClick={onClear}>
          Clear
        </Button>
      </div>
    </header>
  )
}
