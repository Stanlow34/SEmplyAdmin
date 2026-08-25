import api, { apiFor } from './clients.js';

/**
 * Identité et droits de la session.
 *
 * L'identité vient du relais (`/api/auth/me`), qui la tient d'un appel VIVANT
 * au portail — donc une révocation prend effet immédiatement.
 *
 * ⚠️ TRANSITOIRE : le rôle et la matrice rôle → menus vivent encore dans la
 * base de SEmplyApp (`admin-menus.ts`). Tant que c'est le cas, SEmplyApp est
 * un point de défaillance unique pour l'administration des quatre produits.
 * Cible : les déplacer dans AuthSEmply, puis remplacer `apiFor('semplyapp')`
 * par `api.get('/auth/access')` ici — rien d'autre ne bougera.
 */

const REFUSED = { isSuperAdmin: false, role: null, menus: [], manageAdmins: false, mfaRequired: false };

let cached = null;

export function loadAccess() {
  cached ??= (async () => {
    try {
      await api.get('/auth/me');
    } catch {
      return REFUSED;
    }

    try {
      const { data } = await apiFor('semplyapp').get('admin/access');
      return {
        isSuperAdmin: Boolean(data?.is_superadmin),
        role: data?.role ?? null,
        menus: Array.isArray(data?.menus) ? data.menus : [],
        manageAdmins: Boolean(data?.manage_admins),
        mfaRequired: false,
      };
    } catch (error) {
      // 403 MFA_REQUIRED n'est pas un refus : le compte est habilité, il lui
      // manque l'appairage TOTP. Le confondre avec « accès refusé » enverrait
      // quelqu'un chercher un droit qu'il a déjà.
      if (error.response?.status === 403 && error.response?.data?.error === 'MFA_REQUIRED') {
        return { ...REFUSED, mfaRequired: true };
      }
      return REFUSED;
    }
  })();
  return cached;
}

export function resetAccess() {
  cached = null;
}
