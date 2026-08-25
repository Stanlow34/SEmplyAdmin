import { PALETTES, DEFAULT_PALETTE_KEY } from './palettes.js';
import {
  APPEARANCES,
  DEFAULT_THEME_MODE,
  THEME_MODES,
  currentAppearance,
  darkPaletteFor,
  inferModeForExistingTheme,
  isDarkPalette,
  prefersDark,
  resolvePaletteKey,
  watchColorScheme,
} from './mode.js';
import { applyPalette } from './apply.js';
import { STORAGE_KEY, readStoredTheme, writeStoredTheme } from './storage.js';

/**
 * Thème sans gestionnaire d'état.
 *
 * SEmplyApp pilote son thème depuis un store Zustand qui fait aussi la
 * synchronisation avec le compte. Les trois autres fronts n'ont besoin ni de
 * l'un ni de l'autre : ce contrôleur leur donne les mêmes règles — mode
 * automatique, palette de jour distincte de la palette figée, suivi du
 * système — en une trentaine de lignes utiles et sans dépendance.
 *
 * Il est volontairement `subscribe`/`getSnapshot` : c'est exactement ce
 * qu'attend `useSyncExternalStore` de React, sans imposer React au paquet.
 *
 * La préférence est LOCALE à chaque produit pour l'instant. La faire remonter
 * au service d'auth (une palette pour toute la suite, choisie une fois) est
 * l'étape suivante : c'est `load`/`save` qu'il faudra brancher, la mécanique
 * ci-dessous ne bouge pas.
 */
export function createThemeController(options = {}) {
  const {
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    storageKey = STORAGE_KEY,
    storageKeys,
    /**
     * Verrouille la palette du produit.
     *
     * Le back-office s'en sert : son identité visuelle est ce qui dit « tu
     * n'es pas dans une application cliente », et elle ne doit pas pouvoir
     * être défaite par mégarde depuis un sélecteur. `setPalette` devient
     * inerte, et seul le choix clair/sombre/navigateur reste ouvert — il règle
     * le confort des yeux, pas le goût.
     */
    lockedPalette = null,
  } = options;

  const listeners = new Set();

  let state = normalize(readStoredTheme(storage, storageKeys));
  // Instantané figé, remplacé à chaque changement : `useSyncExternalStore`
  // compare les références et boucle à l'infini si on lui en fabrique un neuf
  // à chaque lecture.
  let snapshot = buildSnapshot(state);

  function normalize(stored) {
    const paletteKey = PALETTES[stored?.paletteKey] ? stored.paletteKey : DEFAULT_PALETTE_KEY;
    // Thème enregistré avant l'existence du mode : un choix explicite de la
    // palette sombre reste un choix (cf. inferModeForExistingTheme).
    const mode = THEME_MODES.includes(stored?.mode)
      ? stored.mode
      : inferModeForExistingTheme(stored?.paletteKey);

    if (lockedPalette && PALETTES[lockedPalette]) {
      // Seule l'apparence survit à la relecture : on ne retient du cache que
      // le mode et le fait qu'il était clair ou sombre. Un cache trafiqué ne
      // peut donc pas faire porter au back-office la palette d'un client.
      return {
        mode,
        lightPaletteKey: lockedPalette,
        paletteKey: isDarkPalette(paletteKey) ? darkPaletteFor(lockedPalette) : lockedPalette,
        customVars: {},
      };
    }

    const lightPaletteKey = PALETTES[stored?.lightPaletteKey]
      ? stored.lightPaletteKey
      : isDarkPalette(paletteKey)
        ? DEFAULT_PALETTE_KEY
        : paletteKey;
    return { mode, paletteKey, lightPaletteKey, customVars: stored?.customVars ?? {} };
  }

  function effectivePaletteKey() {
    return resolvePaletteKey({
      mode: state.mode,
      lightPaletteKey: state.lightPaletteKey,
      paletteKey: state.paletteKey,
      systemDark: prefersDark(),
    });
  }

  function buildSnapshot(s) {
    const key = resolvePaletteKey({
      mode: s.mode,
      lightPaletteKey: s.lightPaletteKey,
      paletteKey: s.paletteKey,
      systemDark: prefersDark(),
    });
    return {
      mode: s.mode,
      paletteKey: s.paletteKey,
      lightPaletteKey: s.lightPaletteKey,
      effectivePaletteKey: key,
      appearance: currentAppearance({ mode: s.mode, paletteKey: s.paletteKey }),
      isDark: isDarkPalette(key),
    };
  }

  function commit(next, { persist = true } = {}) {
    state = { ...state, ...next };
    if (persist) {
      writeStoredTheme(
        storage,
        {
          mode: state.mode,
          paletteKey: state.paletteKey,
          lightPaletteKey: state.lightPaletteKey,
          customVars: state.customVars,
        },
        storageKey
      );
    }
    apply();
  }

  function apply() {
    const key = effectivePaletteKey();
    applyPalette(key, state.customVars);
    snapshot = buildSnapshot(state);
    listeners.forEach((fn) => fn());
  }

  return {
    /** Instantané stable, à donner tel quel à `useSyncExternalStore`. */
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Réapplique la palette courante. À appeler au démarrage du front. */
    apply,

    /**
     * Choix d'apparence : 'light' · 'dark' · 'system'.
     *
     * « Clair » et « Sombre » figent (mode manuel) : demander explicitement le
     * clair alors que le système est sombre n'a de sens que si la demande
     * survit à la seconde suivante. « Clair » restitue la palette de jour de
     * l'utilisateur, pas une palette imposée : le sélecteur règle le
     * clair/sombre, pas le goût.
     */
    setAppearance(choice) {
      if (!APPEARANCES.includes(choice)) return;
      if (choice === 'system') {
        commit({ mode: 'auto' });
      } else {
        const jour = state.lightPaletteKey ?? DEFAULT_PALETTE_KEY;
        commit({
          mode: 'manual',
          // La sombre servie est celle de la palette de jour, pas « Sombre »
          // systématiquement : le back-office garde son identité en sombre.
          paletteKey: choice === 'dark' ? darkPaletteFor(jour) : jour,
        });
      }
    },

    /**
     * Choix d'une palette : repart d'une base propre (sans retouches).
     *
     * Choisir une palette CLAIRE met aussi à jour la palette de jour du mode
     * automatique : sans cela, quelqu'un qui règle « Océan » en manuel puis
     * active l'automatique retrouverait « Par défaut » le lendemain matin.
     */
    setPalette(key) {
      // Produit à palette verrouillée (back-office) : inerte par construction.
      if (lockedPalette) return;
      if (!PALETTES[key]) return;
      const next = { paletteKey: key, customVars: {} };
      if (!isDarkPalette(key)) next.lightPaletteKey = key;
      commit(next);
    },

    /**
     * Suit les changements de thème du système, sans rechargement. Utile
     * au-delà du cas « l'utilisateur bascule son OS » : macOS et Windows savent
     * passer en sombre à une heure donnée, et l'application peut très bien être
     * ouverte à ce moment-là.
     *
     * L'abonnement est pris quel que soit le mode : passer en automatique ne
     * doit pas dépendre d'un abonnement qui n'aurait pas été souscrit.
     */
    watchSystem() {
      return watchColorScheme(() => {
        if (state.mode === 'auto') apply();
      });
    },

    /** Démarrage complet : applique et suit le système. Renvoie l'arrêt. */
    start() {
      apply();
      return this.watchSystem();
    },
  };
}

export { DEFAULT_THEME_MODE };
