/**
 * @module persona
 * Persona and style fingerprint types shared across main and renderer.
 */

/** A style fingerprint computed from the user's historical posts. */
export interface StyleFingerprint {
  id: string
  personaId: string
  /** Vector embedding of average writing style (for cosine similarity). */
  embedding: number[]
  /** Human-readable style descriptors extracted by LLM. */
  descriptors: string[]
  /** Average sentence length in words. */
  avgSentenceLength: number
  /** Dominant tone (professional, casual, humorous, etc.). */
  tone: string
  computedAt: Date
}

/** A user persona — the authoring identity for content creation. */
export interface Persona {
  id: string
  name: string
  /** Short biography used in prompt context. */
  bio: string
  /** Content pillars — topics this persona focuses on. */
  pillars: string[]
  /** Writing style hints for the prompt builder. */
  styleHints: string
  latestFingerprint?: StyleFingerprint
  createdAt: Date
  updatedAt: Date
}
