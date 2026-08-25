import { AUTH_PRODUCT } from './products.js';

/**
 * Rôle d'administration de la session : ce qu'on peut atteindre une fois entré.
 *
 * ⚠️ ÉTAPE DE TRANSITION. Aujourd'hui `is_superadmin`, le rôle et la matrice
 * rôle → menus vivent dans la base de SEmplyApp (`admin-menus.ts`,
 * `SuperAdminGuard`). Le back-office interroge donc SEmplyApp pour savoir qui
 * il a en face — ce qui fait de SEmplyApp un point de défaillance unique pour
 * l'administration des QUATRE produits.
 *
 * Cible : déplacer identité, rôles et MFA dans AuthSEmply, puis basculer
 * `ACCESS_SOURCE` sur le portail. Le reste de ce fichier ne bougera pas.
 */
const ACCESS_SOURCE = import.meta.env.VITE_ACCESS_API_URL ?? import.meta.env.VITE_API_SEMPLYAPP_URL;

const REFUSED = { isSuperAdmin: false, role: null, menus: [], manageAdmins: false, mfaRequired: false };

let cached = null;

export function loadAccess() {
  cached ??= fetch(`${ACCESS_SOURCE}/api/admin/access`, { credentials: 'include' })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        return {
          isSuperAdmin: Boolean(data?.is_superadmin),
          role: data?.role ?? null,
          menus: Array.isArray(data?.menus) ? data.menus : [],
          manageAdmins: Boolean(data?.manage_admins),
          mfaRequired: false,
        };
      }
      // 403 MFA_REQUIRED n'est PAS un refus : le compte est habilité, il lui
      // manque l'appairage TOTP. Les confondre afficherait « accès refusé » à
      // quelqu'un qui n'a qu'un écran de sécurité à visiter.
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        if (body?.error === 'MFA_REQUIRED') return { ...REFUSED, mfaRequired: true };
      }
      return REFUSED;
    })
    .catch(() => REFUSED);
  return cached;
}

export function resetAccess() {
  cached = null;
}

export { AUTH_PRODUCT };
