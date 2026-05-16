import { Copy, Send, CalendarDays, Sparkles, CheckCircle } from 'lucide-react'
import type { ReactElement } from 'react'
import type { DraftVariant } from '@shared/types/post'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { PLATFORM_COLORS, PLATFORM_ICONS } from './constants'
import { ComposerPublishPanel } from './ComposerPublishPanel'

const PLATFORM_OPT: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'opt: 1300-2000',
  [Platform.TWITTER]: 'opt: < 280',
  [Platform.INSTAGRAM]: 'opt: 125-150'
}

interface ComposerVariantPanelProps {
  selectedPlatforms: Platform[]
  activePlatform: Platform
  variants: Partial<Record<Platform, DraftVariant>>
  generating: boolean
  copied: boolean
  posting: boolean
  successMsg: string | null
  scheduleOpen: boolean
  scheduleAt: string
  onActivePlatformChange: (platform: Platform) => void
  onCopy: () => void
  onPublishNow: () => void
  onOpenSchedule: () => void
  onScheduleAtChange: (value: string) => void
  onScheduleConfirm: () => void
  onCancelSchedule: () => void
}

export function ComposerVariantPanel({
  selectedPlatforms,
  activePlatform,
  variants,
  generating,
  copied,
  posting,
  successMsg,
  scheduleOpen,
  scheduleAt,
  onActivePlatformChange,
  onCopy,
  onPublishNow,
  onOpenSchedule,
  onScheduleAtChange,
  onScheduleConfirm,
  onCancelSchedule
}: ComposerVariantPanelProps): ReactElement {
  const activeVariant = variants[activePlatform]

  return (
    <section className="composer-variant-panel">
      <div className="composer-variant-tabs">
        {selectedPlatforms.length === 0 ? (
          <span className="workspace-kicker">No platforms selected</span>
        ) : (
          selectedPlatforms.map((platform) => {
            const Icon = PLATFORM_ICONS[platform]
            const active = activePlatform === platform
            return (
              <button
                key={platform}
                className={`composer-variant-tab ${active ? 'active' : ''}`}
                style={{ ['--platform-color' as string]: PLATFORM_COLORS[platform] }}
                onClick={() => onActivePlatformChange(platform)}
              >
                <Icon size={13} />
                {PLATFORM_LABELS[platform]}
                {variants[platform] ? <span className="ready-dot" /> : null}
              </button>
            )
          })
        )}
      </div>

      {activeVariant ? (
        <div className="composer-variant-card">
          <div className="composer-variant-header">
            <div>
              <span className="workspace-kicker">Variant</span>
              <h2>{PLATFORM_LABELS[activePlatform]}</h2>
            </div>
            <div className="composer-variant-meta">
              <Badge variant="muted">{activeVariant.charCount} chars</Badge>
              <Badge variant="info">{PLATFORM_OPT[activePlatform]}</Badge>
            </div>
          </div>
          <div className="composer-variant-body">{activeVariant.body}</div>
          {scheduleOpen ? (
            <ComposerPublishPanel
              scheduleAt={scheduleAt}
              onScheduleAtChange={onScheduleAtChange}
              onConfirm={onScheduleConfirm}
              onCancel={onCancelSchedule}
            />
          ) : (
            <div className="composer-variant-actions">
              {successMsg ? (
                <span className="composer-success">
                  <CheckCircle size={13} /> {successMsg}
                </span>
              ) : (
                <span />
              )}
              <Button variant="secondary" size="sm" leftIcon={<Copy size={13} />} onClick={onCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CalendarDays size={13} />}
                onClick={onOpenSchedule}
              >
                Schedule
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={posting}
                leftIcon={<Send size={13} />}
                onClick={onPublishNow}
              >
                Publish now
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="composer-empty-state">
          <div className="empty-icon-wrap">
            {generating ? <span className="composer-spinner" /> : <Sparkles size={22} />}
          </div>
          <div className="empty-title">
            {generating ? `Adapting for ${PLATFORM_LABELS[activePlatform]}...` : 'No variant yet'}
          </div>
          <div className="empty-text">
            {selectedPlatforms.length === 0
              ? 'Select one or more platforms on the left, then generate variants.'
              : 'Write your draft on the left, then generate platform-specific variants.'}
          </div>
        </div>
      )}
    </section>
  )
}
