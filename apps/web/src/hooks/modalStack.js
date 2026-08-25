// Pile LIFO des modales ouvertes. Permet aux modales imbriquées de se comporter
// correctement : seule la modale du sommet (dernière ouverte) réagit à Échap et
// piège le focus. Les jetons sont opaques (objets d'identité).

const stack = []
const listeners = new Set()

const notify = () => listeners.forEach((fn) => fn())

export const pushModal = (token) => {
  stack.push(token)
  notify()
}

export const popModal = (token) => {
  const i = stack.lastIndexOf(token)
  if (i !== -1) {
    stack.splice(i, 1)
    notify()
  }
}

export const isTopModal = (token) => stack.length > 0 && stack[stack.length - 1] === token

// S'abonne aux changements de pile (retourne une fonction de désabonnement).
export const subscribeModalStack = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
