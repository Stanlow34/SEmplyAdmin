import { lazy } from 'react';

/**
 * Écrans d'administration propres à SEmplyApp.
 *
 * Ils appellent le relais avec la clé `semplyapp` — les contrôleurs restent
 * dans SEmplyApp, seuls les écrans vivent ici. Si SEmplyApp s'arrête, ce
 * dossier et son entrée dans `../index.js` disparaissent, et rien d'autre ne
 * bouge : c'est ce qui rend l'arrêt d'un produit sans conséquence pour le
 * back-office.
 *
 * Chaque page est chargée à la demande : le bundle de SEmplyApp n'est
 * téléchargé que par quelqu'un qui ouvre un de ses écrans.
 */
const named = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const AdminPlatformPage = named(() => import('./AdminPlatformPage.jsx'), 'AdminPlatformPage');
const AdminQuestionsPage = named(() => import('./AdminQuestionsPage.jsx'), 'AdminQuestionsPage');
const AdminArticlesPage = named(() => import('./AdminArticlesPage.jsx'), 'AdminArticlesPage');
const AdminLinksPage = named(() => import('./AdminLinksPage.jsx'), 'AdminLinksPage');
const AdminProceduresPage = named(() => import('./AdminProceduresPage.jsx'), 'AdminProceduresPage');
const AdminProfilesPage = named(() => import('./AdminProfilesPage.jsx'), 'AdminProfilesPage');
const AdminDeadlinesPage = named(() => import('./AdminDeadlinesPage.jsx'), 'AdminDeadlinesPage');
const AdminAccountingPlansPage = named(() => import('./AdminAccountingPlansPage.jsx'), 'AdminAccountingPlansPage');

/** Entrées de navigation, dans l'ordre de `admin-menus.ts`. */
export const nav = [
  { key: 'OUVERTURE', to: '/admin/ouverture', label: 'Ouverture' },
  { key: 'QUESTIONNAIRE', to: '/admin/questions', label: 'Questionnaire' },
  { key: 'ARTICLES', to: '/admin/articles', label: 'Articles' },
  { key: 'ANNUAIRE', to: '/admin/annuaire', label: 'Annuaire' },
  { key: 'PROCEDURES', to: '/admin/procedures', label: 'Procédures' },
  { key: 'PROFILS', to: '/admin/profils', label: 'Profils' },
  { key: 'ECHEANCES', to: '/admin/echeances', label: 'Échéances' },
  { key: 'PLANS_COMPTABLES', to: '/admin/plans-comptables', label: 'Plans comptables' },
];

export const routes = [
  { path: '/admin/ouverture', menu: 'OUVERTURE', element: <AdminPlatformPage /> },
  { path: '/admin/questions', menu: 'QUESTIONNAIRE', element: <AdminQuestionsPage /> },
  { path: '/admin/articles', menu: 'ARTICLES', element: <AdminArticlesPage /> },
  { path: '/admin/annuaire', menu: 'ANNUAIRE', element: <AdminLinksPage /> },
  { path: '/admin/procedures', menu: 'PROCEDURES', element: <AdminProceduresPage /> },
  { path: '/admin/profils', menu: 'PROFILS', element: <AdminProfilesPage /> },
  { path: '/admin/echeances', menu: 'ECHEANCES', element: <AdminDeadlinesPage /> },
  { path: '/admin/plans-comptables', menu: 'PLANS_COMPTABLES', element: <AdminAccountingPlansPage /> },
];
