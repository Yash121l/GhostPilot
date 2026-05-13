/**
 * @module post
 * Post-related shared types. Source of truth for post lifecycle states.
 */

import type { Platform } from './platform'

/** All possible lifecycle states for a post. */
export enum PostStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

/** A single AI-generated variant of a post. */
export interface DraftVariant {
  id: string
  postId: string
  platform: Platform
  body: string
  /** Estimated character count. */
  charCount: number
  /** Cosine similarity against style fingerprint [0, 1]. */
  styleDriftScore: number
  createdAt: Date
  /** Which AI provider generated this variant. */
  provider: string
  modelId: string
}

/** The core Post entity exposed to the renderer. */
export interface Post {
  id: string
  personaId: string
  status: PostStatus
  /** Primary content body (platform-agnostic draft). */
  body: string
  platforms: Platform[]
  variants: DraftVariant[]
  scheduledAt?: Date
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
  /** Number of publish attempts (max 3). */
  attempts: number
}

/** A scheduled publish job. */
export interface Job {
  id: string
  postId: string
  variantId: string
  platform: Platform
  scheduledAt: Date
  attempts: number
  lastError?: string
  status: 'pending' | 'running' | 'done' | 'failed'
}
