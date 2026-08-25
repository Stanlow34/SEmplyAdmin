/**
 * @semplyadmin/http — couche HTTP du back-office de la suite.
 *
 * Reprise de `@semply/http` (SEmplyApp) en gardant la MÊME surface, pour que
 * les écrans repris compilent sans retouche. Trois différences, toutes dues
 * au relais : la base vise `/api/p/<produit>`, le rafraîchissement appartient
 * au serveur, et les en-têtes de portée ne sont plus injectables.
 *
 * Pourquoi un paquet plutôt qu'une recopie : ces deux fichiers sont le cœur du
 * parcours d'authentification — rafraîchissement de session, déconnexion,
 * preuve d'identité avant une action sensible. C'est le seul endroit du front
 * où une divergence entre les deux applications serait dangereuse : un correctif
 * appliqué d'un côté et oublié de l'autre laisserait une des deux sessions se
 * comporter autrement que prévu.
 *
 * Tout le reste (composants, contextes, utilitaires de portée) est recopié de
 * chaque côté et peut diverger sans conséquence — c'est même souhaitable, le
 * back-office n'ayant ni société active ni espace.
 *
 * Le paquet ne lit aucune variable d'environnement et ne connaît aucune notion
 * de société : son hôte le configure au démarrage (cf. `configureHttp`).
 */

export {
  configureHttp,
  resetHttpConfig,
  getApiBase,
  getLoginPath,
  getScopeHeaders,
  getBffBase,
  apiBaseFor,
} from './config.js'

export {
  installFetchAuthInterceptor,
  uninstallFetchAuthInterceptor,
  handleUnauthorized,
  attemptRefresh,
  apiFetch,
  apiErrorMessage,
  errorMessage,
} from './http.js'

export {
  useIdentityProofMode,
  startGoogleReauth,
  consumeReauthResult,
} from './identityProof.js'
