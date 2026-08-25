import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiErrorMessage } from '@semplyadmin/http';

/**
 * Catalogue de la suite SEmply — noms, descriptions, URLs, statut « lancé »
 * et ordre d'affichage des produits, tels que le PORTAIL (auth.semply.fr) les
 * présente après connexion.
 *
 * Ces données ne vivent PAS dans la base SEmplyApp : la source de vérité est
 * la table des clients OIDC d'AuthSEmply. L'appel passe par le relais, qui
 * présente à AuthSEmply le jeton du portail — le navigateur, lui, n'a rien à
 * présenter et n'a plus besoin d'une session de portail séparée. C'est ce qui
 * fait disparaître l'ancienne bizarrerie des « deux annuaires indépendants ».
 *
 * Un produit passé « lancé » apparaît sur le portail au rechargement suivant,
 * sans déploiement.
 */

const PRODUCT = 'authsemply';

export function AdminSuitePage() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');

  const call = useCallback(async (path, options = {}) => {
    const res = await apiFetch(path, { product: PRODUCT, ...options });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("Votre compte n'est pas superadmin sur le portail (isSuperAdmin).");
      }
      throw new Error(await apiErrorMessage(res, 'Le portail a refusé la demande.'));
    }
    return res.json();
  }, []);

  useEffect(() => {
    call('/admin/products')
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, [call]);

  const edit = (clientId, patch) => {
    setProducts((list) =>
      list.map((product) => (product.clientId === clientId ? { ...product, ...patch } : product)),
    );
  };

  const save = async (product) => {
    setSavingId(product.clientId);
    setError('');
    setMessage('');
    try {
      const saved = await call(`/admin/products/${encodeURIComponent(product.clientId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: product.name,
          description: product.description || null,
          productUrl: product.productUrl || null,
          isLive: product.isLive,
          displayOrder: Number(product.displayOrder) || 0,
        }),
      });
      edit(product.clientId, saved);
      setMessage(`${saved.name} enregistré.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  if (error && !products) {
    return (
      <div className="admin-page">
        <h1>Suite SEmply</h1>
        <p role="alert">{error}</p>
      </div>
    );
  }

  if (!products) {
    return (
      <div className="admin-page">
        <h1>Suite SEmply</h1>
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Suite SEmply</h1>
      <p>
        Produits affichés par le portail <strong>auth.semply.fr</strong> après connexion. Un seul
        produit « lancé » : les utilisateurs y sont envoyés directement ; plusieurs : un écran de
        choix leur est proposé.
      </p>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Nom affiché</th>
            <th>Description</th>
            <th>URL publique</th>
            <th>Lancé</th>
            <th>Ordre</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.clientId}>
              <td>
                <code>{product.clientId}</code>
              </td>
              <td>
                <input
                  value={product.name}
                  onChange={(e) => edit(product.clientId, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  value={product.description ?? ''}
                  placeholder="Visible sous le nom, sur le portail"
                  onChange={(e) => edit(product.clientId, { description: e.target.value })}
                />
              </td>
              <td>
                <input
                  value={product.productUrl ?? ''}
                  placeholder="https://…"
                  onChange={(e) => edit(product.clientId, { productUrl: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={product.isLive}
                  disabled={!product.productUrl}
                  title={!product.productUrl ? "Renseignez d'abord l'URL publique" : undefined}
                  onChange={(e) => edit(product.clientId, { isLive: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  style={{ width: '4em' }}
                  value={product.displayOrder}
                  onChange={(e) => edit(product.clientId, { displayOrder: e.target.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  disabled={savingId === product.clientId}
                  onClick={() => save(product)}
                >
                  {savingId === product.clientId ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminSuitePage;
