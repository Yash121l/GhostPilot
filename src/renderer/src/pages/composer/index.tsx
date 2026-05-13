import { useState, useCallback, useRef, useEffect, type ReactElement } from 'react'
import {
  Sparkles, CheckCircle, AlertCircle, Briefcase, AtSign, Camera,
  CalendarDays, RotateCcw, UserCircle2, Save, Send,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { Post } from '@shared/types/post'
import { Platform, PLATFORM_CHAR_LIMITS, PLATFORM_LABELS } from '@shared/types/platform'
import { useVariantGenerator } from '../../hooks/useVariantGenerator'
import { TiptapEditor } from '../../components/composer/TiptapEditor'
import { PlatformPreview } from '../../components/composer/PlatformPreview'
import { StyleDriftMeter } from '../../components/composer/StyleDriftMeter'
import type { Editor } from '@tiptap/react'
import type { Persona } from '@shared/types/persona'
import { useComposerStore } from '../../store/composer'

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
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personaId, setPersonaId] = useState<string>('')
  const [activePlatform, setActivePlatform] = useState<Platform>(Platform.LINKEDIN)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(PLATFORMS)
  const [savedPost, setSavedPost] = useState<Post | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [scheduleStep, setScheduleStep] = useState<ScheduleStep>('idle')
  const [scheduleAt, setScheduleAt] = useState('')
  const [schedulingPlatform, setSchedulingPlatform] = useState<Platform>(Platform.LINKEDIN)
  const [bodyText, setBodyText] = useState('')
  const [posting, setPosting] = useState(false)
  const [postSuccess, setPostSuccess] = useState<string | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const { state: genState, generate, reset: resetGen } = useVariantGenerator()
  const { prefill, setPrefill } = useComposerStore()

  // Load personas on mount — pick the first one as default
  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {}).then((res) => {
      if (res.ok && res.value.length > 0) {
        setPersonas(res.value)
        setPersonaId(res.value[0].id)
      }
    })
  }, [])

  // Apply prefill from Trends "Draft this topic"
  useEffect(() => {
    if (prefill && editorRef.current) {
      editorRef.current.commands.setContent(prefill)
      setBodyText(prefill)
      setPrefill(null)
    }
  }, [prefill, setPrefill])

  // Store editor instance via callback ref
  const handleEditorRef = useCallback((e: Editor | null) => {
    editorRef.current = e
    // If there's a pending prefill and the editor just mounted, apply it now
    if (e && prefill) {
      e.commands.setContent(prefill)
      setBodyText(prefill)
      setPrefill(null)
    }
  }, [prefill, setPrefill])

  const handleEditorChange = useCallback((text: string) => {
    setBodyText(text)
  }, [])

  const handleGenerate = useCallback(async (): Promise<void> => {
    const body = bodyText.trim()
    if (!body) { setCreateError('Write something first.'); return }
    if (!selectedPlatforms.length) { setCreateError('Select at least one platform.'); return }

    setCreateError(null)

    const createRes = await ipc.invoke(IPC_CHANNELS.POST_CREATE, {
      personaId: personaId || 'default',
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
  }, [bodyText, personaId, selectedPlatforms, generate])

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

  /** Save the current draft without generating variants */
  const handleSaveDraft = async (): Promise<void> => {
    const body = bodyText.trim()
    if (!body) { setCreateError('Write something first.'); return }
    setCreateError(null)

    const createRes = await ipc.invoke(IPC_CHANNELS.POST_CREATE, {
      personaId: personaId || 'default',
      body,
      platforms: selectedPlatforms,
    })
    if (createRes.ok) {
      setSavedPost(createRes.value)
      setPostSuccess('Draft saved')
      setTimeout(() => setPostSuccess(null), 2500)
    } else {
      setCreateError(createRes.error.message)
    }
  }

  /** Post immediately to the active platform (schedules 5 seconds from now) */
  const handlePostNow = async (): Promise<void> => {
    const variant = genState.variantMap[activePlatform]
    if (!variant) { setCreateError('Generate variants first, then post.'); return }

    let post = savedPost
    if (!post) {
      const body = bodyText.trim()
      if (!body) { setCreateError('Write something first.'); return }
      const createRes = await ipc.invoke(IPC_CHANNELS.POST_CREATE, {
        personaId: personaId || 'default',
        body,
        platforms: selectedPlatforms,
      })
      if (!createRes.ok) { setCreateError(createRes.error.message); return }
      post = createRes.value
      setSavedPost(post)
    }

    setPosting(true)
    setCreateError(null)

    const scheduledAt = new Date(Date.now() + 5000).toISOString()
    const res = await ipc.invoke(IPC_CHANNELS.POST_SCHEDULE, {
      postId: post.id,
      variantId: variant.id,
      platform: activePlatform,
      scheduledAt,
    })

    setPosting(false)
    if (res.ok) {
      setPostSuccess(`Posting to ${PLATFORM_LABELS[activePlatform]}…`)
      setTimeout(() => setPostSuccess(null), 4000)
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
          {/* Persona selector */}
          {personas.length > 0 ? (
            <div className="flex items-center gap-1.5" style={{ fontSize: 13 }}>
              <UserCircle2 size={14} style={{ color: 'var(--color-text-muted)' }} />
              <select
                className="form-input text-xs"
                style={{ padding: '4px 8px', height: 30 }}
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--color-warning)' }}
              onClick={() => window.dispatchEvent(new CustomEvent('nav', { detail: 'personas' }))}
            >
              <UserCircle2 size={13} />
              Create a persona first
            </button>
          )}
          {genState.status !== 'idle' && (
            <button onClick={resetGen} className="btn btn-ghost btn-icon" title="Reset">
              <RotateCcw size={14} />
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !personaId}
            className="btn btn-primary"
          >
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
              editorRef={handleEditorRef}
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

          {/* Footer: actions */}
          {genState.status !== 'idle' && (
            <div
              className="flex items-center gap-2 py-3"
              style={{ paddingLeft: 24, paddingRight: 24, borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}
            >
              {/* Success message */}
              {postSuccess && (
                <span className="text-xs flex-1" style={{ color: 'var(--color-success)' }}>
                  <CheckCircle size={12} className="inline mr-1" />
                  {postSuccess}
                </span>
              )}

              {scheduleStep === 'idle' ? (
                <>
                  {savedPost && !postSuccess && (
                    <span className="text-xs text-[var(--color-text-muted)] flex-1">
                      Saved · {savedPost.id.slice(0, 8)}
                    </span>
                  )}
                  {!savedPost && !postSuccess && <span className="flex-1" />}

                  {/* Save Draft */}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleSaveDraft}
                    title="Save as draft without posting"
                  >
                    <Save size={12} />
                    Save Draft
                  </button>

                  {/* Post Now */}
                  {activeVariant && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handlePostNow}
                      disabled={posting}
                      title={`Post immediately to ${PLATFORM_LABELS[activePlatform]}`}
                    >
                      <Send size={12} />
                      {posting ? 'Posting…' : `Post Now`}
                    </button>
                  )}

                  {/* Schedule */}
                  {activeVariant && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => { setSchedulingPlatform(activePlatform); setScheduleStep('scheduling') }}
                    >
                      <CalendarDays size={12} />
                      Schedule
                    </button>
                  )}
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

          {/* Save Draft button even before generating */}
          {genState.status === 'idle' && (
            <div
              className="flex items-center justify-end gap-2 py-3"
              style={{ paddingLeft: 24, paddingRight: 24, borderTop: '1px solid var(--color-border)' }}
            >
              {postSuccess && (
                <span className="text-xs mr-auto" style={{ color: 'var(--color-success)' }}>
                  <CheckCircle size={12} className="inline mr-1" />
                  {postSuccess}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleSaveDraft}>
                <Save size={12} />
                Save Draft
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
