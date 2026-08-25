import axios from 'axios';

/**
 * Fabrique de clients HTTP d'administration — un par produit.
 *
 * Chaque produit expose sa propre API sur son sous-domaine ; la session est
 * commune, portée par le cookie httpOnly posé sur `.semply.fr`. D'où
 * `withCredentials` partout et AUCUN en-tête `Authorization` : le token n'est
 * pas accessible au JavaScript, et c'est voulu.
 *
 * AUCUN en-tête de portée n'est injecté — ni `x-company-id`, ni `x-space-id`.
 * Un compte d'administration n'a pas de société active. Les cookies
 * `semply_active_company` / `semply_active_space` sont posés sur `.semply.fr`
 * et donc lisibles ici : les relayer ferait entrer la portée d'un client dans
 * les requêtes d'administration. Le test d'isolation le vérifie.
 */

const isAuthMutation = (url) => !!url && /\/auth\/(login|register|refresh|logout)/.test(url);

/**
 * @param {object} options
 * @param {string} options.baseURL      racine de l'API du produit
 * @param {() => Promise<boolean>} options.refresh  tentative de renouvellement de session
 * @param {() => void} options.onUnauthorized       appelé quand la session est perdue
 */
export function createAdminClient({ baseURL, refresh, onUnauthorized }) {
  const client = axios.create({
    baseURL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  });

  // Sur 401 : un seul essai de renouvellement, puis rejeu. Sinon, déconnexion.
  // `_retried` empêche la boucle si le refresh réussit mais que la route reste
  // interdite (cas d'une rétrogradation de rôle en cours de session).
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      if (
        error.response?.status === 401 &&
        original &&
        !original._retried &&
        !isAuthMutation(original.url)
      ) {
        original._retried = true;
        if (await refresh()) return client(original);
        onUnauthorized();
      }
      return Promise.reject(error);
    },
  );

  return client;
}
