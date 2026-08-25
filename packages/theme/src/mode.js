import { PALETTES, DEFAULT_PALETTE_KEY } from './palettes.js';

/**
 * Suivi du thème clair/sombre du navigateur.
 *
 * Isolé du store pour une raison précise : `matchMedia` n'existe pas côté
 * serveur ni dans un environnement de test sans DOM, et une seule fonction
 * mal gardée y suffit à faire échouer tout le module. Tout ce qui touche à
 * l'API navigateur est donc rassemblé ici, derrière des gardes explicites, et
 * le store n'appelle que des fonctions qui répondent quoi qu'il arrive.
 */

/** Requête média standard (Media Queries niveau 5). */
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export const THEME_MODES = ['auto', 'manual'];

/**
 * Mode par défaut : AUTOMATIQUE.
 *
 * Quelqu'un qui a mis son système en thème sombre a déjà exprimé une
 * préférence ; lui servir une interface claire revient à l'ignorer et à lui
 * demander de la redire. Le réglage système est le choix par défaut le plus
 * fidèle qu'on puisse faire à sa place.
 *
 * Ce défaut ne s'applique qu'à DÉFAUT de choix : `inferModeForExistingTheme`
 * protège les comptes qui avaient déjà retenu une palette sombre à la main
 * avant que ce mode n'existe.
 */
export const DEFAULT_THEME_MODE = 'auto';

/**
 * Palette sombre par DÉFAUT — celle servie quand la palette de jour n'en
 * déclare pas une à elle (cf. darkPaletteFor).
 */
export const DARK_PALETTE_KEY = 'sombre';

/**
 * Le navigateur annonce-t-il un thème sombre ?
 *
 * `false` quand la question n'a pas de sens (rendu serveur, test sans DOM,
 * navigateur trop ancien pour `matchMedia`). Ce défaut est le bon : en cas de
 * doute on sert le thème clair, qui est celui de la majorité des comptes et
 * celui sur lequel toutes les palettes sont réglées.
 */
export function prefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * S'abonne aux changements du thème système. Renvoie la fonction de
 * désabonnement — toujours appelable, même quand rien n'a pu être écouté.
 *
 * `addEventListener` avec repli sur `addListener` : Safari n'a exposé
 * l'interface moderne qu'en 14. Le repli tient en trois lignes et évite un
 * défaut invisible depuis un poste de développement récent.
 */
export function watchColorScheme(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const query = window.matchMedia(DARK_QUERY);
  const handler = (event) => onChange(event.matches);

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }
  if (typeof query.addListener === 'function') {
    query.addListener(handler);
    return () => query.removeListener(handler);
  }
  return () => {};
}

/**
 * La palette est-elle une palette sombre ?
 *
 * Lu sur la palette elle-même (`isDark`) et non comparé à `sombre` : depuis
 * que le back-office a sa propre variante sombre, il y a plus d'une palette
 * sombre dans la charte. Une comparaison en dur ferait croire au reste du
 * code qu'un back-office en thème sombre est en thème clair — donc pas de
 * `color-scheme: dark`, et des barres de défilement claires sur fond noir.
 */
export function isDarkPalette(key) {
  return PALETTES[key]?.isDark === true;
}

/**
 * Palette sombre correspondant à une palette de jour.
 *
 * Par défaut, toutes les palettes claires partagent « Sombre » : leurs
 * couleurs de marque sont des accents, et un thème sombre commun leur va. Une
 * palette peut déclarer la sienne via `dark` — c'est le cas de la palette du
 * back-office, dont l'identité doit survivre au passage en sombre, puisque
 * c'est précisément elle qui dit « tu n'es pas dans une application cliente ».
 */
export function darkPaletteFor(lightPaletteKey) {
  const propre = PALETTES[lightPaletteKey]?.dark;
  return propre && PALETTES[propre] ? propre : DARK_PALETTE_KEY;
}

/**
 * Les trois apparences proposées à l'utilisateur.
 *
 * C'est la vue « produit » du couple (mode, palette) : `système` correspond au
 * mode automatique, `clair` et `sombre` au mode manuel avec l'une ou l'autre
 * palette. Deux notions plutôt qu'une parce qu'elles ne se recouvrent pas —
 * « sombre » et « le système est sombre » sont deux choses différentes, et
 * c'est précisément la distinction que le sélecteur doit rendre lisible.
 */
export const APPEARANCES = ['light', 'dark', 'system'];

export const APPEARANCE_LABELS = {
  light: 'Clair',
  dark: 'Sombre',
  system: 'Navigateur',
};

/** Ce que le sélecteur doit montrer comme sélectionné. */
export function currentAppearance({ mode, paletteKey }) {
  if (mode === 'auto') return 'system';
  return isDarkPalette(paletteKey) ? 'dark' : 'light';
}

/**
 * Mode à retenir pour un thème enregistré AVANT l'existence de ce réglage.
 *
 * Le cas à ne pas manquer : quelqu'un qui avait explicitement choisi « Sombre »
 * alors que rien ne l'y poussait. Le basculer en automatique lui rendrait une
 * interface claire dès que son système est clair — c'est-à-dire lui retirer
 * précisément ce qu'il était allé chercher. Ces comptes restent en manuel.
 *
 * Pour tous les autres, la palette enregistrée est une palette claire, ce qui
 * ne dit rien de leur préférence clair/sombre : ils n'avaient pas le choix. Le
 * réglage système est alors la meilleure supposition disponible.
 */
export function inferModeForExistingTheme(paletteKey) {
  return isDarkPalette(paletteKey) ? 'manual' : DEFAULT_THEME_MODE;
}

/**
 * Palette effectivement appliquée, à partir du réglage et de l'état du système.
 *
 * C'est LA règle du mode automatique, et elle tient en une ligne : en
 * automatique, un système sombre donne la palette sombre, tout le reste donne
 * la palette claire retenue par l'utilisateur.
 *
 * `lightPaletteKey` est la palette de jour — jamais « Sombre ». Le store
 * garantit cet invariant à l'écriture (cf. `setPalette`) pour qu'activer
 * l'automatique en plein thème sombre ne fige pas « sombre le jour comme la
 * nuit », ce qui donnerait l'impression que le réglage ne fait rien.
 */
export function resolvePaletteKey({ mode, lightPaletteKey, paletteKey, systemDark }) {
  if (mode === 'auto') {
    const light = PALETTES[lightPaletteKey] ? lightPaletteKey : DEFAULT_PALETTE_KEY;
    // La palette sombre servie est celle de la palette de JOUR retenue, et non
    // « Sombre » systématiquement : voir darkPaletteFor.
    if (systemDark) return darkPaletteFor(light);
    return light;
  }
  return PALETTES[paletteKey] ? paletteKey : DEFAULT_PALETTE_KEY;
}
