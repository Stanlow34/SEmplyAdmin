import { getBffBase } from '@semplyadmin/http';

/**
 * Produits joignables, tels que le relais les déclare.
 *
 * L'interface ne connaît AUCUNE URL d'API : elle reçoit des clés. La liste
 * blanche vit dans le relais (`PRODUCTS`), seul endroit où une adresse est
 * écrite.
 */
export async function loadProducts() {
  try {
    // Le relais lui-même, pas un produit : `getBffBase()` et non `apiFetch`.
    const res = await fetch(`${getBffBase()}/p`, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Dégradé plutôt que cassé : les écrans transverses restent atteignables.
    return [];
  }
}
