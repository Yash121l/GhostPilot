import type { InputHTMLAttributes, ReactNode } from 'react'

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return <input className={`ui-input ${className}`} {...props} />
}
