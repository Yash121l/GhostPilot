import type { ReactElement } from 'react'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'
import { PLATFORM_COLORS, PLATFORM_ICONS } from './constants'
import { ComposerToolbarRow } from './ComposerToolbarRow'

const PLATFORMS = [Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM]

interface ComposerPlatformRailProps {
  selectedPlatforms: Platform[]
  activePlatform: Platform
  onTogglePlatform: (platform: Platform) => void
}

export function ComposerPlatformRail({
  selectedPlatforms,
  activePlatform,
  onTogglePlatform
}: ComposerPlatformRailProps): ReactElement {
  return (
    <ComposerToolbarRow label="Platforms">
      <div className="composer-platform-buttons">
        {PLATFORMS.map((platform) => {
          const Icon = PLATFORM_ICONS[platform]
          const selected = selectedPlatforms.includes(platform)
          const active = activePlatform === platform
          return (
            <button
              key={platform}
              className={`composer-platform-button ${selected ? 'selected' : ''} ${active ? 'active' : ''}`}
              onClick={() => onTogglePlatform(platform)}
              title={
                selected
                  ? `Remove ${PLATFORM_LABELS[platform]}`
                  : `Add ${PLATFORM_LABELS[platform]}`
              }
              style={{ ['--platform-color' as string]: PLATFORM_COLORS[platform] }}
            >
              <Icon size={13} />
              <span>{PLATFORM_LABELS[platform]}</span>
            </button>
          )
        })}
      </div>
    </ComposerToolbarRow>
  )
}
