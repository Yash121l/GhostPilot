import type { SocialConnector } from '../social/interface'
import { createLogger } from '../../infrastructure/logger/logger'

const logger = createLogger('SchedulerService')

/**
 * SchedulerService is a thin registry stub.
 * Actual job dispatch and retry logic lives entirely in the PublisherWorker thread
 * (src/main/workers/publisher.worker.ts). Having two independent dispatch loops
 * querying the same DB caused duplicate publishes (tweet sent twice → 403 duplicate).
 */
export class SchedulerService {
  private connectors = new Map<string, SocialConnector>()

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_audit: unknown, _oauthManager: unknown) {}

  register(connector: SocialConnector): void {
    this.connectors.set(connector.platform, connector)
  }

  start(): void {
    logger.info({ msg: 'Scheduler started (dispatch handled by PublisherWorker)' })
  }

  stop(): void {
    // no-op — worker manages its own lifecycle
  }
}
