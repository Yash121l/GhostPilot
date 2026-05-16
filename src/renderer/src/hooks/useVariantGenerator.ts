import { useState, useCallback, useRef } from 'react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Post, DraftVariant } from '@shared/types/post'
import type { Platform } from '@shared/types/platform'
import { nanoid } from 'nanoid'

export type GeneratorStatus = 'idle' | 'loading' | 'done' | 'error'

export interface GeneratorState {
  status: GeneratorStatus
  post: Post | null
  /** Per-platform variants indexed by platform string. */
  variantMap: Partial<Record<Platform, DraftVariant>>
  error: string | null
}

export interface UseVariantGenerator {
  state: GeneratorState
  generate: (postId: string, platforms: Platform[], preferredProviderId?: string) => Promise<void>
  loadPost: (post: Post) => void
  reset: () => void
}

const IDLE: GeneratorState = { status: 'idle', post: null, variantMap: {}, error: null }

function userFacingGenerationError(message: string): string {
  if (/no ai provider|provider not configured/i.test(message)) {
    return 'No AI provider available. Add an API key or sign in to a local agent.'
  }
  if (/codex cli|\/codex|codex exec/i.test(message)) {
    return 'Codex CLI failed. Check sign-in or choose an API provider in Settings.'
  }
  if (/claude code|\/claude/i.test(message)) {
    return 'Claude Code failed. Check sign-in or choose an API provider in Settings.'
  }
  if (/openai/i.test(message)) {
    return 'OpenAI request failed. Check your API key or try another provider.'
  }
  if (/anthropic|claude/i.test(message)) {
    return 'Anthropic request failed. Check your API key or try another provider.'
  }
  if (/source draft:|persona:|platform instructions:|output:|command failed:/i.test(message)) {
    return 'AI provider request failed. Try another provider in Settings.'
  }
  return message.length > 220 ? `${message.slice(0, 217)}...` : message
}

export function useVariantGenerator(): UseVariantGenerator {
  const [state, setState] = useState<GeneratorState>(IDLE)
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(
    async (postId: string, platforms: Platform[], preferredProviderId?: string): Promise<void> => {
      // Cancel any in-flight generation
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setState({ status: 'loading', post: null, variantMap: {}, error: null })

      try {
        const res = await ipc.invoke(IPC_CHANNELS.POST_GENERATE_VARIANTS, {
          postId,
          platforms,
          traceId: nanoid(),
          preferredProviderId
        })

        if (ctrl.signal.aborted) return

        if (!res.ok) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: userFacingGenerationError(res.error.message)
          }))
          return
        }

        const post = res.value
        const variantMap = Object.fromEntries(post.variants.map((v) => [v.platform, v])) as Partial<
          Record<Platform, DraftVariant>
        >

        setState({ status: 'done', post, variantMap, error: null })
      } catch (e) {
        if (ctrl.signal.aborted) return
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: userFacingGenerationError(String(e))
        }))
      }
    },
    []
  )

  const loadPost = useCallback((post: Post): void => {
    const variantMap = Object.fromEntries(post.variants.map((v) => [v.platform, v])) as Partial<
      Record<Platform, DraftVariant>
    >
    setState({ status: post.variants.length ? 'done' : 'idle', post, variantMap, error: null })
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(IDLE)
  }, [])

  return { state, generate, loadPost, reset }
}
