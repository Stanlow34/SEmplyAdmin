import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from './http.js'
import { getApiBase } from './config.js'

// Preuve d'identité demandée en plus de la session, avant de retirer le second
// facteur ou de passer en mode « sudo ».
//
// Deux formes, imposées par le compte et non choisies par l'écran :
//
//   - mot de passe : le cas courant ;
//   - ré-authentification Google : un compte créé via « Continuer avec Google »
//     n'a AUCUN mot de passe utilisable (la colonne en base ne contient qu'un
//     secret aléatoire inconnu de tous). Lui demander « votre mot de passe »
//     était une impasse : la double authentification, une fois activée, ne
//     pouvait plus être désactivée, et l'administration restait inaccessible.
//
// Trois écrans ont besoin de cette distinction (Sécurité, SudoPrompt, Support
// admin) : d'où ce hook plutôt qu'une troisième copie de la même logique.
//
// Partagé entre l'application cliente et le back-office : c'est du parcours
// d'authentification, le seul endroit où une divergence entre les deux serait
// dangereuse.

/** Le mode et l'état de la preuve, tels que seul le serveur peut les connaître. */
export function useIdentityProofMode() {
  // `null` tant que la réponse n'est pas là : les écrans n'affichent aucun des
  // deux modes avant, pour éviter que le champ mot de passe n'apparaisse une
  // fraction de seconde à un utilisateur Google.
  const [mode, setMode] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/auth/totp/status')
      const status = await res.json()
      const hasUsablePassword = status?.hasUsablePassword !== false

      // Le cookie qui porte la preuve est httpOnly : son état ne peut venir
      // que du serveur. Relu à chaque montage pour qu'une preuve expirée ou
      // déjà consommée ramène bien le bouton « Confirmer avec Google ».
      let reauthConfirmed = false
      if (!hasUsablePassword) {
        const proof = await apiFetch('/auth/reauth/status')
        reauthConfirmed = Boolean((await proof.json())?.confirmed)
      }
      return { hasUsablePassword, reauthConfirmed }
    } catch {
      // À défaut d'information, on retombe sur le mot de passe : c'est le cas
      // de la très grande majorité des comptes.
      return { hasUsablePassword: true, reauthConfirmed: false }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void load().then((next) => {
      if (!cancelled) setMode(next)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  const refresh = useCallback(async () => {
    setMode(await load())
  }, [load])

  return { mode, refresh }
}

/**
 * Quitte l'application pour Google. Navigation complète — et non `fetch` —
 * parce qu'OAuth repose sur des redirections : le serveur pose un cookie de
 * contexte, puis renvoie vers accounts.google.com avec `prompt=login`.
 *
 * `returnTo` est vérifié côté serveur et borné aux chemins internes : sans ça,
 * la route de départ serait une redirection ouverte.
 */
export function startGoogleReauth(returnTo) {
  const target =
    returnTo ?? `${window.location.pathname}${window.location.search}`
  window.location.href =
    `${getApiBase()}/auth/google/reauth?returnTo=${encodeURIComponent(target)}`
}

/**
 * Lit et efface le `?reauth=` posé au retour de Google.
 *
 * Effacé aussitôt lu : laissé dans la barre d'adresse, un rafraîchissement
 * réafficherait « identité confirmée » alors que la preuve a pu expirer ou
 * avoir déjà servi.
 */
export function consumeReauthResult() {
  const params = new URLSearchParams(window.location.search)
  const reauth = params.get('reauth')
  if (!reauth) return null

  params.delete('reauth')
  const query = params.toString()
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}`,
  )
  return reauth // 'ok' | 'failed'
}
