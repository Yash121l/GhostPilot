import { AtSign, Briefcase, Camera } from 'lucide-react'
import { Platform } from '@shared/types/platform'

export const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  [Platform.LINKEDIN]: Briefcase,
  [Platform.TWITTER]: AtSign,
  [Platform.INSTAGRAM]: Camera
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.LINKEDIN]: '#0a66c2',
  [Platform.TWITTER]: 'var(--foreground)',
  [Platform.INSTAGRAM]: '#c13584'
}
