import { useState, useCallback, useRef, useEffect, type ReactElement } from 'react'
import {
  Sparkles, Briefcase, AtSign, Camera, CalendarDays,
  Copy, Send, AlertCircle, CheckCircle, Trash2, Paperclip, ImagePlus, X,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { Post, ImageAttachment } from '@shared/types/post'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'
import { useVariantGenerator } from '../../hooks/useVariantGenerator'
import { TiptapEditor } from '../../components/composer/TiptapEditor'
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
  [Platform.LINKEDIN]: '#0a66c2',
  [Platform.TWITTER]: '#e7e7e7',
  [Platform.INSTAGRAM]: '#e1306c',
}

// Optimal char ranges shown in the variant card
const PLATFORM_OPT: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'opt: 1300–2000',
  [Platform.TWITTER]: 'opt: < 280',
  [Platform.INSTAGRAM]: 'opt: 125–150',
}

export default function ComposerPage(): ReactElement {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personaId, setPersonaId] = useState<string>('')
  const [personaName, setPersonaName] = useState<string>('')
  const [activePlatform, setActivePlatform] = useState<Platform>(Platform.LINKEDIN)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(PLATFORMS)
  const [savedPost, setSavedPost] = useState<Post | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [scheduleStep, setScheduleStep] = useState<'idle' | 'open'>('idle')
  const [scheduleAt, setScheduleAt] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [posting, setPosting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [imageGenPrompt, setImageGenPrompt] = useState('')
  const [imageGenOpen, setImageGenOpen] = useState(false)
  const [imageGenLoading, setImageGenLoading] = useState(false)

  const editorRef = useRef<Editor | null>(null)
  const { state: genState, generate, reset: resetGen } = useVariantGenerator()
  const { prefill, setPrefill } = useComposerStore()

  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.PERSONA_LIST, {}).then((res) => {
      if (res.ok && res.value.length > 0) {
        setPersonas(res.value)
        setPersonaId(res.value[0].id)
        setPersonaName(res.value[0].name)
      }
    })
  }, [])

  const handleEditorRef = useCallback((e: Editor | null) => {
    editorRef.current = e
    if (e && prefill) {
      e.commands.setContent(prefill)
      setBodyText(prefill)
      setPrefill(null)
    }
  }, [prefill, setPrefill])

  useEffect(() => {
    if (prefill && editorRef.current) {
      editorRef.current.commands.setContent(prefill)
      setBodyText(prefill)
      setPrefill(null)
    }
  }, [prefill, setPrefill])

  const handleEditorChange = useCallback((text: string) => {
    setBodyText(text)
  }, [])

  const handleAttachImage = useCallback(async (): Promise<void> => {
    if (images.length >= 4) { setCreateError('Maximum 4 images per post.'); return }
    const res = await ipc.invoke(IPC_CHANNELS.MEDIA_OPEN_DIALOG, {})
    if (!res.ok) { setCreateError(res.error.message); return }
    const newImages = [...images, ...res.value].slice(0, 4)
    setImages(newImages)
    if (savedPost) {
      await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: savedPost.id, images: newImages })
    }
  }, [images, savedPost])

  const handleGenerateImage = useCallback(async (): Promise<void> => {
    const prompt = imageGenPrompt.trim() || bodyText.trim()
    if (!prompt) { setCreateError('Enter a prompt or write some text first.'); return }
    if (images.length >= 4) { setCreateError('Maximum 4 images per post.'); return }
    setImageGenLoading(true)
    setCreateError(null)
    const res = await ipc.invoke(IPC_CHANNELS.AI_IMAGE_GENERATE, { prompt })
    setImageGenLoading(false)
    if (!res.ok) { setCreateError(res.error.message); return }
    const newImages = [...images, res.value].slice(0, 4)
    setImages(newImages)
    setImageGenOpen(false)
    setImageGenPrompt('')
    if (savedPost) {
      await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: savedPost.id, images: newImages })
    }
  }, [imageGenPrompt, bodyText, images, savedPost])

  const handleRemoveImage = useCallback(async (localPath: string): Promise<void> => {
    const newImages = images.filter((img) => img.localPath !== localPath)
    setImages(newImages)
    if (savedPost) {
      await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: savedPost.id, images: newImages })
    }
  }, [images, savedPost])

  const handleGenerate = useCallback(async (): Promise<void> => {
    const body = bodyText.trim()
    if (!body) { setCreateError('Write something first.'); return }
    if (!selectedPlatforms.length) { setCreateError('Select at least one platform.'); return }
    setCreateError(null)

    let post = savedPost

    if (post) {
      const updateRes = await ipc.invoke(IPC_CHANNELS.POST_UPDATE_BODY, { id: post.id, body })
      if (updateRes.ok) {
        post = updateRes.value
        setSavedPost(post)
      } else {
        post = null
        setSavedPost(null)
      }
    }

    if (!post) {
      const createRes = await ipc.invoke(IPC_CHANNELS.POST_CREATE, {
        personaId: personaId || 'default',
        body,
        platforms: selectedPlatforms,
        images,
      })
      if (!createRes.ok) { setCreateError(createRes.error.message); return }
      post = createRes.value
      setSavedPost(post)
    } else if (images.length) {
      // Sync images to existing post
      await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: post.id, images })
    }

    await generate(post.id, selectedPlatforms)
  }, [bodyText, personaId, selectedPlatforms, savedPost, generate, images])

  const handleClear = useCallback((): void => {
    editorRef.current?.commands.clearContent()
    setBodyText('')
    setSavedPost(null)
    setCreateError(null)
    setSuccessMsg(null)
    setScheduleStep('idle')
    setScheduleAt('')
    setImages([])
    setImageGenOpen(false)
    setImageGenPrompt('')
    resetGen()
  }, [resetGen])

  const handleCopy = async (): Promise<void> => {
    const variant = genState.variantMap[activePlatform]
    if (!variant) return
    await navigator.clipboard.writeText(variant.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleScheduleConfirm = async (): Promise<void> => {
    if (!savedPost || !scheduleAt) return
    const variant = genState.variantMap[activePlatform]
    if (!variant) { setCreateError('Generate a variant first.'); return }

    const res = await ipc.invoke(IPC_CHANNELS.POST_SCHEDULE, {
      postId: savedPost.id,
      variantId: variant.id,
      platform: activePlatform,
      scheduledAt: new Date(scheduleAt).toISOString(),
    })
    if (res.ok) {
      setScheduleStep('idle')
      setSuccessMsg('Scheduled ✓')
      setTimeout(() => {
        setSuccessMsg(null)
        handleClear()
      }, 2000)
      window.dispatchEvent(new CustomEvent('nav', { detail: 'calendar' }))
    } else {
      setCreateError(res.error.message)
    }
  }

  const handlePublishNow = async (): Promise<void> => {
    const variant = genState.variantMap[activePlatform]
    if (!variant) { setCreateError('Generate variants first.'); return }
    if (!savedPost) { setCreateError('Generate variants first.'); return }
    if (posting) return // prevent double-click

    setPosting(true)
    setCreateError(null)
    const res = await ipc.invoke(IPC_CHANNELS.POST_SCHEDULE, {
      postId: savedPost.id,
      variantId: variant.id,
      platform: activePlatform,
      scheduledAt: new Date(Date.now() + 5000).toISOString(),
    })
    setPosting(false)
    if (res.ok) {
      setSuccessMsg(`Publishing to ${PLATFORM_LABELS[activePlatform]}…`)
      // Reset composer after successful publish
      setTimeout(() => {
        setSuccessMsg(null)
        handleClear()
      }, 3000)
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
  const charCount = activeVariant?.charCount ?? 0
  const generating = genState.status === 'loading'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>Composer</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Write once — AI adapts for every platform</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: generating ? 'var(--accent)' : 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: generating ? 0.75 : 1,
            }}
          >
            <Sparkles size={14} />
            {generating ? 'Generating…' : 'Generate Variants'}
          </button>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.35)',
            borderRadius: 6, padding: '5px 10px', background: 'var(--accent-soft)',
          }}>
            PHASE 1
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: editor ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          width: '50%', minWidth: 0, borderRight: '1px solid var(--border)',
        }}>
          {/* Platform chips */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginRight: 4 }}>
              Platforms
            </span>
            {PLATFORMS.map((p) => {
              const Icon = PLATFORM_ICONS[p]
              const on = selectedPlatforms.includes(p)
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 100,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: on ? `${PLATFORM_COLORS[p]}18` : 'transparent',
                    color: on ? PLATFORM_COLORS[p] : 'var(--text-3)',
                    border: `1px solid ${on ? PLATFORM_COLORS[p] + '55' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={11} />
                  {PLATFORM_LABELS[p]}
                </button>
              )
            })}
          </div>

          {/* Image bar */}
          <div style={{
            borderBottom: '1px solid var(--border)',
            padding: '8px 16px',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            {images.map((img) => (
              <div key={img.localPath} style={{
                position: 'relative', width: 52, height: 52, borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--border)', flexShrink: 0,
              }}>
                <img
                  src={`file://${img.localPath}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  alt=""
                />
                <button
                  onClick={() => handleRemoveImage(img.localPath)}
                  style={{
                    position: 'absolute', top: 1, right: 1,
                    background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                    width: 16, height: 16, cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  <X size={9} />
                </button>
              </div>
            ))}
            {images.length < 4 && (
              <>
                <button
                  onClick={handleAttachImage}
                  title="Attach image"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: 'transparent', color: 'var(--text-3)',
                    border: '1px dashed var(--border)', cursor: 'pointer',
                  }}
                >
                  <Paperclip size={11} /> Attach
                </button>
                <button
                  onClick={() => setImageGenOpen((v) => !v)}
                  title="Generate image with AI"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: imageGenOpen ? 'var(--accent-soft)' : 'transparent',
                    color: imageGenOpen ? 'var(--accent)' : 'var(--text-3)',
                    border: `1px dashed ${imageGenOpen ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <ImagePlus size={11} /> Generate
                </button>
              </>
            )}
          </div>

          {/* AI image generation prompt */}
          {imageGenOpen && (
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <input
                placeholder="Describe the image… (blank = use post text)"
                value={imageGenPrompt}
                onChange={(e) => setImageGenPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateImage() }}
                style={{
                  flex: 1, background: 'var(--bg-subtle)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 7,
                  padding: '6px 10px', fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={handleGenerateImage}
                disabled={imageGenLoading}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 7, padding: '6px 12px', fontSize: 12,
                  fontWeight: 600, cursor: imageGenLoading ? 'not-allowed' : 'pointer',
                  opacity: imageGenLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {imageGenLoading
                  ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  : <Sparkles size={11} />}
                {imageGenLoading ? 'Generating…' : 'Create'}
              </button>
            </div>
          )}

          {/* Editor */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TiptapEditor onChange={handleEditorChange} editorRef={handleEditorRef} />
          </div>

          {/* Error */}
          {(createError ?? genState.error) && (
            <div style={{
              margin: '0 16px 8px',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--error)',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '7px 12px',
            }}>
              <AlertCircle size={12} />
              {createError ?? genState.error}
            </div>
          )}

          {/* Footer: persona + chars + actions */}
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '10px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Persona + char count row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
                <span>🏷</span>
                <span>{images.length} image{images.length !== 1 ? 's' : ''}</span>
                {personaName && (
                  <>
                    <span style={{ color: 'var(--border-strong)' }}>·</span>
                    <span>Persona: <strong style={{ color: 'var(--text-2)' }}>{personaName}</strong></span>
                  </>
                )}
                {personas.length > 1 && (
                  <select
                    style={{
                      background: 'transparent', border: 'none', color: 'var(--accent)',
                      fontSize: 12, cursor: 'pointer', outline: 'none',
                    }}
                    value={personaId}
                    onChange={(e) => {
                      const p = personas.find((x) => x.id === e.target.value)
                      setPersonaId(e.target.value)
                      setPersonaName(p?.name ?? '')
                    }}
                  >
                    {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StyleDriftMeter personaId={personaId} text={bodyText} />
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                  {bodyText.length} chars
                </span>
              </div>
            </div>

            {/* Generate + Clear */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600,
                  cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1,
                }}
              >
                <Sparkles size={14} />
                {generating ? 'Generating…' : 'Generate Variants'}
              </button>
              <button
                onClick={handleClear}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-subtle)', color: 'var(--text-2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <Trash2 size={13} />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: variants ── */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '50%', minWidth: 0 }}>
          {/* Platform tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border)',
            padding: '0 16px', overflowX: 'auto',
          }}>
            {PLATFORMS.map((p) => {
              const Icon = PLATFORM_ICONS[p]
              const isActive = activePlatform === p
              const hasVariant = Boolean(genState.variantMap[p])
              return (
                <button
                  key={p}
                  onClick={() => setActivePlatform(p)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '11px 14px', fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? PLATFORM_COLORS[p] : 'var(--text-3)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: isActive ? `2px solid ${PLATFORM_COLORS[p]}` : '2px solid transparent',
                    marginBottom: -1, flexShrink: 0,
                  }}
                >
                  <Icon size={13} />
                  {PLATFORM_LABELS[p]}
                  {hasVariant && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--success)', display: 'inline-block',
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Variant content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {activeVariant ? (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                {/* Variant header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-subtle)',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                    Variant · {PLATFORM_LABELS[activePlatform]}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {charCount} chars
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {PLATFORM_OPT[activePlatform]}
                    </span>
                  </div>
                </div>

                {/* Variant body */}
                <div style={{
                  padding: '16px 18px',
                  fontSize: 14, lineHeight: 1.75, color: 'var(--text)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  minHeight: 200,
                }}>
                  {activeVariant.body}
                </div>

                {/* Variant actions */}
                {scheduleStep === 'idle' ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg-subtle)',
                    flexWrap: 'wrap',
                  }}>
                    {successMsg ? (
                      <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                        <CheckCircle size={12} /> {successMsg}
                      </span>
                    ) : (
                      <span style={{ flex: 1 }} />
                    )}
                    {/* Copy */}
                    <button
                      onClick={handleCopy}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg-card)', color: 'var(--text-2)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      <Copy size={13} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    {/* Schedule */}
                    <button
                      onClick={() => setScheduleStep('open')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg-card)', color: 'var(--text-2)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      <CalendarDays size={13} />
                      Schedule
                    </button>
                    {/* Publish now */}
                    <button
                      onClick={handlePublishNow}
                      disabled={posting}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--accent)', color: '#fff',
                        border: 'none', borderRadius: 8,
                        padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        opacity: posting ? 0.7 : 1,
                      }}
                    >
                      <Send size={13} />
                      {posting ? 'Publishing…' : 'Publish now'}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg-subtle)',
                  }}>
                    <input
                      type="datetime-local"
                      style={{
                        flex: 1, background: 'var(--bg-card)', color: 'var(--text)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '7px 10px', fontSize: 12, outline: 'none',
                      }}
                      value={scheduleAt}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setScheduleAt(e.target.value)}
                    />
                    <button
                      onClick={handleScheduleConfirm}
                      disabled={!scheduleAt}
                      style={{
                        background: 'var(--accent)', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '7px 14px', fontSize: 13,
                        fontWeight: 600, cursor: scheduleAt ? 'pointer' : 'not-allowed',
                        opacity: scheduleAt ? 1 : 0.5,
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setScheduleStep('idle')}
                      style={{
                        background: 'transparent', color: 'var(--text-3)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 12,
                color: 'var(--text-4)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {generating
                    ? <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    : <Sparkles size={22} />}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)' }}>
                  {generating ? `Adapting for ${PLATFORM_LABELS[activePlatform]}…` : 'No variant yet'}
                </div>
                {!generating && (
                  <div style={{ fontSize: 13, color: 'var(--text-4)', textAlign: 'center', maxWidth: 280 }}>
                    Write your draft on the left, then hit Generate to see platform-specific variants.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
