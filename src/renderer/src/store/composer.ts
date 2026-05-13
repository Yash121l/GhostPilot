import { create } from 'zustand'

interface ComposerStore {
  /** Text to pre-fill the editor with on next mount/focus */
  prefill: string | null
  setPrefill: (text: string | null) => void
}

export const useComposerStore = create<ComposerStore>((set) => ({
  prefill: null,
  setPrefill: (text) => set({ prefill: text }),
}))
