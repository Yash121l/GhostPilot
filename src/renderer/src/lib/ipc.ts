/**
 * @module renderer/lib/ipc
 * Typed wrapper around window.api that provides full auto-completion in the renderer.
 * Import this instead of calling window.api directly.
 */

import type { IPCMap } from '@shared/ipc-types'
import { IPC_CHANNELS } from '@shared/ipc-types'

// Re-export for renderer convenience
export { IPC_CHANNELS }

/**
 * Typed IPC invoke. Returns the Result<T, AppError> from the main process.
 *
 * @example
 *   const result = await ipc.invoke('post:create', { personaId, body, platforms })
 *   if (!result.ok) { handleError(result.error); return }
 *   setPosts([...posts, result.value])
 */
export const ipc = {
  invoke<K extends keyof IPCMap>(channel: K, payload: IPCMap[K]['req']): Promise<IPCMap[K]['res']> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).api.invoke(channel, payload)
  },

  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).api.on(channel, callback)
  },
}
