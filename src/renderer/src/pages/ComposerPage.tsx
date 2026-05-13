import { useState, useCallback, type ReactElement } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Sparkles, Loader2, CheckCircle, AlertCircle, Briefcase, AtSign, Camera } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import { nanoid } from 'nanoid'
import type { Post, DraftVariant } from '@shared/types/post'
import { Platform, PLATFORM_CHAR_LIMITS, PLATFORM_LABELS } from '@shared/types/platform'
import { AITask, ModelHint } from '@shared/types/ai'

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

const PLATFORMS = [Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM]

interface VariantTab {
  platform: Platform
  variant?: DraftVariant
}

export default function ComposerPage(): ReactElement {
  const [personaId] = useState('')
  const [activePlatform, setActivePlatform] = useState<Platform>(Platform.LINKEDIN)
  const [variants, setVariants] = useState<VariantTab[]>(PLATFORMS.map((p) => ({ platform: p })))
  const [generating, setGenerating] = useState(false)
  const [post, setPost] = useState<Post | null>(null)
  const [error, setError] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({
        placeholder: 'Write your post — a rough idea, full draft, or anything in between. AI will adapt it for each platform…',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[180px] focus:outline-none text-[var(--color-text-primary)] leading-relaxed text-sm',
      },
    },
  })

  const handleGenerate = useCallback(async () => {
    const body = editor?.getText().trim()
    if (!body) { setError('Write something first.'); return }

    setError(null)
    setGenerating(true)

    try {
      const createRes = await ipc.invoke(IPC_CHANNELS.POST_CREATE, {
        personaId: personaId || 'default',
        body,
        platforms: PLATFORMS,
      })

      if (!createRes.ok) {
        const draftPost = await createDraftLocally(body)
        setPost(draftPost)
        setVariants(PLATFORMS.map((p) => ({ platform: p, variant: draftPost.variants.find((v) => v.platform === p) })))
        return
      }

      const createdPost = createRes.value
      const variantRes = await ipc.invoke(IPC_CHANNELS.POST_GENERATE_VARIANTS, {
        postId: createdPost.id,
        platforms: PLATFORMS,
        traceId: nanoid(),
      })

      if (!variantRes.ok) { setError(variantRes.error.message); return }

      const updatedPost = variantRes.value
      setPost(updatedPost)
      setVariants(PLATFORMS.map((p) => ({
        platform: p,
        variant: updatedPost.variants.find((v) => v.platform === p),
      })))
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }, [editor, personaId])

  async function createDraftLocally(body: string): Promise<Post> {
    const now = new Date()
    const mockVariants: DraftVariant[] = []
    for (const platform of PLATFORMS) {
      const res = await ipc.invoke(IPC_CHANNELS.AI_COMPLETE, {
        task: AITask.ADAPT_VARIANT,
        hint: ModelHint.ECONOMY,
        prompt: `Adapt this post for ${platform}:\n\n${body}\n\nReturn only the adapted post text.`,
        traceId: nanoid(),
        maxTokens: 500,
      })
      if (res.ok) {
        const text = res.value.text.trim()
        mockVariants.push({
          id: nanoid(), postId: 'local', platform, body: text,
          charCount: text.length, styleDriftScore: 0, createdAt: now,
          provider: res.value.provider, modelId: res.value.modelId,
        })
      }
    }
    return {
      id: 'local', personaId: 'default', status: 'draft' as never,
      body, platforms: PLATFORMS, variants: mockVariants,
      attempts: 0, createdAt: now, updatedAt: now,
    }
  }

  const activeVariant = variants.find((v) => v.platform === activePlatform)
  const charLimit = PLATFORM_CHAR_LIMITS[activePlatform]
  const charCount = activeVariant?.variant?.charCount ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Composer</h1>
          <p className="page-subtitle">Write once — AI adapts for every platform</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn btn-primary"
        >
          {generating
            ? <Loader2 size={14} className="animate-spin" />
            : <Sparkles size={14} />}
          {generating ? 'Generating…' : 'Generate Variants'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: source editor */}
        <div className="flex flex-col border-r border-[var(--color-border-subtle)]" style={{ width: '50%' }}>
          <div className="sub-panel-header">
            <div className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)] animate-pulse-glow" />
            <span className="sub-panel-title">Source Draft</span>
          </div>

          <div
            className="flex-1 overflow-y-auto py-5"
            style={{
              paddingLeft: 28, paddingRight: 28,
              background: 'linear-gradient(180deg, hsla(265,89%,65%,0.02) 0%, transparent 30%)',
            }}
          >
            <EditorContent editor={editor} />
          </div>

          {error && (
            <div
              className="mb-3 flex items-center gap-2 text-xs rounded-xl px-4 py-2.5"
              style={{
                marginLeft: 28, marginRight: 28,
                color: 'var(--color-error)',
                background: 'hsla(0,84%,60%,0.08)',
                border: '1px solid hsla(0,84%,60%,0.2)',
              }}
            >
              <AlertCircle size={12} />
              {error}
            </div>
          )}
        </div>

        {/* Right: platform variants */}
        <div className="flex flex-col" style={{ width: '50%' }}>
          <div className="tab-bar">
            {variants.map(({ platform, variant: v }) => {
              const Icon = PLATFORM_ICONS[platform]
              const isActive = activePlatform === platform
              const color = PLATFORM_COLORS[platform]
              return (
                <button
                  key={platform}
                  onClick={() => setActivePlatform(platform)}
                  className={`tab-item ${isActive ? 'active' : ''}`}
                  style={isActive ? { color } : undefined}
                >
                  <Icon size={13} />
                  {PLATFORM_LABELS[platform]}
                  {v && (
                    <CheckCircle size={11} className="text-[var(--color-success)]" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto py-5" style={{ paddingLeft: 28, paddingRight: 28 }}>
            {activeVariant?.variant ? (
              <div className="space-y-3">
                <div
                  className="text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap rounded-2xl p-5"
                  style={{
                    background: 'hsla(225,12%,13%,0.9)',
                    border: `1px solid ${PLATFORM_COLORS[activePlatform]}30`,
                    boxShadow: `0 0 24px ${PLATFORM_COLORS[activePlatform]}10`,
                    minHeight: 120,
                  }}
                >
                  {activeVariant.variant.body}
                </div>

                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="progress-track"
                      style={{ width: 80 }}
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, (charCount / charLimit) * 100)}%`,
                          background: charCount > charLimit * 0.9 ? 'var(--color-error)' : PLATFORM_COLORS[activePlatform],
                        }}
                      />
                    </div>
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: charCount > charLimit * 0.9 ? 'var(--color-error)' : 'var(--color-text-muted)' }}
                    >
                      {charCount} / {charLimit}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {activeVariant.variant.provider} · {activeVariant.variant.modelId}
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state h-full">
                <div className="empty-icon-wrap">
                  {generating
                    ? <Loader2 size={22} className="animate-spin text-[var(--color-brand-primary)]" />
                    : <Sparkles size={22} />}
                </div>
                <p className="empty-title">
                  {generating ? `Adapting for ${PLATFORM_LABELS[activePlatform]}…` : 'No variant yet'}
                </p>
                {!generating && (
                  <p className="empty-text">
                    Write your draft on the left, then hit Generate to see it adapted for each platform.
                  </p>
                )}
              </div>
            )}
          </div>

          {post && post.id !== 'local' && (
            <div
              className="py-3 flex items-center gap-3"
              style={{ paddingLeft: 28, paddingRight: 28, borderTop: '1px solid var(--color-border-subtle)' }}
            >
              <CheckCircle size={13} className="text-[var(--color-success)]" />
              <span className="text-xs text-[var(--color-text-muted)]">
                Saved · {post.id.slice(0, 8)}
              </span>
              <button
                className="btn btn-secondary btn-sm ml-auto"
                onClick={() => window.dispatchEvent(new CustomEvent('nav', { detail: 'calendar' }))}
              >
                Schedule →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
