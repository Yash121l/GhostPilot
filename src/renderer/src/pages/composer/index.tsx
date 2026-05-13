import { useState, useCallback, useRef, type ReactElement } from 'react'
import {
  Sparkles, CheckCircle, AlertCircle, Briefcase, AtSign, Camera,
  CalendarDays, RotateCcw,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { Post } from '@shared/types/post'
import { Platform, PLATFORM_CHAR_LIMITS, PLATFORM_LABELS } from '@shared/types/platform'
import { useVariantGenerator } from '../../hooks/useVariantGenerator'
import { TiptapEditor } from '../../components/composer/TiptapEditor'
import { PlatformPreview } from '../../components/composer/PlatformPreview'
import { StyleDriftMeter } from '../../components/composer/StyleDriftMeter'
import type { Editor } from '@tiptap/react'

const PLATFORMS = [Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM]

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera,
}

const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.LINKEDIN]: '#0077B5',
  [Platform.TWITTER]: '#1D9BF0',
  [Platform.INSTAGRAM]: '#E1306C',
}

type ScheduleStep = 'idle' | 'scheduling'

export default function ComposerPage(): ReactElement {
  const [personaId] = useState('default')
  const [activePlatform, setActivePlatform] = useState<Platform>(Platform.LINKEDIN)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(PLATFORMS)
  const [savedPost, setSavedPost] = useState<Post | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [scheduleStep, setScheduleStep] = useState<ScheduleStep>('idle')
  const [scheduleAt, setScheduleAt] = useState('')
  const [schedulingPlatform, setSchedulingPlatform] = useState<Platform>(Platform.LINKEDIN)
  const [bodyText, setBodyText] = useState('')

  const editorRef = useRef<Editor | null>(null)
  const { state: genState, generate, reset: resetGen } = useVariantGenerator()

  const handleEditorChange = useCallback((text: string) => {
    setBodyText(text)
  }, [])

  const handleGenerate = useCallback(async (): Promise<void> => {
    const body = editorRef.current?.getText().trim() ?? ''
    if (!body) { setCreateError('Write something first.'); return }
    if (!selectedPlatforms.length) { setCreateError('Select at least one platform.'); return }

    setCreateError(null)

    // Create post first, then generate variants
    const createRes = await ipc.invoke(IPC_CHANNELS.POST_CREATE, {
      personaId,
      body,
      platforms: selectedPlatforms,
    })

    if (!createRes.ok) {
      setCreateError(createRes.error.message)
      return
    }

    const post = createRes.value
    setSavedPost(post)
    await generate(post.id, selectedPlatforms)
  }, [personaId, selectedPlatforms, generate])

  const handleSchedule = async (): Promise<void> => {
    if (!savedPost || !scheduleAt) return
    const variant = genState.variantMap[schedulingPlatform]
    if (!variant) { setCreateError('Generate a variant first.'); return }

    const res = await ipc.invoke(IPC_CHANNELS.POST_SCHEDULE, {
      postId: savedPost.id,
      variantId: variant.id,
      platform: schedulingPlatform,
      scheduledAt: new Date(scheduleAt).toISOString(),
    })

    if (res.ok) {
      setScheduleStep('idle')
      window.dispatchEvent(new CustomEvent('nav', { detail: 'calendar' }))
    } else {
      setCreateError(res.error.message)
    }
  }

  const togglePlatform = (p: Platform): void => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  const activeVariant = genState.variantMap[activePlatform]
  const charLimit = PLATFORM_CHAR_LIMITS[activePlatform]
  const charCount = activeVariant?.charCount ?? 0
  const generating = genState.status === 'loading'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Composer</h1>
          <p className="page-subtitle">Write once — AI adapts for every platform</p>
        </div>
        <div className="flex items-center gap-2">
          {genState.status !== 'idle' && (
            <button onClick={resetGen} className="btn btn-ghost btn-icon" title="Reset">
              <RotateCcw size={14} />
            </button>
          )}
          <button onClick={handleGenerate} disabled={generating} className="btn btn-primary">
            {generating
              ? <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white/60 animate-pulse-glow" />Generating…</span>
              : <><Sparkles size={14} />Generate Variants</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: source editor */}
        <div
          className="flex flex-col"
          style={{ width: '50%', borderRight: '1px solid var(--color-border)' }}
        >
          {/* Platform selector */}
          <div
            className="flex items-center gap-3 px-5 py-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Platforms</span>
            {PLATFORMS.map((p) => {
              const Icon = PLATFORM_ICONS[p]
              const selected = selectedPlatforms.includes(p)
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    background: selected ? `${PLATFORM_COLORS[p]}15` : 'var(--color-surface-alt)',
                    color: selected ? PLATFORM_COLORS[p] : 'var(--color-text-muted)',
                    border: `1px solid ${selected ? PLATFORM_COLORS[p] + '50' : 'var(--color-border)'}`,
                  }}
                >
                  <Icon size={10} />
                  {PLATFORM_LABELS[p]}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-hidden">
            <TiptapEditor
              onChange={handleEditorChange}
              editorRef={(e) => { editorRef.current = e }}
            />
          </div>

          {/* Style drift meter */}
          <div
            className="px-5 py-2"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <StyleDriftMeter personaId={personaId} text={bodyText} />
          </div>

          {(createError ?? genState.error) && (
            <div
              className="mx-5 mb-3 flex items-center gap-2 text-xs rounded-xl px-4 py-2.5"
              style={{
                color: 'var(--color-error)',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <AlertCircle size={12} />
              {createError ?? genState.error}
            </div>
          )}
        </div>

        {/* Right: platform variants */}
        <div className="flex flex-col" style={{ width: '50%' }}>
          {/* Platform tabs */}
          <div className="tab-bar">
            {PLATFORMS.map((p) => {
              const Icon = PLATFORM_ICONS[p]
              const isActive = activePlatform === p
              const color = PLATFORM_COLORS[p]
              const hasVariant = Boolean(genState.variantMap[p])
              return (
                <button
                  key={p}
                  onClick={() => setActivePlatform(p)}
                  className={`tab-item ${isActive ? 'active' : ''}`}
                  style={isActive ? { color } : undefined}
                >
                  <Icon size={13} />
                  {PLATFORM_LABELS[p]}
                  {hasVariant && <CheckCircle size={11} className="text-[var(--color-success)]" />}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto py-5" style={{ paddingLeft: 24, paddingRight: 24 }}>
            {activeVariant ? (
              <div className="space-y-4">
                {/* Platform preview */}
                <PlatformPreview platform={activePlatform} body={activeVariant.body} />

                {/* Char counter */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="progress-track" style={{ width: 80 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, (charCount / charLimit) * 100)}%`,
                          background:
                            charCount > charLimit
                              ? 'var(--color-error)'
                              : charCount > charLimit * 0.9
                              ? 'var(--color-warning)'
                              : PLATFORM_COLORS[activePlatform],
                        }}
                      />
                    </div>
                    <span
                      className="text-[11px] font-mono"
                      style={{
                        color:
                          charCount > charLimit
                            ? 'var(--color-error)'
                            : charCount > charLimit * 0.9
                            ? 'var(--color-warning)'
                            : 'var(--color-text-muted)',
                      }}
                    >
                      {charCount} / {charLimit}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {activeVariant.provider} · {activeVariant.modelId}
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state h-full">
                <div className="empty-icon-wrap">
                  {generating
                    ? <span className="w-6 h-6 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin inline-block" />
                    : <Sparkles size={22} />}
                </div>
                <p className="empty-title">
                  {generating ? `Adapting for ${PLATFORM_LABELS[activePlatform]}…` : 'No variant yet'}
                </p>
                {!generating && (
                  <p className="empty-text">
                    Write your draft on the left, then hit Generate to see platform-specific variants.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer: schedule flow */}
          {savedPost && activeVariant && (
            <div
              className="flex items-center gap-3 py-3"
              style={{ paddingLeft: 24, paddingRight: 24, borderTop: '1px solid var(--color-border)' }}
            >
              {scheduleStep === 'idle' ? (
                <>
                  <CheckCircle size={13} className="text-[var(--color-success)]" />
                  <span className="text-xs text-[var(--color-text-muted)] flex-1">
                    Saved · {savedPost.id.slice(0, 8)}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setSchedulingPlatform(activePlatform); setScheduleStep('scheduling') }}
                  >
                    <CalendarDays size={12} />
                    Schedule
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="form-input text-xs"
                    style={{ width: 120 }}
                    value={schedulingPlatform}
                    onChange={(e) => setSchedulingPlatform(e.target.value as Platform)}
                  >
                    {selectedPlatforms.map((p) => (
                      <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    className="form-input text-xs flex-1"
                    value={scheduleAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSchedule} disabled={!scheduleAt}>
                    Confirm
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setScheduleStep('idle')}>Cancel</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
