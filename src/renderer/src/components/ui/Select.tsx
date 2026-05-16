import type { ReactNode, SelectHTMLAttributes } from 'react'

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): ReactNode {
  return (
    <select className={`ui-input ui-select ${className}`} {...props}>
      {children}
    </select>
  )
}
