// Simple stroke icons matching GhostPilot's existing aesthetic.
// All 1.6 stroke, 16x16 unless overridden via size prop.

const Icon = ({ children, size = 16, stroke = 1.6, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
)

const IconGhost = (p) => (
  <Icon {...p}>
    <path d="M12 3a7 7 0 0 1 7 7v10l-3-2-2 2-2-2-2 2-2-2-3 2V10a7 7 0 0 1 7-7Z" />
    <circle cx="9.5" cy="11" r="0.8" fill="currentColor" />
    <circle cx="14.5" cy="11" r="0.8" fill="currentColor" />
  </Icon>
)
const IconCompose = (p) => (
  <Icon {...p}>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
)
const IconCalendar = (p) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </Icon>
)
const IconLink = (p) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Icon>
)
const IconTarget = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
  </Icon>
)
const IconTrend = (p) => (
  <Icon {...p}>
    <path d="M3 17 9 11l4 4 8-8" />
    <path d="M14 7h7v7" />
  </Icon>
)
const IconPersona = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
)
const IconChart = (p) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
)
const IconSettings = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Icon>
)
const IconLinkedIn = (p) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 12v5" />
  </Icon>
)
const IconX = (p) => (
  <Icon {...p}>
    <path d="M5 4l14 16M19 4 5 20" />
  </Icon>
)
const IconAt = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
  </Icon>
)
const IconInstagram = (p) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
  </Icon>
)
const IconSparkle = (p) => (
  <Icon {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
    <path d="M19 16l.6 1.6L21 18l-1.4.4L19 20l-.6-1.6L17 18l1.4-.4L19 16Z" />
  </Icon>
)
const IconArrowDown = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)
const IconHook = (p) => (
  <Icon {...p}>
    <path d="M12 4v8a4 4 0 1 1-8 0" />
    <circle cx="12" cy="3.5" r="0.6" fill="currentColor" />
  </Icon>
)
const IconCTA = (p) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)
const IconRefresh = (p) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </Icon>
)
const IconConfigure = (p) => (
  <Icon {...p}>
    <path d="M4 7h10M4 17h10M18 4v6M18 14v6" />
    <circle cx="18" cy="11" r="2" />
    <circle cx="18" cy="3" r="2" transform="translate(0 14)" />
  </Icon>
)
const IconExternal = (p) => (
  <Icon {...p}>
    <path d="M10 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M15 3h6v6M10 14 21 3" />
  </Icon>
)
const IconPlus = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
const IconX_Close = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)
const IconCheck = (p) => (
  <Icon {...p}>
    <path d="M5 12l5 5L20 7" />
  </Icon>
)
const IconChevron = (p) => (
  <Icon {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
)
const IconSave = (p) => (
  <Icon {...p}>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M7 3v6h9V3M7 21v-7h10v7" />
  </Icon>
)
const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
const IconSend = (p) => (
  <Icon {...p}>
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </Icon>
)
const IconTrash = (p) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Icon>
)
const IconEdit = (p) => (
  <Icon {...p}>
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
)
const IconRewrite = (p) => (
  <Icon {...p}>
    <path d="M4 4v6h6M20 20v-6h-6" />
    <path d="M20 10a8 8 0 0 0-14-3M4 14a8 8 0 0 0 14 3" />
  </Icon>
)
const IconShield = (p) => (
  <Icon {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6Z" />
  </Icon>
)
const IconDatabase = (p) => (
  <Icon {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Icon>
)
const IconKey = (p) => (
  <Icon {...p}>
    <circle cx="7.5" cy="14.5" r="3.5" />
    <path d="M10 12l10-10M16 6l3 3M14 8l3 3" />
  </Icon>
)
const IconWifiOff = (p) => (
  <Icon {...p}>
    <path d="M2 8.8A15 15 0 0 1 22 8.8M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h0M3 3l18 18" />
  </Icon>
)
const IconBolt = (p) => (
  <Icon {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </Icon>
)
const IconHelp = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.5-1 1-1 1.7M12 17h0" />
  </Icon>
)

Object.assign(window, {
  IconGhost,
  IconCompose,
  IconCalendar,
  IconLink,
  IconTarget,
  IconTrend,
  IconPersona,
  IconChart,
  IconSettings,
  IconLinkedIn,
  IconX,
  IconAt,
  IconInstagram,
  IconSparkle,
  IconArrowDown,
  IconHook,
  IconCTA,
  IconRefresh,
  IconConfigure,
  IconExternal,
  IconPlus,
  IconX_Close,
  IconCheck,
  IconChevron,
  IconSave,
  IconClock,
  IconSend,
  IconTrash,
  IconEdit,
  IconRewrite,
  IconShield,
  IconDatabase,
  IconKey,
  IconWifiOff,
  IconBolt,
  IconHelp
})
