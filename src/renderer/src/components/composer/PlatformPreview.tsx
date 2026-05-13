import { type ReactElement } from 'react'
import { Platform, PLATFORM_CHAR_LIMITS } from '@shared/types/platform'

interface PlatformPreviewProps {
  platform: Platform
  body: string
  displayName?: string
  avatarInitial?: string
}

function charColor(count: number, limit: number): string {
  const ratio = count / limit
  if (ratio >= 1) return 'var(--color-error)'
  if (ratio >= 0.9) return '#F59E0B'
  return 'var(--color-success)'
}

/** LinkedIn card mockup. */
function LinkedInPreview({ body, displayName, avatarInitial }: { body: string; displayName?: string; avatarInitial?: string }): ReactElement {
  const limit = PLATFORM_CHAR_LIMITS[Platform.LINKEDIN]
  const truncated = body.length > 220

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', background: '#fff', maxWidth: 480 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: '#0077B5' }}
        >
          {avatarInitial ?? 'U'}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#000' }}>{displayName ?? 'Your Name'}</p>
          <p className="text-[11px]" style={{ color: '#666' }}>Just now · 🌐</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <p className="text-sm leading-relaxed" style={{ color: '#191919', whiteSpace: 'pre-wrap' }}>
          {truncated ? body.slice(0, 220) : body}
          {truncated && (
            <span style={{ color: '#0a66c2', cursor: 'pointer' }}> …see more</span>
          )}
        </p>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid #e8e8e8' }}
      >
        <span className="text-[10px]" style={{ color: '#666' }}>👍 Like · 💬 Comment · ↗ Repost</span>
        <span
          className="text-[10px] font-mono font-semibold"
          style={{ color: charColor(body.length, limit) }}
        >
          {body.length} / {limit}
        </span>
      </div>
    </div>
  )
}

/** X (Twitter) tweet bubble. */
function XPreview({ body, displayName, avatarInitial }: { body: string; displayName?: string; avatarInitial?: string }): ReactElement {
  const limit = PLATFORM_CHAR_LIMITS[Platform.TWITTER]
  const over = body.length > limit

  return (
    <div style={{ maxWidth: 440 }}>
      <div
        className="rounded-xl p-4"
        style={{ border: '1px solid #2F3336', background: '#000', color: '#E7E9EA' }}
      >
        <div className="flex gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: '#1D9BF0', color: '#fff' }}
          >
            {avatarInitial ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold">{displayName ?? 'Your Name'}</span>
              <span className="text-[11px]" style={{ color: '#71767B' }}>@handle · just now</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
              {body.length > limit
                ? <><span style={{ color: '#E7E9EA' }}>{body.slice(0, limit)}</span><span style={{ color: '#F4212E', background: 'rgba(244,33,46,0.1)' }}>{body.slice(limit)}</span></>
                : body}
            </p>
            {over && (
              <p className="text-[11px] mt-2" style={{ color: '#F4212E' }}>
                {body.length - limit} characters over limit
              </p>
            )}
            <div
              className="flex items-center gap-6 mt-3 text-[12px]"
              style={{ color: '#71767B' }}
            >
              <span>💬 0</span><span>🔁 0</span><span>❤️ 0</span><span>📊 0</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-1">
        <span
          className="text-[10px] font-mono font-semibold"
          style={{ color: charColor(body.length, limit) }}
        >
          {body.length} / {limit}
        </span>
      </div>
    </div>
  )
}

/** Instagram caption frame. */
function InstagramPreview({ body, displayName, avatarInitial: _avatarInitial }: { body: string; displayName?: string; avatarInitial?: string }): ReactElement {
  const limit = PLATFORM_CHAR_LIMITS[Platform.INSTAGRAM]
  const truncated = body.length > 125

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid #DBDBDB', background: '#fff', maxWidth: 400 }}
    >
      {/* Image placeholder */}
      <div
        className="flex items-center justify-center text-[11px]"
        style={{ height: 180, background: 'linear-gradient(135deg, #F5F5F7, #E8E8EC)', color: '#9C9C9C' }}
      >
        Media placeholder
      </div>

      {/* Actions */}
      <div className="px-4 py-2 flex items-center gap-4 text-[18px]">
        <span>🤍</span><span>💬</span><span>✈️</span>
        <span className="ml-auto">🔖</span>
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <p className="text-[13px]" style={{ color: '#000' }}>
          <strong>{displayName ?? 'yourhandle'}</strong>{' '}
          <span style={{ whiteSpace: 'pre-wrap' }}>
            {truncated ? body.slice(0, 125) : body}
            {truncated && <span style={{ color: '#999', cursor: 'pointer' }}> more</span>}
          </span>
        </p>
        <p className="text-[11px] mt-1" style={{ color: '#999' }}>Just now</p>
      </div>

      <div
        className="px-4 py-2 flex justify-end"
        style={{ borderTop: '1px solid #DBDBDB' }}
      >
        <span
          className="text-[10px] font-mono font-semibold"
          style={{ color: charColor(body.length, limit) }}
        >
          {body.length} / {limit}
        </span>
      </div>
    </div>
  )
}

export function PlatformPreview({ platform, body, displayName, avatarInitial }: PlatformPreviewProps): ReactElement {
  if (!body) {
    return (
      <div
        className="flex items-center justify-center rounded-xl text-xs h-32"
        style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        Generate a variant to preview
      </div>
    )
  }

  switch (platform) {
    case Platform.LINKEDIN:
      return <LinkedInPreview body={body} displayName={displayName} avatarInitial={avatarInitial} />
    case Platform.TWITTER:
      return <XPreview body={body} displayName={displayName} avatarInitial={avatarInitial} />
    case Platform.INSTAGRAM:
      return <InstagramPreview body={body} displayName={displayName} avatarInitial={avatarInitial} />
    default:
      return <div className="text-xs text-[var(--color-text-muted)]">Preview unavailable for {platform}</div>
  }
}
