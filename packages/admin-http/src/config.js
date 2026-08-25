/**
 * Configuration de la couche HTTP, injectée par l'application hôte.
 *
 * Ce paquet est partagé par l'application cliente et le back-office super
 * admin. Il ne doit donc RIEN savoir de son hôte, pour deux raisons :
 *
 *  1. `import.meta.env.VITE_API_URL` ne peut pas être lu ici. Une dépendance
 *     d'espace de travail qui lit `import.meta.env` est un piège Vite classique :
 *     selon qu'elle est pré-bundlée ou non, la substitution a lieu ou pas, et
 *     l'échec est silencieux et propre à la production. Le build du back-office
 *     force par ailleurs cette variable à la chaîne vide (cf. admin/vite.config.js) :
 *     le paquet hériterait de la mauvaise valeur.
 *
 *  2. Les en-têtes de portée diffèrent d'une application à l'autre. Le client
 *     envoie `x-company-id` / `x-space-id` ; le back-office ne doit RIEN envoyer,
 *     puisqu'un compte d'administration n'a pas de société active. Ces en-têtes
 *     étaient jusqu'ici lus depuis des cookies posés sur `.semply.fr`, donc
 *     visibles depuis le domaine d'administration : le back-office transmettait
 *     la portée de l'application cliente à travers les sous-domaines.
 *
 * À appeler UNE FOIS au démarrage, avant `installFetchAuthInterceptor()` :
 *
 *   // application cliente
 *   configureHttp({ apiBase: API_BASE, scopeHeaders: getCompanyHeaders })
 *
 *   // back-office : aucun en-tête de portée
 *   configureHttp({ apiBase: API_BASE })
 */

const defaults = {
  // Base par défaut : le relais, pour le produit historique. Chaque module
  // produit peut viser le sien via `apiFetch(path, { product })`.
  /** Racine de l'API, sans barre oblique finale. Ex. `https://api.semply.fr/api` ou `/api`. */
  apiBase: '/api/p/semplyapp',
  /** Racine du relais, pour les appels qui ne visent aucun produit. */
  bffBase: '/api',
  /** Chemin de l'écran de connexion, vers lequel rediriger une session expirée. */
  loginPath: '/api/auth/login',
};

let current = { ...defaults };

export function configureHttp(options = {}) {
  current = { ...current, ...options };
}

/** Réinitialise la configuration — tests uniquement. */
export function resetHttpConfig() {
  current = { ...defaults };
}

export function getApiBase() {
  return current.apiBase;
}

export function getLoginPath() {
  return current.loginPath;
}

export function getBffBase() {
  return current.bffBase;
}

/** Base d'un produit donné, pour les écrans qui ne visent pas le produit par défaut. */
export function apiBaseFor(product) {
  return product ? `${current.bffBase}/p/${product}` : current.apiBase;
}

/**
 * En-têtes de portée : TOUJOURS vides, et ce n'est plus configurable.
 *
 * Un compte d'administration n'a pas de société active. Dans la version
 * partagée avec l'application cliente, cette fonction était injectable — et
 * c'est précisément par là que le back-office avait fini par transmettre la
 * portée du client à travers les sous-domaines. Ici, le point d'injection
 * n'existe pas : il n'y a rien à mal configurer.
 */
export function getScopeHeaders() {
  return {};
}
