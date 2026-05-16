import { useEffect, type ReactElement } from 'react'
import type { UpdateState } from '@shared/ipc-types'
import { useToast } from '../ui/Toast'

interface UpdateToastProps {
  updateState: UpdateState
  rosettaWarning: boolean
  onDismissRosetta: () => void
}

export function UpdateToast({
  updateState,
  rosettaWarning,
  onDismissRosetta
}: UpdateToastProps): ReactElement | null {
  const { showToast, dismissToast } = useToast()

  useEffect(() => {
    if (updateState.status !== 'available') {
      dismissToast('update-available')
      return
    }
    showToast({
      id: 'update-available',
      type: 'info',
      title: `Update v${updateState.version} available`,
      description: 'Open releases to download the newest build.',
      actionLabel: 'Download',
      onAction: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).api.invoke('updater:open-releases', {})
      }
    })
  }, [dismissToast, showToast, updateState])

  useEffect(() => {
    if (!rosettaWarning) {
      dismissToast('rosetta-warning')
      return
    }
    showToast({
      id: 'rosetta-warning',
      type: 'warning',
      title: 'Running Intel build on Apple Silicon',
      description: 'The next update will switch this install to native arm64.',
      actionLabel: 'Dismiss',
      onAction: onDismissRosetta
    })
  }, [dismissToast, onDismissRosetta, rosettaWarning, showToast])

  return null
}
