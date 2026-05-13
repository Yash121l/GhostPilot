import { nanoid } from 'nanoid'
import type { AIGateway } from '../ai-gateway/index'
import type { PersonaService } from '../persona/persona.service'
import type { PostService } from './post.service'
import { AITask, ModelHint } from '../../../shared/types/ai'
import type { Platform } from '../../../shared/types/platform'
import { PLATFORM_CHAR_LIMITS } from '../../../shared/types/platform'
import type { Post, DraftVariant } from '../../../shared/types/post'
import { createLogger } from '../../infrastructure/logger/logger'

const logger = createLogger('VariantGenerator')

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  linkedin:
    'Write a LinkedIn post. Use 1–3 short paragraphs. Start with a strong hook. Professional yet personal tone. End with a subtle call-to-action or question. Max 3000 chars.',
  twitter:
    'Write a single tweet. Direct and punchy. Max 280 chars. No hashtag spam — at most 2. No emojis unless they add meaning.',
  instagram:
    'Write an Instagram caption. Lead with a strong first line (visible before "more"). Include relevant hashtags at the end (10–15). Conversational tone. Max 2200 chars.',
}

export class VariantGenerator {
  constructor(
    private readonly ai: AIGateway,
    private readonly personaService: PersonaService,
    private readonly postService: PostService,
  ) {}

  async generate(postId: string, platforms: Platform[], traceId: string): Promise<Post> {
    const post = await this.postService.get(postId)
    const persona = await this.personaService.get(post.personaId)

    const personaContext = [
      `Name: ${persona.name}`,
      `Bio: ${persona.bio}`,
      `Content pillars: ${persona.pillars.join(', ')}`,
      persona.styleHints ? `Style hints: ${persona.styleHints}` : '',
      persona.latestFingerprint
        ? `Voice: ${persona.latestFingerprint.tone}; avg sentence length: ${persona.latestFingerprint.avgSentenceLength} words`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const variants: DraftVariant[] = []
    const now = new Date()

    for (const platform of platforms) {
      const instructions = PLATFORM_INSTRUCTIONS[platform] ?? `Write a post for ${platform}.`
      const charLimit = PLATFORM_CHAR_LIMITS[platform] ?? 2000

      const prompt = `You are ghostwriting for a creator. Write their ${platform} post based on the draft below.

PERSONA:
${personaContext}

PLATFORM INSTRUCTIONS:
${instructions}

SOURCE DRAFT:
${post.body}

OUTPUT: Return ONLY the finished post text. No explanation. No meta-commentary.`

      const systemMessage = `You are a professional social media ghostwriter who perfectly mimics the persona's authentic voice. You never break character.`

      try {
        const res = await this.ai.complete({
          task: AITask.ADAPT_VARIANT,
          hint: ModelHint.ECONOMY,
          prompt,
          systemMessage,
          maxTokens: Math.ceil(charLimit * 1.2),
          traceId,
          postId,
          personaId: persona.id,
        })

        const body = res.text.trim().slice(0, charLimit)

        variants.push({
          id: nanoid(),
          postId,
          platform,
          body,
          charCount: body.length,
          styleDriftScore: 0, // TODO: compute cosine similarity against fingerprint
          createdAt: now,
          provider: res.provider,
          modelId: res.modelId,
        })

        logger.info({ msg: 'Variant generated', platform, postId, chars: body.length })
      } catch (e) {
        logger.error({ msg: 'Variant generation failed', platform, postId, error: String(e) })
        // Continue generating for other platforms; skip failed one
      }
    }

    return this.postService.setVariants(postId, variants)
  }
}
