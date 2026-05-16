/**
 * @module workers/pool
 * WorkerPool — manages lifecycle of all Worker Threads.
 * Handles spawn, crash restart (with delay), and graceful shutdown.
 */

import { Worker } from 'worker_threads'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { createLogger } from '../infrastructure/logger/logger'
import { WORKER_RESTART_DELAY_MS } from '../../shared/constants'
import type { WorkerName, WorkerRequest, WorkerResponse } from './worker-protocol'

const logger = createLogger('WorkerPool')

interface WorkerEntry {
  name: WorkerName
  worker: Worker
  restarts: number
}

const workers = new Map<WorkerName, WorkerEntry>()

/**
 * Spawn a named worker thread.
 * The worker file must be at `out/main/workers/{name}.worker.js` after build.
 */
export function spawnWorker(name: WorkerName): void {
  const workerPath = join(__dirname, `${name}.worker.js`)
  logger.info({ msg: `Spawning worker`, workerName: name })

  const worker = new Worker(workerPath)
  const entry: WorkerEntry = { name, worker, restarts: 0 }
  workers.set(name, entry)

  worker.on('message', (msg: WorkerResponse) => {
    if (msg.kind === 'log') {
      // Forward worker log to main process logger
      const wLogger = createLogger(msg.context, `worker:${name}`)
      wLogger[msg.level]({ msg: msg.msg, ...msg.fields })
    }
  })

  worker.on('error', (err) => {
    logger.error({ msg: `Worker error`, workerName: name, error: err.message })
  })

  worker.on('exit', (code) => {
    if (code !== 0) {
      const e = workers.get(name)
      if (!e) return
      e.restarts++
      logger.warn({
        msg: `Worker crashed, restarting`,
        workerName: name,
        restarts: e.restarts,
        exitCode: code
      })
      setTimeout(() => spawnWorker(name), WORKER_RESTART_DELAY_MS)
    }
  })
}

/**
 * Send a typed request to a named worker.
 */
export function sendToWorker(name: WorkerName, type: string, payload: unknown): void {
  const entry = workers.get(name)
  if (!entry) {
    logger.warn({ msg: `Worker not found`, workerName: name })
    return
  }
  const req: WorkerRequest = { id: nanoid(), type, payload }
  entry.worker.postMessage(req)
}

/**
 * Gracefully terminate all workers.
 * Called on app quit.
 */
export async function shutdownAllWorkers(): Promise<void> {
  logger.info({ msg: 'Shutting down all workers' })
  const promises = [...workers.values()].map((e) => e.worker.terminate())
  await Promise.allSettled(promises)
  workers.clear()
}
