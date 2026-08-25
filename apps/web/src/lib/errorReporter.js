import { API_BASE } from './apiBase.js'

/**
 * Remontée des erreurs du navigateur vers l'API.
 *
 * Sans elle, une exception de rendu React affichait un écran de repli et
 * s'arrêtait là : un `console.error` sur le poste de l'utilisateur, et rien côté
 * SEmply. On n'apprenait les pannes que par les clients qui appellent —
 * c'est-à-dire une fraction d'entre elles, et toujours en retard.
 *
 * TROIS RÈGLES, et elles découlent toutes de la même idée : un rapporteur
 * d'erreurs ne doit JAMAIS aggraver la situation qu'il rapporte.
 *
 *  1. **Il échoue en silence.** Un envoi raté est perdu, sans relance ni
 *     message. Mieux vaut perdre un rapport que boucler sur l'erreur qu'on
 *     essaie de signaler — une boucle de rapport est ce qui transforme une page
 *     cassée en navigateur figé.
 *  2. **Il regroupe.** Une erreur dans un rendu se répète à chaque tentative :
 *     sans regroupement, une seule panne remplirait le journal en quelques
 *     secondes et masquerait tout le reste.
 *  3. **Il diffère.** Les envois sont groupés et espacés, pour ne pas ajouter
 *     du trafic au moment précis où quelque chose va déjà mal.
 */

/** Au-delà, on cesse d'envoyer : la page est manifestement en boucle. */
const MAX_SIGNATURES = 12
/** Délai de regroupement avant envoi. */
const FLUSH_DELAY_MS = 3000

/** Signature → occurrences, pour la session en cours. */
const seen = new Map()
let pending = []
let timer = null
let disabled = false

const truncate = (value, max) => (value == null ? undefined : String(value).slice(0, max))

/**
 * Signature d'une erreur : message + première ligne de pile.
 *
 * Volontairement grossière. Deux occurrences du même bug produisent la même
 * signature même si la pile diffère légèrement — c'est ce qu'on veut, puisque le
 * but est de compter, pas de distinguer.
 */
const signatureOf = (kind, message, stack) =>
  `${kind}|${String(message).slice(0, 120)}|${String(stack ?? '').split('\n')[1]?.trim() ?? ''}`

function flush() {
  timer = null
  const batch = pending
  pending = []
  if (batch.length === 0) return

  try {
    const body = JSON.stringify({ errors: batch })

    // `keepalive` : l'envoi survit à la fermeture de l'onglet. C'est le cas le
    // plus fréquent — un utilisateur qui tombe sur un écran cassé ferme la page.
    // Sans lui, on perdrait précisément les erreurs les plus graves.
    fetch(`${API_BASE}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body,
    }).catch(() => {
      // Silence assumé : cf. règle 1.
    })
  } catch {
    // Idem — sérialisation impossible, on abandonne ce lot.
  }
}

function schedule() {
  if (timer !== null) return
  timer = setTimeout(flush, FLUSH_DELAY_MS)
}

/**
 * Signale une erreur. Sans effet si la même se répète au-delà du seuil.
 *
 * @param {'render'|'window'|'promise'} kind
 */
export function reportClientError(kind, error, extra = {}) {
  if (disabled) return

  const message = String(error?.message ?? error ?? 'Erreur inconnue')
  const stack = error?.stack
  const signature = signatureOf(kind, message, stack)

  const count = (seen.get(signature) ?? 0) + 1
  seen.set(signature, count)

  // Déjà signalée : on incrémente sans réémettre. La première occurrence porte
  // la pile, les suivantes ne feraient que la répéter.
  if (count > 1) {
    if (seen.size > MAX_SIGNATURES) disabled = true
    return
  }

  if (seen.size > MAX_SIGNATURES) {
    // Douze erreurs DISTINCTES sur une même session : ce n'est plus un incident,
    // c'est un effondrement. Continuer à rapporter n'apprendrait rien de plus et
    // chargerait un serveur peut-être déjà en cause.
    disabled = true
    return
  }

  pending.push({
    kind,
    message: truncate(message, 300),
    stack: truncate(stack, 4000),
    componentStack: truncate(extra.componentStack, 4000),
    url: truncate(window.location?.href, 500),
    userAgent: truncate(navigator?.userAgent, 300),
    count,
  })
  schedule()
}

/**
 * Capture les erreurs qui échappent à React : exceptions hors rendu et
 * promesses rejetées sans `catch`.
 *
 * `ErrorBoundary` ne voit que les erreurs de RENDU. Un `await` qui échoue dans
 * un gestionnaire d'événement passe à côté — et c'est là que vit la majorité du
 * code d'une application de gestion.
 */
export function installErrorReporter() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    reportClientError('window', event?.error ?? event?.message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError('promise', event?.reason)
  })

  // Un onglet qu'on ferme emporte le lot en attente : `flush` sur `pagehide`
  // plutôt que `beforeunload`, seul événement fiable sur mobile.
  window.addEventListener('pagehide', () => {
    if (timer !== null) clearTimeout(timer)
    flush()
  })
}
