/**
 * Registre des produits de la suite.
 *
 * La source de vérité N'EST PAS ce fichier : c'est le catalogue des clients
 * OIDC d'AuthSEmply, déjà exposé sur `/admin/products` et déjà éditable depuis
 * le back-office. Un produit lancé, renommé ou retiré s'y reflète sans
 * redéploiement du back-office.
 *
 * Le repli par variables d'environnement ne sert qu'au démarrage à froid : si
 * le portail est injoignable, mieux vaut un back-office dégradé qu'un écran
 * blanc — c'est justement dans ce cas qu'on a besoin d'y accéder.
 */

const AUTH_API = (import.meta.env.VITE_AUTH_API_URL ?? 'https://api-auth.semply.fr').replace(/\/$/, '');

const FALLBACK = [
  { key: 'semplyapp', name: 'SEmplyApp', apiBaseUrl: import.meta.env.VITE_API_SEMPLYAPP_URL },
  { key: 'semplycompta', name: 'SEmplyCompta', apiBaseUrl: import.meta.env.VITE_API_SEMPLYCOMPTA_URL },
  { key: 'semplyprevi', name: 'SEmplyPrevi', apiBaseUrl: import.meta.env.VITE_API_SEMPLYPREVI_URL },
].filter((p) => Boolean(p.apiBaseUrl));

/** Le portail lui-même, toujours présent : il ne peut pas s'auto-déclarer. */
export const AUTH_PRODUCT = { key: 'authsemply', name: 'AuthSEmply', apiBaseUrl: AUTH_API };

export async function loadProducts() {
  try {
    const res = await fetch(`${AUTH_API}/admin/products`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const products = raw
      .filter((p) => p.apiBaseUrl)
      .map((p) => ({
        key: p.clientId,
        name: p.name,
        apiBaseUrl: String(p.apiBaseUrl).replace(/\/$/, ''),
        launched: Boolean(p.launched),
      }));
    return [AUTH_PRODUCT, ...products];
  } catch {
    // Dégradé, pas cassé : on continue avec ce que l'environnement déclare.
    return [AUTH_PRODUCT, ...FALLBACK];
  }
}
