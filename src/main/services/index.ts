/**
 * Service container — creates and wires all application services.
 * Call initServices() once at startup. All services are singletons.
 */

import { AuditService } from '../application/audit/audit.service'
import { AIGateway } from './ai-gateway/index'
import { PersonaService } from './persona/persona.service'
import { PostService } from './post/post.service'
import { VariantGenerator } from './post/variant-generator'
import { IntentService } from './intent/intent.service'
import { TrendWatcher } from './trends/trend-watcher'
import { SchedulerService } from './scheduler/scheduler.service'
import { OAuthManager } from './social/oauth-manager'
import { LinkedInConnector } from './social/linkedin'
import { XTwitterConnector } from './social/x-twitter'
import { InstagramConnector } from './social/instagram'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('Services')

export interface Services {
  audit: AuditService
  aiGateway: AIGateway
  personaService: PersonaService
  postService: PostService
  variantGenerator: VariantGenerator
  intentService: IntentService
  trendWatcher: TrendWatcher
  schedulerService: SchedulerService
  oauthManager: OAuthManager
}

let _services: Services | null = null

export async function initServices(): Promise<Services> {
  if (_services) return _services

  const audit = new AuditService()
  const aiGateway = new AIGateway(audit)
  const personaService = new PersonaService(audit)
  const postService = new PostService(audit)
  const variantGenerator = new VariantGenerator(aiGateway, personaService, postService)
  const intentService = new IntentService(audit, aiGateway)
  const trendWatcher = new TrendWatcher()
  const oauthManager = new OAuthManager(audit)
  const schedulerService = new SchedulerService(audit, oauthManager)

  // Register social connectors in both oauth manager and scheduler
  const connectors = [new LinkedInConnector(), new XTwitterConnector(), new InstagramConnector()]
  for (const c of connectors) {
    oauthManager.register(c)
    schedulerService.register(c)
  }

  // Load AI provider keys from DB + probe Ollama
  await aiGateway.reload()

  _services = {
    audit,
    aiGateway,
    personaService,
    postService,
    variantGenerator,
    intentService,
    trendWatcher,
    schedulerService,
    oauthManager,
  }

  logger.info({ msg: 'All services initialised' })
  return _services
}

export function getServices(): Services {
  if (!_services) throw new Error('Services not initialised — call initServices() first')
  return _services
}
