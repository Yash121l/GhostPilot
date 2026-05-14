/**
 * @module workers/publisher.worker
 * Publisher Worker Thread — runs independently of the main process.
 * Queries SQLite for due jobs, publishes via social connectors,
 * retries with exponential backoff, posts status events to main thread.
 *
 * Receives from main: { kind: 'tokens', jobId, tokens } | { kind: 'shutdown' }
 * Sends to main:
 *   { kind: 'publish_request', jobId, postId, variantId, platform, body }
 *   { kind: 'job:published', jobId, postId, platform, url }
 *   { kind: 'job:failed', jobId, postId, platform, error, permanent }
 *   { kind: 'log', level, context, msg, fields }
 */

import { workerData, parentPort, isMainThread } from 'worker_threads'
import Database from 'better-sqlite3'
import * as cron from 'node-cron'

if (isMainThread) {
  throw new Error('publisher.worker must be run as a Worker Thread, not the main thread')
}

// ─── Setup ───────────────────────────────────────────────────────────────────

interface WorkerData {
  dbPath: string
}

const { dbPath } = workerData as WorkerData

const db = new Database(dbPath, { timeout: 5000 })
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function log(level: 'debug' | 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}): void {
  parentPort?.postMessage({ kind: 'log', level, context: 'PublisherWorker', msg, fields })
}

// ─── Retry config ─────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3
// Backoff delays: attempt 1=immediate, attempt 2=5min, attempt 3=20min
const BACKOFF_MS = [0, 5 * 60_000, 20 * 60_000]

// ─── Pending publish requests (jobId → resolve/reject) ───────────────────────

interface PendingPublish {
  resolve: (result: { url: string; externalId: string }) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

const pending = new Map<string, PendingPublish>()

// Listen for responses from main thread
parentPort?.on('message', (msg: { kind: string; jobId?: string; url?: string; externalId?: string; error?: string }) => {
  if (msg.kind === 'publish_result' && msg.jobId) {
    const p = pending.get(msg.jobId)
    if (p) {
      clearTimeout(p.timeout)
      pending.delete(msg.jobId)
      p.resolve({ url: msg.url ?? '', externalId: msg.externalId ?? '' })
    }
  }

  if (msg.kind === 'publish_error' && msg.jobId) {
    const p = pending.get(msg.jobId)
    if (p) {
      clearTimeout(p.timeout)
      pending.delete(msg.jobId)
      p.reject(new Error(msg.error ?? 'Unknown publish error'))
    }
  }

  if (msg.kind === 'shutdown') {
    log('info', 'Worker shutting down')
    db.close()
    process.exit(0)
  }
})

// ─── DB helpers (sync — better-sqlite3 is synchronous) ───────────────────────

interface JobRow {
  id: string
  post_id: string
  variant_id: string
  platform: string
  scheduled_at: number
  status: string
  attempts: number
  last_error: string | null
  created_at: number
  updated_at: number
}

interface VariantRow {
  id: string
  body: string
  platform: string
  post_id: string
}

interface PostRow {
  id: string
  image_paths: string // JSON array of ImageAttachment
}

function getDueJobs(): JobRow[] {
  return db
    .prepare(`SELECT * FROM jobs WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC LIMIT 20`)
    .all(Date.now()) as JobRow[]
}

function getVariant(variantId: string): VariantRow | undefined {
  return db.prepare('SELECT * FROM draft_variants WHERE id = ?').get(variantId) as VariantRow | undefined
}

function getPostImagePaths(postId: string): string {
  const row = db.prepare('SELECT image_paths FROM posts WHERE id = ?').get(postId) as PostRow | undefined
  return row?.image_paths ?? '[]'
}

function markRunning(jobId: string): void {
  db.prepare(`UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?`).run(Date.now(), jobId)
}

function markDone(jobId: string): void {
  db.prepare(`UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?`).run(Date.now(), jobId)
  // Update parent post to 'published'
  const job = db.prepare('SELECT post_id FROM jobs WHERE id = ?').get(jobId) as { post_id: string } | undefined
  if (job) {
    db.prepare(`UPDATE posts SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`)
      .run(Date.now(), Date.now(), job.post_id)
  }
}

function markFailed(jobId: string, attempts: number, error: string, permanent: boolean): void {
  const now = Date.now()
  if (permanent || attempts >= MAX_ATTEMPTS) {
    db.prepare(`UPDATE jobs SET status = 'failed', attempts = ?, last_error = ?, updated_at = ? WHERE id = ?`)
      .run(attempts, error, now, jobId)
    const job = db.prepare('SELECT post_id FROM jobs WHERE id = ?').get(jobId) as { post_id: string } | undefined
    if (job) {
      db.prepare(`UPDATE posts SET status = 'failed', updated_at = ? WHERE id = ?`).run(now, job.post_id)
    }
  } else {
    // Reschedule with backoff
    const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)]
    const nextAt = now + backoff
    db.prepare(
      `UPDATE jobs SET status = 'pending', attempts = ?, last_error = ?, scheduled_at = ?, updated_at = ? WHERE id = ?`,
    ).run(attempts, error, nextAt, now, jobId)
    log('info', 'Job rescheduled with backoff', { jobId, attempts, backoffMs: backoff, nextAt: new Date(nextAt).toISOString() })
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/** Ask the main thread to publish a job. Returns the publish result. */
function requestPublish(job: JobRow, body: string): Promise<{ url: string; externalId: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(job.id)
      reject(new Error('Publish request timed out after 60s'))
    }, 60_000)

    pending.set(job.id, { resolve, reject, timeout })

    parentPort?.postMessage({
      kind: 'publish_request',
      jobId: job.id,
      postId: job.post_id,
      variantId: job.variant_id,
      platform: job.platform,
      body,
      imagePaths: getPostImagePaths(job.post_id),
    })
  })
}

async function processJob(job: JobRow): Promise<void> {
  const variant = getVariant(job.variant_id)
  if (!variant) {
    markFailed(job.id, job.attempts + 1, 'Variant not found', true)
    return
  }

  markRunning(job.id)
  log('info', 'Publishing job', { jobId: job.id, platform: job.platform })

  try {
    const result = await requestPublish(job, variant.body)
    markDone(job.id)

    parentPort?.postMessage({
      kind: 'job:published',
      jobId: job.id,
      postId: job.post_id,
      platform: job.platform,
      url: result.url,
      externalId: result.externalId,
    })

    log('info', 'Job published', { jobId: job.id, platform: job.platform, url: result.url })
  } catch (e) {
    const error = String(e)
    const attempts = job.attempts + 1
    const permanent = attempts >= MAX_ATTEMPTS

    markFailed(job.id, attempts, error, permanent)

    parentPort?.postMessage({
      kind: 'job:failed',
      jobId: job.id,
      postId: job.post_id,
      platform: job.platform,
      error,
      permanent,
    })

    log('warn', 'Job failed', { jobId: job.id, platform: job.platform, attempts, error, permanent })
  }
}

async function tick(): Promise<void> {
  const dueJobs = getDueJobs()
  if (!dueJobs.length) return

  log('info', 'Dispatching due jobs', { count: dueJobs.length })

  for (const job of dueJobs) {
    // Avoid re-processing if already running (e.g. slow publish in progress)
    if (pending.has(job.id)) continue
    await processJob(job)
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

log('info', 'Publisher worker started', { dbPath })

// Run immediately then every 60 seconds
tick().catch((e) => log('error', 'Initial tick failed', { error: String(e) }))

cron.schedule('* * * * *', () => {
  tick().catch((e) => log('error', 'Tick error', { error: String(e) }))
})
