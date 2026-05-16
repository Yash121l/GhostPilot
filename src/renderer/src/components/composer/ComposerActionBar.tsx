import { Sparkles, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { StyleDriftMeter } from './StyleDriftMeter'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

interface ComposerActionBarProps {
  personaId: string
  personaName: string
  imageCount: number
  selectedPlatformCount: number
  bodyLength: number
  bodyText: string
  generating: boolean
  hasVariant: boolean
  canGenerate: boolean
  onGenerate: () => void
  onClear: () => void
}

export function ComposerActionBar({
  personaId,
  personaName,
  imageCount,
  selectedPlatformCount,
  bodyLength,
  bodyText,
  generating,
  hasVariant,
  canGenerate,
  onGenerate,
  onClear
}: ComposerActionBarProps): ReactElement {
  return (
    <footer className="composer-action-bar">
      <div className="composer-action-meta">
        <Badge variant="muted">
          {selectedPlatformCount} platform{selectedPlatformCount === 1 ? '' : 's'}
        </Badge>
        <Badge variant="muted">
          {imageCount} image{imageCount === 1 ? '' : 's'}
        </Badge>
        {personaName ? (
          <span>
            Persona: <strong>{personaName}</strong>
          </span>
        ) : null}
        <span className="mono">{bodyLength} chars</span>
        {personaId ? <StyleDriftMeter personaId={personaId} text={bodyText} /> : null}
      </div>
      <div className="composer-action-buttons">
        <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} onClick={onClear}>
          Clear
        </Button>
        <Button
          variant={hasVariant ? 'secondary' : 'primary'}
          size="sm"
          loading={generating}
          disabled={!canGenerate || hasVariant}
          leftIcon={<Sparkles size={13} />}
          onClick={onGenerate}
          title={hasVariant ? 'Publish and schedule from the variant panel' : undefined}
        >
          {hasVariant ? 'Variants ready' : 'Generate variants'}
        </Button>
      </div>
    </footer>
  )
}
