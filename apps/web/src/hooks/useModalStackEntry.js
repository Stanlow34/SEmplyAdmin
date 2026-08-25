import { useEffect, useRef, useState } from 'react'
import { pushModal, popModal, isTopModal, subscribeModalStack } from './modalStack.js'

// Inscrit la modale dans la pile globale au montage, l'en retire au démontage,
// et retourne `isTop` (vrai si c'est la modale du sommet). Permet aux modales
// imbriquées de partager correctement Échap et le piège à focus.
export function useModalStackEntry() {
  const tokenRef = useRef({})
  const [isTop, setIsTop] = useState(false)

  useEffect(() => {
    const token = tokenRef.current
    const update = () => setIsTop(isTopModal(token))
    // S'abonner AVANT de pousser : la notification déclenchée par pushModal
    // met alors `isTop` à jour immédiatement.
    const unsubscribe = subscribeModalStack(update)
    pushModal(token)
    return () => {
      unsubscribe()
      popModal(token)
    }
  }, [])

  return isTop
}
