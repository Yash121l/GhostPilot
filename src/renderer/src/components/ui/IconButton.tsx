import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button } from './Button'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  icon: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  tooltip?: string
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  tooltip,
  ...props
}: IconButtonProps): ReactNode {
  return (
    <Button aria-label={label} title={tooltip ?? label} variant={variant} size="icon" {...props}>
      {icon}
    </Button>
  )
}
