import { getApiBase, getLoginPath, getScopeHeaders, apiBaseFor } from './config.js'

// Couche HTTP unifiée, partagée par l'application cliente et le back-office.
//
// Deux responsabilités posées une fois au démarrage (installFetchAuthInterceptor) :
//   1. Injecter le cookie de session (credentials) + en-têtes de portée sur TOUS
//      les appels API, sans toucher les ~300 fetch bruts existants.
//   2. Sur 401, tenter UN refresh (/auth/refresh, cookie httpOnly) puis rejouer
//      la requête ; en cas d'échec, déconnecter proprement.
//
// apiFetch() reste le helper recommandé pour les nouveaux appels.
//
// La racine de l'API et les en-têtes de portée ne sont plus lus ici mais
// injectés par l'hôte (cf. config.js) : c'est ce qui permet au back-office de
// n'émettre AUCUN en-tête de société tout en partageant ce code.

// Fusionne des en-têtes (objet, Headers ou tableau) sans écraser l'appelant.
function mergeHeaders(base, incoming) {
  const merged = { ...base }
  if (!incoming) return merged
  if (incoming instanceof Headers) {
    incoming.forEach((value, key) => {
      merged[key] = value
    })
  } else if (Array.isArray(incoming)) {
    for (const [key, value] of incoming) merged[key] = value
  } else {
    Object.assign(merged, incoming)
  }
  return merged
}

/**
 * Session perdue : on repasse par le portail.
 *
 * Rien à nettoyer côté navigateur — c'est tout l'intérêt du relais : la page
 * ne détient ni jeton ni profil persistant. Le témoin `auth_user` de la
 * version partagée n'a pas d'équivalent ici, et n'en a pas besoin : le
 * back-office n'a aucune page publique où un 401 serait l'état normal.
 */
export function handleUnauthorized() {
  if (typeof window === 'undefined') return
  window.location.assign(getLoginPath())
}

function urlOf(input) {
  if (typeof input === 'string') return input
  if (input && typeof input.url === 'string') return input.url // objet Request
  return ''
}

function isApiRequest(url) {
  const apiBase = getApiBase()
  return (
    (apiBase !== '' && url.startsWith(apiBase)) ||
    url.includes('/api/') ||
    url.includes('/api')
  )
}

// Endpoints d'auth pour lesquels un 401 ne doit PAS déclencher de refresh :
// login/register (mauvais identifiants), refresh (échec = session morte),
// logout. Gérés par l'écran appelant ou par handleUnauthorized directement.
function isAuthMutationEndpoint(url) {
  return /\/auth\/(login|register|refresh|logout)/.test(url)
}

let installed = false
let rawFetch = null
let refreshInFlight = null

/**
 * Le rafraîchissement N'EST PLUS l'affaire du navigateur.
 *
 * Le relais détient les jetons et les renouvelle lui-même avant de transmettre
 * une requête. Un 401 qui parvient jusqu'ici signifie donc que le relais a déjà
 * essayé et échoué : insister ne ferait que retarder la reconnexion.
 *
 * La fonction est conservée pour que les écrans repris de SEmplyApp compilent
 * sans retouche.
 */
export function attemptRefresh() {
  return Promise.resolve(false)
}

export function installFetchAuthInterceptor() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  installed = true

  rawFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = urlOf(input)

    let finalInit = init
    if (isApiRequest(url)) {
      finalInit = {
        credentials: 'include',
        ...init,
        headers: mergeHeaders(getScopeHeaders(), init?.headers),
      }
    }

    let res = await rawFetch(input, finalInit)

    // Refresh transparent sur session expirée.
    if (res.status === 401 && isApiRequest(url) && !isAuthMutationEndpoint(url)) {
      // Le relais a déjà tenté le renouvellement : ce 401 est définitif.
      handleUnauthorized()
    }
    return res
  }
}

/** Défait l'interception — tests uniquement. */
export function uninstallFetchAuthInterceptor() {
  if (!installed) return
  if (rawFetch) window.fetch = rawFetch
  installed = false
  rawFetch = null
  refreshInFlight = null
}

// ── Messages d'erreur ───────────────────────────────────────────────────────
//
// Le backend renvoie une enveloppe uniforme :
//   { statusCode, error, message, path, timestamp }
// où `message` est une chaîne (erreur métier) ou un tableau (ValidationPipe).
// Sans traitement, les écrans affichaient ce JSON brut à l'utilisateur.

const STATUS_MESSAGES = {
  400: 'Requête invalide.',
  401: 'Session expirée, reconnectez-vous.',
  403: "Vous n'avez pas les droits nécessaires pour cette action.",
  404: 'Élément introuvable.',
  405: 'Action non autorisée.',
  409: 'Conflit : cet élément existe déjà ou est utilisé ailleurs.',
  413: 'Fichier trop volumineux.',
  415: 'Format de fichier non pris en charge.',
  422: 'Données invalides.',
  429: 'Trop de requêtes, réessayez dans un instant.',
  500: 'Erreur interne du serveur.',
  502: 'Service indisponible, réessayez plus tard.',
  503: 'Service temporairement indisponible.',
  504: 'Le serveur met trop de temps à répondre.',
}

/**
 * Extrait un message lisible d'une réponse HTTP en erreur.
 * Ne renvoie JAMAIS de JSON ni de HTML brut : à défaut de message métier,
 * on retombe sur `fallback` puis sur un libellé selon le code HTTP.
 */
export async function apiErrorMessage(res, fallback) {
  let raw = ''
  try {
    raw = await res.text()
  } catch {
    // corps déjà consommé ou illisible : on passe au repli
  }

  const trimmed = String(raw ?? '').trim()
  if (trimmed) {
    try {
      const body = JSON.parse(trimmed)
      const message = body?.message
      if (Array.isArray(message) && message.length > 0) return message.join(' • ')
      if (typeof message === 'string' && message.trim()) return message.trim()
      if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
    } catch {
      // Pas du JSON : on n'affiche le texte que s'il est court et pas du HTML
      if (!trimmed.startsWith('<') && trimmed.length <= 200) return trimmed
    }
  }

  return fallback || STATUS_MESSAGES[res?.status] || `Erreur ${res?.status ?? ''}`.trim()
}

/** Message lisible pour un throw attrapé (réseau, parsing, erreur métier déjà formatée). */
export function errorMessage(err, fallback = 'Une erreur est survenue.') {
  if (!err) return fallback
  if (typeof err === 'string') return err.trim() || fallback
  const message = String(err.message ?? '').trim()
  if (!message) return fallback
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion réseau.'
  }
  return message
}

// Helper recommandé pour les nouveaux appels. `path` peut être absolu (http…)
// ou relatif à l'API ("/app-theme"). Renvoie la Response brute.
export function apiFetch(path, { headers, product, ...options } = {}) {
  // Une URL absolue serait un appel direct à une API de produit, donc un
  // contournement du relais : le test d'isolation l'interdit, on ne la
  // construit pas ici non plus.
  const base = apiBaseFor(product)
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...getScopeHeaders(), ...headers },
  })
}
