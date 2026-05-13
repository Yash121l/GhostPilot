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
  generate: (postId: string, platforms: Platform[]) => Promise<void>
  reset: () => void
}

const IDLE: GeneratorState = { status: 'idle', post: null, variantMap: {}, error: null }

export function useVariantGenerator(): UseVariantGenerator {
  const [state, setState] = useState<GeneratorState>(IDLE)
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (postId: string, platforms: Platform[]): Promise<void> => {
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
      })

      if (ctrl.signal.aborted) return

      if (!res.ok) {
        setState((prev) => ({ ...prev, status: 'error', error: res.error.message }))
        return
      }

      const post = res.value
      const variantMap = Object.fromEntries(
        post.variants.map((v) => [v.platform, v]),
      ) as Partial<Record<Platform, DraftVariant>>

      setState({ status: 'done', post, variantMap, error: null })
    } catch (e) {
      if (ctrl.signal.aborted) return
      setState((prev) => ({ ...prev, status: 'error', error: String(e) }))
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(IDLE)
  }, [])

  return { state, generate, reset }
}
