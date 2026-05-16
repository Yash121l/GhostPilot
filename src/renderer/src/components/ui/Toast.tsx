/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Copy, Info, TriangleAlert, X } from 'lucide-react'
import { Button } from './Button'
import { IconButton } from './IconButton'

export interface ToastMessage {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  copyText?: string
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'> & { id?: string }) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle
}

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'> & { id?: string }) => {
    const id = toast.id ?? crypto.randomUUID()
    setToasts((current) =>
      [...current.filter((item) => item.id !== id), { ...toast, id }].slice(-4)
    )
    return id
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type]
          return (
            <article key={toast.id} className={`toast toast-${toast.type}`}>
              <Icon size={16} className="toast-icon" />
              <div className="toast-body">
                <div className="toast-title">{toast.title}</div>
                {toast.description ? (
                  <div className="toast-description">{toast.description}</div>
                ) : null}
                <div className="toast-actions">
                  {toast.actionLabel && toast.onAction ? (
                    <Button size="xs" variant="outline" onClick={toast.onAction}>
                      {toast.actionLabel}
                    </Button>
                  ) : null}
                  {toast.copyText ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      leftIcon={<Copy size={12} />}
                      onClick={() => void navigator.clipboard.writeText(toast.copyText ?? '')}
                    >
                      Copy
                    </Button>
                  ) : null}
                </div>
              </div>
              <IconButton
                label="Dismiss notification"
                icon={<X size={14} />}
                onClick={() => dismissToast(toast.id)}
              />
            </article>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
