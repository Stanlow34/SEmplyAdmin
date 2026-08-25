import { useEffect, useState } from 'react'
import { apiFetch } from '@semplyadmin/http'

/**
 * Rôle d'administration de la session courante.
 *
 * Depuis le 22 août 2026, les droits s'expriment en ACCÈS AUX MENUS : le
 * serveur renvoie le rôle (owner / back-office / support / personnalisé) et la
 * liste des menus qu'il ouvre. La coquille s'en sert pour n'afficher que ces
 * menus, et chaque route est gardée par `hasMenu`.
 *
 * `can()` est conservé pour compatibilité : les écrans l'appellent encore pour
 * masquer leurs boutons, et dans le modèle par menus, avoir le menu = tout y
 * faire. Il renvoie donc vrai dès que la session est superadmin — le serveur
 * reste seul juge (SudoGuard sur les mutations, rôle relu à chaque requête).
 *
 * Une seule requête par session : ni le statut ni le rôle ne changent en cours
 * de navigation, et plusieurs écrans les demandent.
 */

const REFUSED = {
  is_superadmin: false,
  role: null,
  menus: [],
  manage_admins: false,
  mfa_required: false,
}

let cached = null

function fetchAdminAccess() {
  cached ??= apiFetch('/admin/access')
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        return {
          is_superadmin: Boolean(data?.is_superadmin),
          role: data?.role ?? null,
          // Liste calculée par le serveur : la matrice rôle → menus n'est
          // écrite qu'une fois, côté backend (admin-menus.ts).
          menus: Array.isArray(data?.menus) ? data.menus : [],
          manage_admins: Boolean(data?.manage_admins),
          mfa_required: false,
        }
      }

      // 403 MFA_REQUIRED est un cas À PART, et non un refus.
      //
      // SuperAdminGuard ne renvoie ce code qu'APRÈS avoir vérifié
      // `is_superadmin` : le recevoir signifie donc « vous êtes bien habilité,
      // mais la double authentification n'est pas activée ». Confondre les deux
      // afficherait « accès refusé » à quelqu'un qui n'a qu'un appairage TOTP à
      // faire — et l'écran qui le permet (/admin/securite) est justement
      // accessible, les routes /auth/totp/* n'étant pas sous /admin/.
      if (res.status === 403) {
        const body = await res.json().catch(() => null)
        if (body?.error === 'MFA_REQUIRED') {
          return { ...REFUSED, mfa_required: true }
        }
      }
      return REFUSED
    })
    .catch(() => REFUSED)

  return cached
}

/**
 * Accès d'administration : le statut, le rôle et ses menus.
 *
 *   const { hasMenu, roleName } = useAdminAccess()
 *   {hasMenu('ARTICLES') && <NavLink to="/admin/articles">…</NavLink>}
 *
 * `hasMenu()` sert UNIQUEMENT à ne pas proposer une section qui serait
 * refusée : le serveur vérifie le rôle à chaque requête, et un menu absent ici
 * n'est jamais la seule chose qui protège quoi que ce soit.
 *
 * `loading` vaut vrai tant que la réponse n'est pas là ; pendant ce temps tout
 * est refusé — on masque plutôt qu'on n'affiche à tort une entrée qui finirait
 * en 403.
 */
export function useAdminAccess() {
  const [access, setAccess] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminAccess().then((value) => {
      if (!cancelled) setAccess(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    loading: access === null,
    isSuperAdmin: Boolean(access?.is_superadmin),
    /** Habilité, mais double authentification à activer avant d'aller plus loin. */
    mfaRequired: Boolean(access?.mfa_required),
    role: access?.role ?? null,
    /** Un superadmin sans rôle assigné n'atteint rien — l'écran doit le dire. */
    roleName: access?.role?.name ?? null,
    menus: access?.menus ?? [],
    hasMenu: (key) => Boolean(access?.menus?.includes(key)),
    manageAdmins: Boolean(access?.manage_admins),
    /** Compatibilité : avoir le menu = tout y faire (cf. note d'en-tête). */
    can: () => Boolean(access?.is_superadmin),
    /** Compatibilité avec l'ancien en-tête, qui affichait le profil. */
    profileLabel: access?.role?.name ?? null,
  }
}

/** À appeler à la déconnexion : le prochain utilisateur ne doit pas hériter du rôle. */
export function resetAdminAccessCache() {
  cached = null
}
