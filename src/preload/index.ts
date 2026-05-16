/**
 * @module preload/index
 * Electron preload script — exposes `window.api` to the renderer.
 *
 * RULES:
 *  - contextIsolation: true. No raw ipcRenderer in renderer.
 *  - Expose ONLY typed wrappers. No Node APIs leak through.
 *  - Every invoke returns Result<T, AppError>.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { IPCMap } from '../shared/ipc-types'

/**
 * Typed invoke wrapper.
 * Renderer calls: window.api.invoke('post:create', payload)
 */
function invoke<K extends keyof IPCMap>(
  channel: K,
  payload: IPCMap[K]['req']
): Promise<IPCMap[K]['res']> {
  return ipcRenderer.invoke(channel as string, payload)
}

/**
 * Listen to main→renderer events (e.g. streaming chunks).
 */
function on(channel: string, callback: (...args: unknown[]) => void): () => void {
  const handler = (_: Electron.IpcRendererEvent, ...args: unknown[]): void => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

/** The typed API surface exposed to the renderer. */
const api = {
  invoke,
  on,
  /** Electron app version — safe to expose. */
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version')
}

contextBridge.exposeInMainWorld('api', api)

// Type augmentation for renderer — consumed by src/renderer/src/lib/ipc.ts
export type API = typeof api
