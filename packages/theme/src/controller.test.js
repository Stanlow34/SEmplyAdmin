import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThemeController } from './controller.js'
import { PALETTES } from './palettes.js'

/**
 * Le contrôleur est ce qui remplace le store de SEmplyApp dans les trois
 * autres fronts. Ce qui est vérifié ici, ce sont les règles qui se trompent
 * silencieusement : la reprise d'un thème enregistré avant l'existence du
 * mode, la palette de jour qui ne doit pas être écrasée par le sombre, et le
 * format de stockage — que le script anti-flash relit sans passer par ce code.
 */

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
    removeItem: (k) => { delete data[k] },
    _data: data,
  }
}

function stubMatchMedia(dark) {
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: dark, addEventListener() {}, removeEventListener() {} }),
  })
}

beforeEach(() => {
  vi.stubGlobal('document', undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reprise du thème enregistré', () => {
  it('sans rien d’enregistré, part en automatique sur la palette par défaut', () => {
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage() })
    expect(c.getSnapshot()).toMatchObject({
      mode: 'auto',
      paletteKey: 'default',
      appearance: 'system',
      isDark: false,
    })
  })

  it('rend le sombre quand le système est sombre et le mode automatique', () => {
    stubMatchMedia(true)
    const c = createThemeController({ storage: fakeStorage() })
    expect(c.getSnapshot().effectivePaletteKey).toBe('sombre')
    expect(c.getSnapshot().isDark).toBe(true)
  })

  it('laisse en manuel un compte qui avait choisi « Sombre » avant le mode', () => {
    // Le basculer en automatique lui rendrait une interface claire dès que son
    // système est clair — c'est-à-dire lui retirer ce qu'il était allé
    // chercher.
    stubMatchMedia(false)
    const storage = fakeStorage({
      'semply-theme': JSON.stringify({ state: { paletteKey: 'sombre' } }),
    })
    const c = createThemeController({ storage })
    expect(c.getSnapshot().mode).toBe('manual')
    expect(c.getSnapshot().effectivePaletteKey).toBe('sombre')
  })

  it('relit aussi la clé de SEmplyApp, sans quoi le portail perdrait le choix', () => {
    stubMatchMedia(false)
    const storage = fakeStorage({
      'app-theme': JSON.stringify({ state: { mode: 'manual', paletteKey: 'ocean' } }),
    })
    const c = createThemeController({ storage })
    expect(c.getSnapshot().paletteKey).toBe('ocean')
  })

  it('ignore une palette inconnue plutôt que de rendre une interface incolore', () => {
    stubMatchMedia(false)
    const storage = fakeStorage({
      'semply-theme': JSON.stringify({ state: { mode: 'manual', paletteKey: 'inexistante' } }),
    })
    expect(createThemeController({ storage }).getSnapshot().paletteKey).toBe('default')
  })

  it('survit à un stockage verrouillé (navigation privée)', () => {
    stubMatchMedia(false)
    const hostile = {
      getItem() { throw new Error('accès refusé') },
      setItem() { throw new Error('accès refusé') },
    }
    const c = createThemeController({ storage: hostile })
    expect(() => c.setAppearance('dark')).not.toThrow()
    expect(c.getSnapshot().appearance).toBe('dark')
  })
})

describe('choix d’apparence', () => {
  it('« Clair » restitue la palette de jour, pas la palette par défaut', () => {
    stubMatchMedia(true)
    const storage = fakeStorage()
    const c = createThemeController({ storage })
    c.setPalette('foret')          // choix de goût, palette claire
    c.setAppearance('dark')        // puis passage au sombre
    c.setAppearance('light')       // et retour au clair
    expect(c.getSnapshot().paletteKey).toBe('foret')
  })

  it('choisir « Sombre » n’écrase pas la palette de jour retenue', () => {
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage() })
    c.setPalette('ocean')
    c.setAppearance('dark')
    expect(c.getSnapshot().lightPaletteKey).toBe('ocean')
  })

  it('« Navigateur » rend la main au système', () => {
    stubMatchMedia(true)
    const c = createThemeController({ storage: fakeStorage() })
    c.setAppearance('light')
    expect(c.getSnapshot().effectivePaletteKey).toBe('default')
    c.setAppearance('system')
    expect(c.getSnapshot().effectivePaletteKey).toBe('sombre')
  })

  it('refuse une apparence inconnue sans rien changer', () => {
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage() })
    c.setAppearance('fluo')
    expect(c.getSnapshot().mode).toBe('auto')
  })
})

describe('format de stockage', () => {
  it('écrit l’enveloppe que relit le script anti-flash', () => {
    // Le fragment du <head> lit `JSON.parse(raw).state.paletteKey` sans passer
    // par ce code : l'enveloppe est un contrat, pas un détail d'implémentation.
    stubMatchMedia(false)
    const storage = fakeStorage()
    createThemeController({ storage }).setAppearance('dark')
    const written = JSON.parse(storage._data['semply-theme'])
    expect(written.state.paletteKey).toBe('sombre')
    expect(written.state.mode).toBe('manual')
    expect(written.version).toBe(1)
  })
})

describe('abonnement', () => {
  it('prévient les abonnés à chaque changement, et les oublie au désabonnement', () => {
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage() })
    const vu = vi.fn()
    const stop = c.subscribe(vu)
    c.setAppearance('dark')
    expect(vu).toHaveBeenCalledTimes(1)
    stop()
    c.setAppearance('light')
    expect(vu).toHaveBeenCalledTimes(1)
  })

  it('rend un instantané STABLE tant que rien ne change', () => {
    // `useSyncExternalStore` compare les références : un instantané neuf à
    // chaque lecture ferait boucler React à l'infini.
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage() })
    expect(c.getSnapshot()).toBe(c.getSnapshot())
  })
})

describe('palettes disponibles', () => {
  it('accepte les sept palettes de la charte', () => {
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage() })
    for (const key of Object.keys(PALETTES)) {
      c.setPalette(key)
      expect(c.getSnapshot().paletteKey).toBe(key)
    }
  })
})

describe('palette verrouillée (back-office)', () => {
  it('sert la palette du produit, quel que soit le cache', () => {
    stubMatchMedia(false)
    const storage = fakeStorage({
      'semply-theme': JSON.stringify({ state: { mode: 'manual', paletteKey: 'ocean' } }),
    })
    const c = createThemeController({ storage, lockedPalette: 'admin' })
    expect(c.getSnapshot().effectivePaletteKey).toBe('admin')
  })

  it('rend la variante sombre du produit, et non la sombre commune', () => {
    // C'est tout l'enjeu : un back-office en thème sombre qui bascule sur la
    // palette « Sombre » de la suite redevient indiscernable d'une application
    // cliente — exactement ce que son identité doit empêcher.
    stubMatchMedia(true)
    const c = createThemeController({ storage: fakeStorage(), lockedPalette: 'admin' })
    expect(c.getSnapshot().effectivePaletteKey).toBe('adminSombre')
    expect(c.getSnapshot().isDark).toBe(true)
  })

  it('ignore setPalette', () => {
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage(), lockedPalette: 'admin' })
    c.setPalette('rose')
    expect(c.getSnapshot().effectivePaletteKey).toBe('admin')
  })

  it('laisse le choix clair / sombre / navigateur', () => {
    stubMatchMedia(false)
    const c = createThemeController({ storage: fakeStorage(), lockedPalette: 'admin' })
    c.setAppearance('dark')
    expect(c.getSnapshot().effectivePaletteKey).toBe('adminSombre')
    c.setAppearance('light')
    expect(c.getSnapshot().effectivePaletteKey).toBe('admin')
    c.setAppearance('system')
    expect(c.getSnapshot().appearance).toBe('system')
  })

  it('n’écrit dans le stockage aucune palette d’un autre produit', () => {
    stubMatchMedia(false)
    const storage = fakeStorage()
    const c = createThemeController({ storage, lockedPalette: 'admin' })
    c.setPalette('foret')
    c.setAppearance('dark')
    const ecrit = JSON.parse(storage._data['semply-theme']).state
    expect([ecrit.paletteKey, ecrit.lightPaletteKey]).toEqual(['adminSombre', 'admin'])
  })
})

describe('palette sombre propre à une palette de jour', () => {
  it('« Sombre » reste le défaut des palettes qui n’en déclarent pas', () => {
    stubMatchMedia(true)
    const c = createThemeController({ storage: fakeStorage() })
    c.setPalette('foret')
    expect(c.getSnapshot().effectivePaletteKey).toBe('sombre')
  })
})
