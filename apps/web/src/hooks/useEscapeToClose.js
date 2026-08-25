import { useEffect } from 'react'

// Ferme un élément (modale, popover…) quand l'utilisateur presse Échap.
export function useEscapeToClose(onClose, active = true) {
  useEffect(() => {
    if (!active || typeof onClose !== 'function') return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose(event)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, active])
}
