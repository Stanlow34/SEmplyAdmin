/**
 * Format de stockage du thème, partagé par les quatre produits.
 *
 * L'enveloppe `{ state, version }` est celle qu'écrit le `persist` de Zustand
 * dans SEmplyApp. Elle est reprise telle quelle ici — y compris par les fronts
 * qui n'utilisent pas Zustand — pour une raison précise : le script anti-flash
 * posé dans les `index.html` doit savoir relire la préférence AVANT que le
 * bundle ne soit chargé. Un format unique, c'est un seul script à maintenir,
 * identique dans les quatre dépôts.
 *
 * Les clés diffèrent d'un produit à l'autre (`app-theme` dans SEmplyApp, pour
 * ne pas invalider les caches existants). Le script les essaie dans l'ordre.
 */

export const STORAGE_KEY = 'semply-theme';

/** Clés relues par le script anti-flash, dans l'ordre de préférence. */
export const STORAGE_KEYS = ['semply-theme', 'app-theme'];

export const STORAGE_VERSION = 1;

/** Lit la préférence enregistrée. Renvoie `null` si rien n'est lisible. */
export function readStoredTheme(storage, keys = STORAGE_KEYS) {
  if (!storage) return null;
  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      if (state && typeof state === 'object') return state;
    } catch {
      // Stockage inaccessible ou contenu illisible : on passe à la clé
      // suivante. Un thème est un confort, jamais un motif d'échec.
    }
  }
  return null;
}

/** Enregistre la préférence. Silencieuse en cas de stockage verrouillé. */
export function writeStoredTheme(storage, state, key = STORAGE_KEY) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ state, version: STORAGE_VERSION }));
  } catch {
    // Navigation privée verrouillée, quota plein : le thème reste appliqué
    // pour la session en cours, il ne survivra simplement pas au rechargement.
  }
}
