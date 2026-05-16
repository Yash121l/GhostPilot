/**
 * @module worker-protocol
 * Typed message protocol for all Worker Threads.
 * Both the pool and individual workers must use these types.
 */

/** All known worker thread names. */
export type WorkerName = 'publisher' | 'context-ingestion' | 'trend-watcher' | 'fingerprint'

/** A message sent from WorkerPool → Worker Thread. */
export interface WorkerRequest {
  id: string // nanoid — for correlating responses
  type: string
  payload: unknown
}

/** A message sent from Worker Thread → WorkerPool. */
export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse | WorkerLogMessage

export interface WorkerSuccessResponse {
  kind: 'result'
  id: string
  payload: unknown
}

export interface WorkerErrorResponse {
  kind: 'error'
  id: string
  code: string
  message: string
  retryable: boolean
}

/** Workers forward log entries to main via postMessage for file writing. */
export interface WorkerLogMessage {
  kind: 'log'
  level: 'debug' | 'info' | 'warn' | 'error'
  context: string
  msg: string
  fields: Record<string, unknown>
}
