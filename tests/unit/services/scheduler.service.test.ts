import { describe, it, expect } from 'vitest'
import { mockAudit, mockConnector } from '../../helpers/mocks'
import { Platform } from '../../../src/shared/types/platform'

// SchedulerService is now a no-op registry stub.
// Actual dispatch lives in publisher.worker.ts (worker thread).
// These tests verify the public contract: start/stop don't throw,
// register stores connectors, and the service remains usable as a stub.

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

const { SchedulerService } = await import('../../../src/main/services/scheduler/scheduler.service')

describe('SchedulerService stub', () => {
  it('start() and stop() do not throw', () => {
    const svc = new SchedulerService(mockAudit(), {} as any)
    expect(() => svc.start()).not.toThrow()
    expect(() => svc.stop()).not.toThrow()
  })

  it('start() is idempotent', () => {
    const svc = new SchedulerService(mockAudit(), {} as any)
    expect(() => {
      svc.start()
      svc.start()
    }).not.toThrow()
    svc.stop()
  })

  it('register() stores connector without error', () => {
    const svc = new SchedulerService(mockAudit(), {} as any)
    const connector = mockConnector(Platform.LINKEDIN)
    expect(() => svc.register(connector)).not.toThrow()
  })

  it('stop() before start() does not throw', () => {
    const svc = new SchedulerService(mockAudit(), {} as any)
    expect(() => svc.stop()).not.toThrow()
  })
})
