import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusableIn = (node) =>
  Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null)

// Piège le focus clavier dans l'élément référencé. Retourne le ref à poser sur
// le conteneur.
//   - Focus initial + restauration : liés au montage/démontage (donc préservés
//     même quand une sous-modale s'ouvre/ferme au-dessus).
//   - Piégeage de Tab : actif uniquement quand `active` (la modale est au sommet
//     de la pile), pour ne pas interférer avec une modale imbriquée.
export function useFocusTrap(active = true) {
  const ref = useRef(null)

  // Focus initial au montage, restauration du focus précédent au démontage.
  useEffect(() => {
    const node = ref.current
    const previouslyFocused = document.activeElement
    if (node) {
      const items = focusableIn(node)
      if (items.length) items[0].focus()
      else node.focus?.()
    }
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus?.()
    }
  }, [])

  // Boucle Tab, seulement quand la modale est active (au sommet).
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return
      const list = focusableIn(node)
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => node.removeEventListener('keydown', onKeyDown)
  }, [active])

  return ref
}
