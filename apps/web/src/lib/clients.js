import { createAdminClient } from '@semplyadmin/http';
import { AUTH_PRODUCT } from './products.js';

/**
 * Un client HTTP par produit, mémorisé.
 *
 * Le renouvellement de session est CENTRAL : la session est celle du portail,
 * pas celle d'un produit. Un 401 sur l'API de SEmplyCompta se règle donc en
 * rafraîchissant auprès d'AuthSEmply, puis en rejouant la requête d'origine.
 */

let refreshing = null;

async function refresh() {
  // Un seul appel concurrent : dix écrans qui prennent un 401 en même temps ne
  // doivent pas déclencher dix rotations de token.
  refreshing ??= fetch(`${AUTH_PRODUCT.apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function onUnauthorized() {
  // Le portail est seul juge : on ne montre pas d'écran de connexion local.
  window.location.assign(`${AUTH_PRODUCT.apiBaseUrl.replace('api-auth', 'auth')}/login`);
}

const cache = new Map();

/** @param {{key: string, apiBaseUrl: string}} product */
export function apiFor(product) {
  if (!cache.has(product.key)) {
    cache.set(product.key, createAdminClient({ baseURL: product.apiBaseUrl, refresh, onUnauthorized }));
  }
  return cache.get(product.key);
}

export function resetClients() {
  cache.clear();
}
