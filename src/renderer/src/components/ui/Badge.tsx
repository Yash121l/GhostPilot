import type { HTMLAttributes, ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({
  variant = 'default',
  className = '',
  children,
  ...props
}: BadgeProps): ReactNode {
  return (
    <span className={`ui-badge ui-badge-${variant} ${className}`} {...props}>
      {children}
    </span>
  )
}
