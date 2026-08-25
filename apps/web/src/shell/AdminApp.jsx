import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ThemeSwitch } from '@semply/theme/ThemeSwitch';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { EnvironmentBanner } from '../components/EnvironmentBanner.jsx';
import { Toaster } from '../components/toast/Toaster.jsx';
import { useSession, logout } from './useSession.js';
import { loadProducts } from '../lib/products.js';
import { PRODUCT_MODULES } from '../products/index.js';
import { theme } from '../theme.js';
import './AdminApp.css';

/**
 * Back-office de la SUITE, servi depuis admin.semply.fr.
 *
 * La coquille ne connaît aucun métier. Elle assemble trois choses :
 *
 *   - le RÔLE de la session, qui dit quels menus sont ouverts (/admin/access) ;
 *   - le CATALOGUE des produits joignables, que le relais déclare ;
 *   - les MODULES de routes des produits présents dans les deux listes.
 *
 * Un menu masqué ici n'est jamais la seule protection : chaque API revalide le
 * rôle à chaque requête. On masque pour ne pas proposer un écran qui finirait
 * en 403, pas pour sécuriser.
 */

const named = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const AdminDashboardPage = named(() => import('../transverse/AdminDashboardPage.jsx'), 'AdminDashboardPage');
const AdminPlansPage = named(() => import('../transverse/AdminPlansPage.jsx'), 'AdminPlansPage');
const AdminSuitePage = named(() => import('../transverse/AdminSuitePage.jsx'), 'AdminSuitePage');
const AdminActivityPage = named(() => import('../transverse/AdminActivityPage.jsx'), 'AdminActivityPage');
const AdminSupportTicketsPage = named(() => import('../transverse/AdminSupportTicketsPage.jsx'), 'AdminSupportTicketsPage');
const AdminSupportPage = named(() => import('../transverse/AdminSupportPage.jsx'), 'AdminSupportPage');
const AdminSecurityPage = named(() => import('../transverse/AdminSecurityPage.jsx'), 'AdminSecurityPage');
const AdminUsersPage = named(() => import('../transverse/AdminUsersPage.jsx'), 'AdminUsersPage');

/**
 * Écrans qui doivent survivre à l'arrêt d'un produit : identité, support,
 * facturation, journal. Miroir des clés de `admin-menus.ts`.
 */
const TRANSVERSE_NAV = [
  { key: 'DASHBOARD', to: '/admin', end: true, label: 'Tableau de bord' },
  { key: 'OUVERTURE', to: '/admin/suite', label: 'Suite SEmply' },
  { key: 'CATALOGUE', to: '/admin/plans', label: 'Catalogue' },
  { key: 'JOURNAL', to: '/admin/journal', label: 'Journal' },
  { key: 'TICKETS', to: '/admin/support/tickets', label: 'Tickets' },
  { key: 'SESSION_SUPPORT', to: '/admin/support', label: 'Session support' },
  { key: 'SECURITE', to: '/admin/securite', label: 'Sécurité' },
  { key: 'UTILISATEURS', to: '/admin/utilisateurs', label: 'Utilisateurs' },
];

const TRANSVERSE_ROUTES = [
  { path: '/admin/suite', menu: 'OUVERTURE', element: <AdminSuitePage /> },
  { path: '/admin/plans', menu: 'CATALOGUE', element: <AdminPlansPage /> },
  { path: '/admin/journal', menu: 'JOURNAL', element: <AdminActivityPage /> },
  { path: '/admin/support/tickets', menu: 'TICKETS', element: <AdminSupportTicketsPage /> },
  { path: '/admin/support', menu: 'SESSION_SUPPORT', element: <AdminSupportPage /> },
  { path: '/admin/securite', menu: 'SECURITE', element: <AdminSecurityPage /> },
  { path: '/admin/utilisateurs', menu: 'UTILISATEURS', element: <AdminUsersPage /> },
];

/** Modules des produits réellement joignables, dans l'ordre du catalogue. */
function useProductModules() {
  const [modules, setModules] = useState([]);
  useEffect(() => {
    loadProducts().then((products) =>
      setModules(
        products
          .map((product) => ({ product, module: PRODUCT_MODULES[product.key] }))
          .filter((entry) => entry.module),
      ),
    );
  }, []);
  return modules;
}

/** Première section réellement ouverte, pour ne jamais laisser sur un cul-de-sac. */
function firstAllowedPath(menus, nav) {
  const entry = nav.find((item) => menus.includes(item.key));
  return entry?.to ?? null;
}

/**
 * Un rôle qui n'ouvre pas le menu est REDIRIGÉ vers sa première section
 * accessible plutôt que gratifié d'un écran d'erreur : l'URL tapée à la main ou
 * le favori d'un ancien rôle ne doivent pas ressembler à une panne. Le serveur
 * refuse de toute façon (403 ADMIN_MENU_REQUIRED) si l'appel partait quand même.
 */
function RequireMenu({ menu, hasMenu, mfaRequired, menus, nav, children }) {
  // Sans 2FA, tout mène à l'écran Sécurité, où l'appairage se fait — c'est la
  // seule porte de sortie, et l'y envoyer vaut mieux qu'un « accès refusé »
  // adressé à quelqu'un qui est bel et bien habilité.
  if (mfaRequired) {
    return menu === 'SECURITE' ? children : <Navigate to="/admin/securite" replace />;
  }

  if (!hasMenu(menu)) {
    const fallback = firstAllowedPath(menus, nav);
    if (fallback && fallback !== '/admin') return <Navigate to={fallback} replace />;
    return <NoAccess />;
  }

  return children;
}

function NoAccess() {
  return (
    <div className="admin-refused">
      <h1>Aucun accès</h1>
      <p>
        Aucun rôle d’administration ne vous est assigné. Rapprochez-vous du
        propriétaire de la plateforme.
      </p>
    </div>
  );
}

/** /admin pour un rôle sans tableau de bord : atterrir sur sa première section. */
function AdminLanding({ hasMenu, mfaRequired, menus, nav }) {
  if (mfaRequired) return <Navigate to="/admin/securite" replace />;
  if (hasMenu('DASHBOARD')) return <AdminDashboardPage />;
  const fallback = firstAllowedPath(menus, nav);
  return fallback && fallback !== '/admin' ? <Navigate to={fallback} replace /> : <NoAccess />;
}

function AdminShell({ nav, hasMenu, mfaRequired, roleName, user }) {
  const location = useLocation();

  return (
    <>
      <EnvironmentBanner />
      <header className="admin-header">
        <Link to="/admin" className="admin-brand">
          SEmply <span>Administration</span>
        </Link>
        {/* Le rôle est affiché en permanence, et non seulement quand il
            restreint : savoir avec quels droits on travaille évite de croire à
            une panne devant un menu absent. */}
        {roleName && <span className="admin-profile">{roleName}</span>}
        <nav className="admin-nav" aria-label="Administration">
          {/* Sans 2FA on n'affiche QUE Sécurité : chaque autre entrée mènerait
              à une redirection vers elle, autant le dire par l'absence. */}
          {nav
            .filter((item) => (mfaRequired ? item.key === 'SECURITE' : hasMenu(item.key)))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="admin-session">
          <span>{user?.email}</span>
          <ThemeSwitch controller={theme} />
          <button type="button" onClick={() => logout()}>Se déconnecter</button>
        </div>
      </header>
      {/* Frontière PAR ÉCRAN : un écran cassé laisse le menu utilisable. `key`
          sur le chemin, sinon la frontière resterait déclenchée après un
          changement d'onglet et condamnerait toutes les autres pages. */}
      <main className="admin-main">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<p className="admin-loading">Chargement…</p>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}

export default function AdminApp() {
  const { loading: sessionLoading, user } = useSession();
  const { loading: accessLoading, isSuperAdmin, mfaRequired, roleName, hasMenu, menus } = useAdminAccess();
  const productModules = useProductModules();

  if (sessionLoading || accessLoading) return <p className="admin-loading">Chargement…</p>;

  if (!isSuperAdmin && !mfaRequired) {
    return (
      <div className="admin-denied">
        <h1>Accès refusé</h1>
        <p>Ce compte n’est pas habilité à l’administration de la suite.</p>
      </div>
    );
  }

  const nav = [...TRANSVERSE_NAV, ...productModules.flatMap((entry) => entry.module.nav ?? [])];
  const routes = [...TRANSVERSE_ROUTES, ...productModules.flatMap((entry) => entry.module.routes ?? [])];

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route
          element={
            <AdminShell
              nav={nav}
              hasMenu={hasMenu}
              mfaRequired={mfaRequired}
              roleName={roleName}
              user={user}
            />
          }
        >
          <Route
            path="/admin"
            element={
              <AdminLanding hasMenu={hasMenu} mfaRequired={mfaRequired} menus={menus} nav={nav} />
            }
          />
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <RequireMenu
                  menu={route.menu}
                  hasMenu={hasMenu}
                  mfaRequired={mfaRequired}
                  menus={menus}
                  nav={nav}
                >
                  {route.element}
                </RequireMenu>
              }
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
