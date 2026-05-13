import { ElectronAPI } from '@electron-toolkit/preload'
import type { IPCMap } from '../shared/ipc-types'

type InvokeAPI = <K extends keyof IPCMap>(channel: K, payload: IPCMap[K]['req']) => Promise<IPCMap[K]['res']>
type OnAPI = (channel: string, callback: (...args: unknown[]) => void) => () => void

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      invoke: InvokeAPI
      on: OnAPI
      getVersion: () => Promise<string>
    }
  }
}
