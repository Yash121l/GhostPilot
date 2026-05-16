import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { FileText, Sparkles } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { Platform } from '@shared/types/platform'
import { PostStatus, type ImageAttachment, type Post } from '@shared/types/post'
import type { Persona } from '@shared/types/persona'
import type { ProviderKeyConfig } from '@shared/types/ai'
import type { LocalAgentStatus } from '@shared/ipc-types'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import { useVariantGenerator } from '../../hooks/useVariantGenerator'
import { useComposerStore } from '../../store/composer'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ComposerWorkspace } from '../../components/composer/ComposerWorkspace'
import { ComposerHeader } from '../../components/composer/ComposerHeader'
import { ComposerEditorPanel } from '../../components/composer/ComposerEditorPanel'
import { ComposerVariantPanel } from '../../components/composer/ComposerVariantPanel'
import { ComposerActionBar } from '../../components/composer/ComposerActionBar'

export default function ComposerPage(): ReactElement {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personaId, setPersonaId] = useState('')
  const [personaName, setPersonaName] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [activePlatform, setActivePlatform] = useState<Platform>(Platform.LINKEDIN)
  const [savedPost, setSavedPost] = useState<Post | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [posting, setPosting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [imageGenPrompt, setImageGenPrompt] = useState('')
  const [imageGenOpen, setImageGenOpen] = useState(false)
  const [imageGenLoading, setImageGenLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null)
  const [providerId, setProviderId] = useState('auto')
  const [providerOptions, setProviderOptions] = useState<
    Array<{ id: string; label: string; disabled?: boolean }>
  >([{ id: 'auto', label: 'Auto' }])
  const [reviewPosts, setReviewPosts] = useState<Post[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)

  const editorRef = useRef<Editor | null>(null)
  const { state: genState, generate, loadPost, reset: resetGen } = useVariantGenerator()
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

  const loadProviderOptions = useCallback(async (): Promise<void> => {
    const [keysRes, ollamaRes, agentRes, preferredRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}),
      ipc.invoke(IPC_CHANNELS.AI_OLLAMA_STATUS, {}),
      ipc.invoke(IPC_CHANNELS.LOCAL_AGENT_STATUS, {}),
      ipc.invoke(IPC_CHANNELS.SETTINGS_GET, { key: 'ai:preferredProviderId' })
    ])
    const options: Array<{ id: string; label: string; disabled?: boolean }> = [
      { id: 'auto', label: 'Auto' }
    ]
    if (keysRes.ok) {
      for (const key of keysRes.value as ProviderKeyConfig[]) {
        options.push({
          id: `key:${key.id}`,
          label: `${key.label || key.provider} (${key.provider})`
        })
      }
    }
    if (ollamaRes.ok) {
      options.push({
        id: 'ollama',
        label: ollamaRes.value.available ? 'Ollama local' : 'Ollama unavailable',
        disabled: !ollamaRes.value.available
      })
    }
    if (agentRes.ok) {
      for (const agent of agentRes.value as LocalAgentStatus[]) {
        options.push({
          id: agent.provider,
          label: agent.provider === 'codex-cli' ? 'Codex CLI' : 'Claude Code',
          disabled: !agent.installed || !agent.authenticated
        })
      }
    }
    setProviderOptions(options)
    const preferred = preferredRes.ok ? ((preferredRes.value as string | null) ?? 'auto') : 'auto'
    setProviderId(
      options.some((option) => option.id === preferred && !option.disabled) ? preferred : 'auto'
    )
  }, [])

  const loadReviewPosts = useCallback(async (): Promise<void> => {
    const res = await ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 100 })
    if (res.ok) {
      setReviewPosts(res.value.filter((post) => post.status === PostStatus.PENDING_APPROVAL))
    }
  }, [])

  useEffect(() => {
    void loadProviderOptions()
    void loadReviewPosts()
    const onProviderChange = (event: Event): void => {
      const next = (event as CustomEvent<string>).detail
      setProviderId(next || 'auto')
      void loadProviderOptions()
    }
    const onReview = (): void => {
      setReviewOpen(true)
      void loadReviewPosts()
    }
    const onPostsChanged = (): void => {
      void loadReviewPosts()
    }
    window.addEventListener('ai:preferred-provider-changed', onProviderChange)
    window.addEventListener('composer:review-queue', onReview)
    window.addEventListener('posts:changed', onPostsChanged)
    return () => {
      window.removeEventListener('ai:preferred-provider-changed', onProviderChange)
      window.removeEventListener('composer:review-queue', onReview)
      window.removeEventListener('posts:changed', onPostsChanged)
    }
  }, [loadProviderOptions, loadReviewPosts])

  const handleClear = useCallback((): void => {
    editorRef.current?.commands.clearContent()
    setBodyText('')
    setSavedPost(null)
    setCreateError(null)
    setSuccessMsg(null)
    setScheduleOpen(false)
    setScheduleAt('')
    setImages([])
    setImageGenOpen(false)
    setImageGenPrompt('')
    resetGen()
  }, [resetGen])

  useEffect(() => {
    window.addEventListener('composer:new-draft', handleClear)
    return () => window.removeEventListener('composer:new-draft', handleClear)
  }, [handleClear])

  const handleEditorRef = useCallback(
    (editor: Editor | null) => {
      editorRef.current = editor
      if (editor && prefill) {
        editor.commands.setContent(prefill)
        setBodyText(prefill)
        setPrefill(null)
      }
    },
    [prefill, setPrefill]
  )

  useEffect(() => {
    if (prefill && editorRef.current) {
      editorRef.current.commands.setContent(prefill)
      setBodyText(prefill)
      setPrefill(null)
    }
  }, [prefill, setPrefill])

  const handleAttachImage = useCallback(async (): Promise<void> => {
    if (images.length >= 4) {
      setCreateError('Maximum 4 images per post.')
      return
    }
    const res = await ipc.invoke(IPC_CHANNELS.MEDIA_OPEN_DIALOG, {})
    if (!res.ok) {
      setCreateError(res.error.message)
      return
    }
    const newImages = [...images, ...res.value].slice(0, 4)
    setImages(newImages)
    if (savedPost) {
      await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: savedPost.id, images: newImages })
    }
  }, [images, savedPost])

  const handleGenerateImage = useCallback(async (): Promise<void> => {
    const prompt = imageGenPrompt.trim() || bodyText.trim()
    if (!prompt) {
      setCreateError('Enter a prompt or write some text first.')
      return
    }
    if (images.length >= 4) {
      setCreateError('Maximum 4 images per post.')
      return
    }
    setImageGenLoading(true)
    setCreateError(null)
    const res = await ipc.invoke(IPC_CHANNELS.AI_IMAGE_GENERATE, { prompt })
    setImageGenLoading(false)
    if (!res.ok) {
      setCreateError(res.error.message)
      return
    }
    const newImages = [...images, res.value].slice(0, 4)
    setImages(newImages)
    setImageGenOpen(false)
    setImageGenPrompt('')
    if (savedPost) {
      await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: savedPost.id, images: newImages })
    }
  }, [bodyText, imageGenPrompt, images, savedPost])

  const handleRemoveImage = useCallback(
    async (localPath: string): Promise<void> => {
      const newImages = images.filter((image) => image.localPath !== localPath)
      setImages(newImages)
      if (savedPost) {
        await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: savedPost.id, images: newImages })
      }
    },
    [images, savedPost]
  )

  const handleGenerate = useCallback(async (): Promise<void> => {
    const body = bodyText.trim()
    if (!body) {
      setCreateError('Write something first.')
      return
    }
    if (!selectedPlatforms.length) {
      setCreateError('Pick at least one platform above to post to.')
      return
    }
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
        images
      })
      if (!createRes.ok) {
        setCreateError(createRes.error.message)
        return
      }
      post = createRes.value
      setSavedPost(post)
    } else if (images.length) {
      await ipc.invoke(IPC_CHANNELS.POST_SET_IMAGES, { postId: post.id, images })
    }

    await generate(post.id, selectedPlatforms, providerId === 'auto' ? undefined : providerId)
    window.dispatchEvent(new CustomEvent('posts:changed'))
  }, [bodyText, generate, images, personaId, providerId, savedPost, selectedPlatforms])

  const handleProviderChange = async (nextProviderId: string): Promise<void> => {
    setProviderId(nextProviderId)
    await ipc.invoke(IPC_CHANNELS.SETTINGS_SET, {
      key: 'ai:preferredProviderId',
      value: nextProviderId === 'auto' ? null : nextProviderId
    })
    window.dispatchEvent(
      new CustomEvent('ai:preferred-provider-changed', { detail: nextProviderId })
    )
  }

  const openReviewPost = (post: Post): void => {
    setSavedPost(post)
    setBodyText(post.body)
    setSelectedPlatforms(post.platforms)
    setActivePlatform(post.variants[0]?.platform ?? post.platforms[0] ?? Platform.LINKEDIN)
    setImages(post.images)
    setCreateError(null)
    setSuccessMsg(null)
    editorRef.current?.commands.setContent(post.body)
    loadPost(post)
  }

  const handleCopy = async (): Promise<void> => {
    const variant = genState.variantMap[activePlatform]
    if (!variant) return
    await navigator.clipboard.writeText(variant.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleScheduleConfirm = async (): Promise<void> => {
    if (!savedPost || !scheduleAt) return
    const variant = genState.variantMap[activePlatform]
    if (!variant) {
      setCreateError('Generate a variant first.')
      return
    }

    const res = await ipc.invoke(IPC_CHANNELS.POST_SCHEDULE, {
      postId: savedPost.id,
      variantId: variant.id,
      platform: activePlatform,
      scheduledAt: new Date(scheduleAt).toISOString()
    })
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('posts:changed'))
      setScheduleOpen(false)
      setSuccessMsg('Scheduled')
      setTimeout(() => {
        setSuccessMsg(null)
        handleClear()
      }, 1800)
      window.dispatchEvent(new CustomEvent('nav', { detail: 'calendar' }))
    } else {
      setCreateError(res.error.message)
    }
  }

  const handlePublishNow = async (): Promise<void> => {
    const variant = genState.variantMap[activePlatform]
    if (!variant || !savedPost || posting) {
      setCreateError('Generate variants first.')
      return
    }

    setPosting(true)
    setCreateError(null)
    const res = await ipc.invoke(IPC_CHANNELS.POST_SCHEDULE, {
      postId: savedPost.id,
      variantId: variant.id,
      platform: activePlatform,
      scheduledAt: new Date(Date.now() + 5000).toISOString()
    })
    setPosting(false)
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('posts:changed'))
      setSuccessMsg('Publishing...')
      setTimeout(() => {
        setSuccessMsg(null)
        handleClear()
      }, 2400)
    } else {
      setCreateError(res.error.message)
    }
  }

  const togglePlatform = (platform: Platform): void => {
    setSelectedPlatforms((current) => {
      if (current.includes(platform)) {
        const next = current.filter((item) => item !== platform)
        if (activePlatform === platform && next.length > 0) setActivePlatform(next[0])
        return next
      }
      setActivePlatform(platform)
      return [...current, platform]
    })
  }

  const handlePersonaChange = (nextPersonaId: string): void => {
    const persona = personas.find((item) => item.id === nextPersonaId)
    setPersonaId(nextPersonaId)
    setPersonaName(persona?.name ?? '')
  }

  const generating = genState.status === 'loading'
  const hasVariant = Boolean(genState.variantMap[activePlatform])
  const canGenerate = bodyText.trim().length > 0 && selectedPlatforms.length > 0 && !generating
  const error = createError ?? genState.error

  return (
    <ComposerWorkspace>
      <ComposerHeader
        personas={personas}
        personaId={personaId}
        providerId={providerId}
        providerOptions={providerOptions}
        hasVariant={hasVariant}
        onPersonaChange={handlePersonaChange}
        onProviderChange={handleProviderChange}
        onClear={handleClear}
        onAttachImage={handleAttachImage}
        onOpenImageGenerator={() => setImageGenOpen(true)}
      />
      <div className="composer-main-grid">
        <ComposerEditorPanel
          selectedPlatforms={selectedPlatforms}
          activePlatform={activePlatform}
          images={images}
          error={error}
          onTogglePlatform={togglePlatform}
          onEditorChange={setBodyText}
          onEditorRef={handleEditorRef}
          onAttachImage={handleAttachImage}
          onOpenImageGenerator={() => setImageGenOpen(true)}
          onPreviewImage={setPreviewImage}
          onRemoveImage={handleRemoveImage}
        />
        <ComposerVariantPanel
          selectedPlatforms={selectedPlatforms}
          activePlatform={activePlatform}
          variants={genState.variantMap}
          generating={generating}
          copied={copied}
          posting={posting}
          successMsg={successMsg}
          scheduleOpen={scheduleOpen}
          scheduleAt={scheduleAt}
          onActivePlatformChange={setActivePlatform}
          onCopy={handleCopy}
          onPublishNow={handlePublishNow}
          onOpenSchedule={() => setScheduleOpen(true)}
          onScheduleAtChange={setScheduleAt}
          onScheduleConfirm={handleScheduleConfirm}
          onCancelSchedule={() => setScheduleOpen(false)}
        />
      </div>
      {reviewOpen || reviewPosts.length > 0 ? (
        <section className="composer-review-queue">
          <div className="settings-section-title">
            <div>
              <span>Review</span>
              <h2>Posts needing review</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReviewOpen((open) => !open)}>
              {reviewOpen ? 'Hide' : 'Show'}
            </Button>
          </div>
          {reviewOpen ? (
            reviewPosts.length > 0 ? (
              <div className="settings-list">
                {reviewPosts.map((post) => (
                  <button
                    key={post.id}
                    className="settings-card settings-key-row composer-review-row"
                    onClick={() => openReviewPost(post)}
                  >
                    <div className="settings-icon-cell">
                      <FileText size={15} />
                    </div>
                    <div className="settings-row-main">
                      <strong>{post.body.slice(0, 90) || 'Untitled draft'}</strong>
                      <p>
                        {post.variants.length} variant{post.variants.length === 1 ? '' : 's'} ·{' '}
                        {post.platforms.join(', ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="settings-empty">No posts currently need review.</div>
            )
          ) : null}
        </section>
      ) : null}
      <ComposerActionBar
        personaId={personaId}
        personaName={personaName}
        imageCount={images.length}
        selectedPlatformCount={selectedPlatforms.length}
        bodyLength={bodyText.length}
        bodyText={bodyText}
        generating={generating}
        hasVariant={hasVariant}
        canGenerate={canGenerate}
        onGenerate={handleGenerate}
        onClear={handleClear}
      />

      <Dialog
        open={imageGenOpen}
        title="Generate image"
        description="Use a custom prompt, or leave it blank to use the draft text."
        onOpenChange={setImageGenOpen}
      >
        <div className="composer-dialog-body">
          <Input
            value={imageGenPrompt}
            onChange={(event) => setImageGenPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleGenerateImage()
            }}
            placeholder="Describe the image..."
          />
          <Button
            variant="primary"
            loading={imageGenLoading}
            leftIcon={<Sparkles size={14} />}
            onClick={handleGenerateImage}
          >
            Create image
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(previewImage)}
        title="Image preview"
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null)
        }}
        className="image-preview-dialog"
      >
        {previewImage ? (
          <div className="image-preview-body">
            <img src={previewImage.dataUrl ?? `file://${previewImage.localPath}`} alt="" />
          </div>
        ) : null}
      </Dialog>
    </ComposerWorkspace>
  )
}
