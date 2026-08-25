/**
 * Écrans d'administration propres à SEmplyApp.
 *
 * Ils appellent `api.semply.fr/api/admin/*` — les contrôleurs restent dans
 * SEmplyApp, seuls les écrans vivent ici. Si SEmplyApp s'arrête, ce dossier
 * disparaît et rien d'autre ne bouge.
 *
 * Repris progressivement depuis `SEmplyApp/admin/src/pages/`.
 */
export const menus = [
  'OUVERTURE',
  'QUESTIONNAIRE',
  'ARTICLES',
  'ANNUAIRE',
  'PROCEDURES',
  'PROFILS',
  'ECHEANCES',
  'PLANS_COMPTABLES',
];

export const routes = [
  // { path: 'ouverture', menu: 'OUVERTURE', element: <AdminPlatformPage /> },
];
