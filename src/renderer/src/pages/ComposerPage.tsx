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
      Placeholder.configure({ placeholder: 'Write your post here — your full idea, rough notes, or a finished draft. The AI will adapt it for each platform...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[200px] focus:outline-none text-[var(--color-text-primary)] leading-relaxed',
      },
    },
  })

  const handleGenerate = useCallback(async () => {
    const body = editor?.getText().trim()
    if (!body) { setError('Write something first.'); return }

    setError(null)
    setGenerating(true)

    try {
      // 1. Create post (use first persona if available)
      const createRes = await ipc.invoke(IPC_CHANNELS.POST_CREATE, {
        personaId: personaId || 'default',
        body,
        platforms: PLATFORMS,
      })

      if (!createRes.ok) {
        // If no persona, create one on-the-fly via AI
        const draftPost = await createDraftLocally(body)
        setPost(draftPost)
        setVariants(PLATFORMS.map((p) => ({ platform: p, variant: draftPost.variants.find((v) => v.platform === p) })))
        return
      }

      const createdPost = createRes.value

      // 2. Generate variants
      const variantRes = await ipc.invoke(IPC_CHANNELS.POST_GENERATE_VARIANTS, {
        postId: createdPost.id,
        platforms: PLATFORMS,
        traceId: nanoid(),
      })

      if (!variantRes.ok) {
        setError(variantRes.error.message)
        return
      }

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

  // Fallback: generate using AI directly when no persona is set up yet
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
          id: nanoid(),
          postId: 'local',
          platform,
          body: text,
          charCount: text.length,
          styleDriftScore: 0,
          createdAt: now,
          provider: res.value.provider,
          modelId: res.value.modelId,
        })
      }
    }

    return {
      id: 'local',
      personaId: 'default',
      status: 'draft' as never,
      body,
      platforms: PLATFORMS,
      variants: mockVariants,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    }
  }

  const activeVariant = variants.find((v) => v.platform === activePlatform)
  const charLimit = PLATFORM_CHAR_LIMITS[activePlatform]
  const charCount = activeVariant?.variant?.charCount ?? 0

  return (
    <div className="flex flex-col h-full animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-base font-semibold text-white/90">Composer</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Write once, adapt for every platform</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: generating ? 'hsla(265,89%,65%,0.2)' : 'hsla(265,89%,65%,0.9)',
            color: '#fff',
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? 'Generating…' : 'Generate Variants'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Source editor */}
        <div className="w-1/2 flex flex-col border-r border-[var(--color-border-subtle)]">
          <div className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">
            Source Draft
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <EditorContent editor={editor} />
          </div>
          {error && (
            <div className="mx-6 mb-4 flex items-center gap-2 text-[var(--color-error)] text-xs bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle size={12} />
              {error}
            </div>
          )}
        </div>

        {/* Platform preview tabs */}
        <div className="w-1/2 flex flex-col">
          <div className="flex border-b border-[var(--color-border-subtle)]">
            {variants.map(({ platform }) => {
              const Icon = PLATFORM_ICONS[platform]
              const isActive = activePlatform === platform
              return (
                <button
                  key={platform}
                  onClick={() => setActivePlatform(platform)}
                  className="flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all"
                  style={{
                    color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                    borderBottom: isActive ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                  }}
                >
                  <Icon size={12} />
                  {PLATFORM_LABELS[platform]}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeVariant?.variant ? (
              <div>
                <div
                  className="text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap rounded-xl p-4"
                  style={{ background: 'hsla(225,12%,13%,0.6)', border: '1px solid var(--color-border-subtle)' }}
                >
                  {activeVariant.variant.body}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span
                    className="text-xs"
                    style={{ color: charCount > charLimit * 0.9 ? 'var(--color-error)' : 'var(--color-text-muted)' }}
                  >
                    {charCount} / {charLimit}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    via {activeVariant.variant.provider} · {activeVariant.variant.modelId}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                {generating ? (
                  <Loader2 size={24} className="animate-spin text-[var(--color-brand-primary)] mb-3" />
                ) : (
                  <Sparkles size={24} className="text-[var(--color-text-muted)] mb-3" />
                )}
                <p className="text-sm text-[var(--color-text-muted)]">
                  {generating ? `Generating ${PLATFORM_LABELS[activePlatform]} variant…` : 'Hit "Generate Variants" to see your adapted post'}
                </p>
              </div>
            )}
          </div>

          {/* Schedule row */}
          {post && post.id !== 'local' && (
            <div className="px-6 py-3 border-t border-[var(--color-border-subtle)] flex items-center gap-3">
              <CheckCircle size={14} className="text-[var(--color-success)]" />
              <span className="text-xs text-[var(--color-text-muted)]">Post saved · ID {post.id.slice(0, 8)}</span>
              <button
                className="ml-auto text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'hsla(265,89%,65%,0.15)', color: 'var(--color-brand-primary)' }}
                onClick={() => {
                  // Navigate to Calendar (handled in parent via state)
                  window.dispatchEvent(new CustomEvent('nav', { detail: 'calendar' }))
                }}
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
