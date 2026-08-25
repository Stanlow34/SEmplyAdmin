// @vitest-environment node
// Volontairement SANS DOM : c'est le seul moyen de vérifier que les gardes
// tiennent quand `window` n'existe pas. Les cas navigateur montent un faux
// `window` explicite, ce qui rend visible ce que chaque test suppose.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APPEARANCES,
  APPEARANCE_LABELS,
  DARK_PALETTE_KEY,
  DEFAULT_THEME_MODE,
  currentAppearance,
  darkPaletteFor,
  inferModeForExistingTheme,
  isDarkPalette,
  prefersDark,
  resolvePaletteKey,
  watchColorScheme,
} from './mode.js'

/** Faux `matchMedia`, avec l'interface moderne (addEventListener). */
function fakeMatchMedia({ matches = false, legacy = false } = {}) {
  const listeners = new Set()
  const query = {
    matches,
    media: '(prefers-color-scheme: dark)',
    dispatch(next) {
      query.matches = next
      listeners.forEach((l) => l({ matches: next }))
    },
  }
  if (legacy) {
    query.addListener = (l) => listeners.add(l)
    query.removeListener = (l) => listeners.delete(l)
  } else {
    query.addEventListener = (_, l) => listeners.add(l)
    query.removeEventListener = (_, l) => listeners.delete(l)
  }
  globalThis.window = { matchMedia: () => query }
  return { query, listeners }
}

afterEach(() => {
  delete globalThis.window
  vi.restoreAllMocks()
})

describe('détection du thème du navigateur', () => {
  it('répond faux sans navigateur, plutôt que de lever', () => {
    // Rendu serveur, test sans DOM, navigateur sans matchMedia : dans le doute
    // on sert le thème clair, sur lequel toutes les palettes sont réglées.
    expect(prefersDark()).toBe(false)
  })

  it('répond faux quand matchMedia n’existe pas', () => {
    globalThis.window = {}
    expect(prefersDark()).toBe(false)
  })

  it('reflète l’état annoncé par le navigateur', () => {
    fakeMatchMedia({ matches: true })
    expect(prefersDark()).toBe(true)
  })
})

describe('abonnement aux changements de thème système', () => {
  it('renvoie une fonction de désabonnement même sans navigateur', () => {
    // Le composant appelle toujours le retour dans son nettoyage : renvoyer
    // `undefined` ferait planter le démontage sur un rendu serveur.
    expect(() => watchColorScheme(() => {})()).not.toThrow()
  })

  it('prévient au passage en sombre, puis se désabonne', () => {
    const { query, listeners } = fakeMatchMedia()
    const seen = []
    const stop = watchColorScheme((dark) => seen.push(dark))

    query.dispatch(true)
    query.dispatch(false)
    expect(seen).toEqual([true, false])

    stop()
    expect(listeners.size).toBe(0)
    query.dispatch(true)
    expect(seen).toEqual([true, false])
  })

  it('retombe sur addListener pour les navigateurs antérieurs', () => {
    // Safari n'a exposé addEventListener sur MediaQueryList qu'en 14.
    const { query, listeners } = fakeMatchMedia({ legacy: true })
    const seen = []
    const stop = watchColorScheme((dark) => seen.push(dark))
    query.dispatch(true)
    expect(seen).toEqual([true])
    stop()
    expect(listeners.size).toBe(0)
  })
})

describe('palette effectivement appliquée', () => {
  const light = { mode: 'auto', lightPaletteKey: 'ocean', paletteKey: 'ocean' }

  it('sert la palette sombre quand le système est sombre', () => {
    expect(resolvePaletteKey({ ...light, systemDark: true })).toBe(DARK_PALETTE_KEY)
  })

  it('sert la palette de jour quand le système est clair', () => {
    expect(resolvePaletteKey({ ...light, systemDark: false })).toBe('ocean')
  })

  it('ignore le système en mode manuel', () => {
    for (const systemDark of [true, false]) {
      expect(
        resolvePaletteKey({ mode: 'manual', paletteKey: 'foret', systemDark }),
      ).toBe('foret')
    }
  })

  it('retombe sur la palette par défaut si la clé est inconnue', () => {
    // Une palette retirée du code ne doit pas laisser l'interface sans
    // couleurs : le thème enregistré en base survit au code qui l'a produit.
    expect(resolvePaletteKey({ mode: 'manual', paletteKey: 'disparue', systemDark: false }))
      .toBe('default')
    expect(
      resolvePaletteKey({ mode: 'auto', lightPaletteKey: 'disparue', systemDark: false }),
    ).toBe('default')
  })

  it('retombe sur la palette par défaut si aucune palette de jour n’est connue', () => {
    expect(resolvePaletteKey({ mode: 'auto', systemDark: false })).toBe('default')
  })
})

describe('garde-fous', () => {
  it('ne reconnaît comme sombre que la palette sombre', () => {
    expect(isDarkPalette(DARK_PALETTE_KEY)).toBe(true)
    for (const key of ['default', 'ocean', 'rose', 'nuit', 'foret', 'daltonien', undefined]) {
      expect(isDarkPalette(key)).toBe(false)
    }
  })

  it('démarre en automatique : un système sombre est déjà une préférence', () => {
    expect(DEFAULT_THEME_MODE).toBe('auto')
  })
})

describe('script anti-flash (html/preflight.html)', () => {
  /**
   * Le fragment copié dans le <head> des quatre produits pose trois couleurs
   * sombres en ligne, avant le premier rendu, pour éviter l'éclair blanc.
   * Elles DUPLIQUENT la palette — c'est le prix à payer pour s'exécuter avant
   * le bundle, mais une duplication silencieuse dérive. Ce test la rend
   * bruyante : changer la palette sombre sans changer le fragment échoue ici.
   */
  const VARS = ['--bg-color', '--bg-color-light', '--text-color']

  async function preflight() {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    return readFileSync(
      fileURLToPath(new URL('../html/preflight.html', import.meta.url)),
      'utf8',
    )
  }

  it('reprend exactement les valeurs de la palette sombre', async () => {
    const html = await preflight()
    const { PALETTES } = await import('./palettes.js')
    const sombre = PALETTES.sombre.vars

    for (const name of VARS) {
      const found = html.match(
        new RegExp(`setProperty\\('${name}',\\s*'(#[0-9a-fA-F]{6})'\\)`),
      )
      expect(found, `${name} doit être posé par le script anti-flash`).toBeTruthy()
      expect(found[1].toLowerCase()).toBe(sombre[name].toLowerCase())
    }
  })

  it('déclare color-scheme, sans quoi les barres de défilement restent claires', async () => {
    // Le CSS n'atteint pas ce que le navigateur dessine lui-même : c'est ce
    // détail qui trahit le plus vite un thème sombre incomplet.
    expect(await preflight()).toMatch(/colorScheme\s*=\s*'dark'/)
  })

  it('relit les deux clés de stockage de la suite', async () => {
    // SEmplyApp écrit sous `app-theme` (héritage de son store Zustand), les
    // trois autres sous `semply-theme`. Un fragment qui n'en connaîtrait
    // qu'une rendrait l'éclair blanc à l'un des deux camps.
    const html = await preflight()
    const { STORAGE_KEYS } = await import('./storage.js')
    for (const key of STORAGE_KEYS) expect(html).toContain(`'${key}'`)
  })
})

describe('jetons CSS générés', () => {
  it('css/tokens.css est à jour vis-à-vis de src/palettes.js', async () => {
    // La palette existe en double par nécessité : en JS pour le changement à
    // l'exécution, en CSS pour la première peinture. Le CSS est GÉNÉRÉ, et ce
    // test échoue si quelqu'un a modifié la palette sans relancer le build.
    const { execFileSync } = await import('node:child_process')
    const { fileURLToPath } = await import('node:url')
    const script = fileURLToPath(new URL('../scripts/build-tokens.mjs', import.meta.url))
    expect(() => execFileSync(process.execPath, [script, '--check'])).not.toThrow()
  })
})

describe('apparence affichée par le sélecteur', () => {
  it('montre « Navigateur » en mode automatique, quel que soit le rendu', () => {
    // Le sélecteur reflète la RÈGLE choisie, pas son résultat du moment :
    // afficher « Sombre » parce qu'il fait nuit laisserait croire que le suivi
    // du système a été désactivé.
    expect(currentAppearance({ mode: 'auto', paletteKey: 'sombre' })).toBe('system')
    expect(currentAppearance({ mode: 'auto', paletteKey: 'ocean' })).toBe('system')
  })

  it('distingue clair et sombre en mode manuel', () => {
    expect(currentAppearance({ mode: 'manual', paletteKey: 'sombre' })).toBe('dark')
    expect(currentAppearance({ mode: 'manual', paletteKey: 'ocean' })).toBe('light')
  })

  it('propose exactement trois apparences, toutes libellées', () => {
    expect(APPEARANCES).toEqual(['light', 'dark', 'system'])
    for (const choice of APPEARANCES) {
      expect(APPEARANCE_LABELS[choice]).toBeTruthy()
    }
  })
})

describe('thèmes enregistrés avant l’existence du mode', () => {
  it('laisse en manuel qui avait choisi « Sombre » à la main', () => {
    // Le seul cas où l'automatique retirerait quelque chose : cette personne
    // était allée chercher le sombre, un système clair le lui reprendrait.
    expect(inferModeForExistingTheme('sombre')).toBe('manual')
  })

  it('passe en automatique les autres, qui n’avaient rien pu choisir', () => {
    for (const key of ['default', 'ocean', 'rose', 'nuit', 'foret', 'daltonien', undefined]) {
      expect(inferModeForExistingTheme(key)).toBe('auto')
    }
  })
})

describe('palette sombre correspondante', () => {
  it('renvoie « Sombre » pour une palette qui n’en déclare pas', () => {
    expect(darkPaletteFor('default')).toBe('sombre')
    expect(darkPaletteFor('foret')).toBe('sombre')
  })

  it('renvoie la variante déclarée quand il y en a une', () => {
    expect(darkPaletteFor('admin')).toBe('adminSombre')
  })

  it('retombe sur « Sombre » pour une palette inconnue', () => {
    // Une clé venue d'un cache trafiqué ne doit pas laisser l'interface sans
    // palette : mieux vaut un thème sombre inattendu qu'un écran incolore.
    expect(darkPaletteFor('inexistante')).toBe('sombre')
    expect(darkPaletteFor(undefined)).toBe('sombre')
  })
})
