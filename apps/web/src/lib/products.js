import api from './clients.js';

/**
 * Produits joignables, tels que le relais les déclare.
 *
 * L'interface ne connaît AUCUNE URL d'API : elle reçoit des clés. La liste
 * blanche vit dans le BFF (`PRODUCTS`), seul endroit où une adresse est écrite.
 */
export async function loadProducts() {
  try {
    const { data } = await api.get('/p');
    return Array.isArray(data) ? data : [];
  } catch {
    // Dégradé plutôt que cassé : les écrans transverses restent atteignables.
    return [];
  }
}
