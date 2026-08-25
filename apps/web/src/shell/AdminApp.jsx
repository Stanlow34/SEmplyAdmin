import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { loadAccess } from '../lib/access.js';
import { loadProducts } from '../lib/products.js';
import { PRODUCT_MODULES } from '../products/index.js';

/**
 * Coquille du back-office.
 *
 * Elle ne connaît aucun métier. Elle assemble trois choses :
 *   - le RÔLE de la session, qui dit quels menus sont ouverts ;
 *   - le CATALOGUE des produits, qui dit lesquels existent et où joindre leur API ;
 *   - les MODULES de routes, chargés à la demande pour les produits présents dans
 *     les deux listes.
 *
 * Un menu masqué ici n'est jamais la seule protection : chaque API revalide le
 * rôle à chaque requête. On masque pour ne pas proposer un écran qui finirait
 * en 403, pas pour sécuriser.
 */

const TRANSVERSE_NAV = [
  { key: 'DASHBOARD', label: 'Tableau de bord', to: '/admin' },
  { key: 'CATALOGUE', label: 'Catalogue', to: '/admin/catalogue' },
  { key: 'JOURNAL', label: 'Journal', to: '/admin/journal' },
  { key: 'TICKETS', label: 'Tickets', to: '/admin/tickets' },
  { key: 'SESSION_SUPPORT', label: 'Session support', to: '/admin/support' },
  { key: 'SECURITE', label: 'Sécurité', to: '/admin/securite' },
  { key: 'UTILISATEURS', label: 'Utilisateurs', to: '/admin/utilisateurs' },
];

function useBootstrap() {
  const [state, setState] = useState(null);
  useEffect(() => {
    Promise.all([loadAccess(), loadProducts()]).then(([access, products]) =>
      setState({ access, products }),
    );
  }, []);
  return state;
}

export default function AdminApp() {
  const boot = useBootstrap();

  if (!boot) return <p>Chargement…</p>;
  const { access, products } = boot;

  // Habilité mais TOTP non appairé : un seul écran est atteignable, et il faut
  // le dire clairement plutôt qu'afficher « accès refusé ».
  if (access.mfaRequired) {
    return <p>Double authentification à activer avant d’accéder à l’administration.</p>;
  }
  if (!access.isSuperAdmin) return <p>Accès refusé.</p>;
  if (!access.role) return <p>Compte habilité mais sans rôle assigné — contactez un Owner.</p>;

  const hasMenu = (key) => access.menus.includes(key);

  // Un produit n'apparaît que s'il est AU CATALOGUE et qu'un module existe.
  const activeProducts = products.filter((p) => PRODUCT_MODULES[p.key]);

  return (
    <BrowserRouter>
      <nav>
        {TRANSVERSE_NAV.filter((item) => hasMenu(item.key)).map((item) => (
          <NavLink key={item.key} to={item.to}>
            {item.label}
          </NavLink>
        ))}
        {activeProducts.map((p) => (
          <NavLink key={p.key} to={`/admin/p/${p.key}`}>
            {p.name}
          </NavLink>
        ))}
      </nav>

      <main>
        <Routes>
          <Route path="/admin" element={<p>Tableau de bord — {access.role.name}</p>} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
