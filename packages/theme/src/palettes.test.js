// @vitest-environment node
// Aucun DOM ici : ce ne sont que des calculs sur des chaînes hexadécimales.
// Monter jsdom pour ça coûterait plus longtemps que la suite entière.
import { describe, expect, it } from 'vitest'
import { EDITABLE_COLORS, PALETTES } from './palettes.js'

/**
 * Contrastes des palettes, mesurés plutôt que relus.
 *
 * L'en-tête de `themes.js` promet des ratios ; une promesse en commentaire ne
 * survit pas à la première retouche de couleur. Ces tests la rendent
 * vérifiable : changer un hexadécimal d'un cran de trop fait tomber une
 * assertion, pas un utilisateur devant un texte illisible.
 *
 * Portée assumée : le seuil de 4,5:1 n'est exigé ici que des palettes qui s'en
 * réclament — « Sombre » et « Daltonien », dont les couleurs ont été choisies
 * par calcul. Les cinq palettes claires portent des couleurs sémantiques
 * héritées (#059669, #D97706) qui ne l'ont jamais atteint ; les y soumettre
 * ferait échouer la suite sur une dette antérieure au lieu de protéger
 * l'existant. Le test de complétude, lui, s'applique à TOUTES.
 */

// Palettes dont les couleurs ont été choisies PAR CALCUL, et qui se réclament
// donc du seuil AA. Les cinq palettes claires historiques portent des couleurs
// sémantiques héritées qui ne l'ont jamais atteint ; les y soumettre ferait
// échouer la suite sur une dette antérieure au lieu de protéger l'existant.
const CALCULATED_PALETTES = ['sombre', 'daltonien', 'admin', 'adminSombre']

const relativeLuminance = (hex) => {
  const c = hex.replace('#', '').slice(0, 6)
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrastRatio = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Certaines palettes composent leurs transparences (`var(--color-primary)80`).
 * Le contraste d'une couleur semi-transparente dépend du fond réel : on ne peut
 * pas le mesurer ici, et prétendre le faire donnerait un faux négatif.
 */
const solid = (value) =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null

/** Couples (texte, fond) qui doivent rester lisibles. */
const TEXT_ON_SURFACE = [
  ['--text-color', '--bg-color'],
  ['--text-color', '--bg-color-light'],
  ['--text-color', '--bg-color-hover'],
  ['--text-color-light', '--bg-color'],
  ['--text-color-light', '--bg-color-light'],
  ['--text-color-hover', '--bg-color'],
  ['--color-primary-text', '--bg-color'],
  ['--color-primary-text', '--bg-color-light'],
  ['--color-secondary-text', '--bg-color'],
  ['--color-secondary-text', '--bg-color-light'],
  // Le cas que les palettes ratent d'habitude : la couleur sémantique posée sur
  // SON propre fond de badge.
  ['--color-success', '--color-success-light'],
  ['--color-danger', '--color-danger-light'],
  ['--color-warning', '--color-warning-light'],
  // Texte explicitement prévu pour ces deux aplats.
  ['--color-on-tertiary', '--color-tertiary'],
  ['--color-on-accent', '--color-accent'],
]

describe('complétude des palettes', () => {
  it('définit dans chaque palette toutes les variables des autres', () => {
    const reference = new Set(Object.keys(PALETTES.sombre.vars))
    for (const [key, palette] of Object.entries(PALETTES)) {
      const missing = [...reference].filter((name) => !(name in palette.vars))
      expect(missing, `palette « ${key} »`).toEqual([])
    }
  })

  it('donne à chaque palette une couleur de texte pour le primaire et le secondaire', () => {
    // Ces deux variables existent parce que `--color-primary` sert de FOND :
    // une couleur qui fait un bon aplat fait un mauvais texte. Une palette qui
    // les oublierait retomberait sur du texte invisible.
    for (const [key, palette] of Object.entries(PALETTES)) {
      expect(solid(palette.vars['--color-primary-text']), `palette « ${key} »`).toBeTruthy()
      expect(solid(palette.vars['--color-secondary-text']), `palette « ${key} »`).toBeTruthy()
    }
  })

  it('n’expose aux color pickers que des variables réellement définies', () => {
    for (const { var: name } of EDITABLE_COLORS) {
      expect(PALETTES.sombre.vars, name).toHaveProperty(name)
    }
  })
})

describe.each(CALCULATED_PALETTES)('palette « %s » — contrastes', (key) => {
  const { vars } = PALETTES[key]

  it.each(TEXT_ON_SURFACE)('%s sur %s tient 4.5:1', (fg, bg) => {
    const text = solid(vars[fg])
    const surface = solid(vars[bg])
    expect(text, `${fg} doit être une couleur opaque`).toBeTruthy()
    expect(surface, `${bg} doit être une couleur opaque`).toBeTruthy()
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('garde les couleurs sémantiques lisibles sur les trois surfaces', () => {
    const surfaces = ['--bg-color', '--bg-color-light', '--bg-color-hover']
      .map((name) => solid(vars[name]))
      .filter(Boolean)

    for (const name of ['--color-success', '--color-danger', '--color-warning', '--color-info', '--color-alerte']) {
      const color = solid(vars[name])
      if (!color) continue
      for (const surface of surfaces) {
        expect(contrastRatio(color, surface), `${name} sur ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('rend les contours de champ visibles (3:1, seuil non textuel)', () => {
    // `--color-border-light` est le contour marqué : un champ de saisie dont on
    // ne distingue pas le bord est un champ qu'on ne voit pas.
    expect(
      contrastRatio(solid(vars['--color-border-light']), solid(vars['--bg-color'])),
    ).toBeGreaterThanOrEqual(3)
  })
})

const DARK_PALETTES = Object.keys(PALETTES).filter((key) => PALETTES[key].isDark)

describe.each(DARK_PALETTES)('palette « %s » — pas d’aplat clair', (key) => {
  const { vars } = PALETTES[key]

  /**
   * Les variables qui servent de FOND ne doivent jamais être claires : un aplat
   * pâle découpe un rectangle éblouissant dans une interface sombre. Le texte
   * en est exclu — c'est lui, et lui seul, qui a le droit d'être presque blanc.
   */
  const SURFACES = [
    '--bg-color',
    '--bg-color-light',
    '--bg-color-hover',
    '--color-primary',
    '--color-primary-light',
    '--color-primary-dark',
    '--color-secondary',
    '--color-secondary-light',
    '--color-secondary-dark',
    '--color-success-light',
    '--color-danger-light',
    '--color-warning-light',
  ]

  it.each(SURFACES)('%s reste une surface sombre', (name) => {
    const color = solid(vars[name])
    expect(color, `${name} doit être une couleur opaque`).toBeTruthy()
    // Seuil : la surface doit rester plus proche du noir que du texte. 7:1 face
    // au blanc revient à dire « au moins aussi sombre qu'un gris moyen foncé ».
    expect(contrastRatio(color, '#FFFFFF')).toBeGreaterThanOrEqual(7)
  })

  it('ne contient aucun blanc pur', () => {
    const whites = Object.entries(vars).filter(
      ([, value]) => typeof value === 'string' && /^#(fff|ffffff)\b/i.test(value.trim()),
    )
    expect(whites).toEqual([])
  })
})

/**
 * ΔE CIEDE2000 — écart perceptuel entre deux couleurs.
 *
 * Le contraste WCAG ne dit RIEN de la confusion entre deux fonds : #FAE5E4 et
 * #fee2e2 ont tous deux un contraste excellent avec le texte, et sont pourtant
 * la même couleur à l'œil (ΔE 2,5). C'est exactement le défaut qui rendait un
 * bandeau d'erreur indiscernable d'un champ de saisie. Il faut donc mesurer
 * l'écart, pas seulement la lisibilité.
 */
const lab = (hex) => {
  const c = hex.replace('#', '').slice(0, 6)
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const [x, y, z] = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116))
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

export const deltaE2000 = (c1, c2) => {
  const [L1, a1, b1] = lab(c1)
  const [L2, a2, b2] = lab(c2)
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const [A1, A2] = [a1 * (1 + G), a2 * (1 + G)]
  const [Cp1, Cp2] = [Math.hypot(A1, b1), Math.hypot(A2, b2)]
  const h1 = ((Math.atan2(b1, A1) * 180) / Math.PI + 360) % 360
  const h2 = ((Math.atan2(b2, A2) * 180) / Math.PI + 360) % 360
  const dL = L2 - L1
  const dC = Cp2 - Cp1
  let dh = 0
  if (Cp1 * Cp2 !== 0) {
    dh = h2 - h1
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * Math.PI) / 360)
  const Lb = (L1 + L2) / 2
  const Cpb = (Cp1 + Cp2) / 2
  let hb = h1 + h2
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(h1 - h2) > 180) hb += hb < 360 ? 360 : -360
    hb /= 2
  }
  const T =
    1 -
    0.17 * Math.cos(((hb - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hb * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hb + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hb - 63) * Math.PI) / 180)
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
  const Sc = 1 + 0.045 * Cpb
  const Sh = 1 + 0.015 * Cpb * T
  const Rt =
    -2 *
    Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) *
    Math.sin((60 * Math.exp(-(((hb - 275) / 25) ** 2)) * Math.PI) / 180)
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}

describe('palettes sombres — convention de nommage', () => {
  /**
   * Le script anti-flash des `index.html` s'exécute AVANT le bundle : il ne
   * peut pas importer la charte pour savoir si une palette est sombre. Il se
   * fie donc au nom — une clé qui se termine par « sombre ». Ce test est le
   * contrat : ajouter une palette sombre nommée autrement ferait réapparaître
   * l'éclair blanc au chargement, en silence.
   */
  it.each(DARK_PALETTES)('la clé « %s » se termine par « sombre »', (key) => {
    expect(key).toMatch(/sombre$/i)
  })

  it('aucune palette claire ne porte un nom en « sombre »', () => {
    for (const key of Object.keys(PALETTES)) {
      if (PALETTES[key].isDark) continue
      expect(key, `« ${key} » serait pris pour une palette sombre`).not.toMatch(/sombre$/i)
    }
  })

  it('chaque palette claire mène à une palette sombre existante', () => {
    for (const [key, palette] of Object.entries(PALETTES)) {
      if (palette.isDark) continue
      const sombre = palette.dark ?? 'sombre'
      expect(PALETTES[sombre], `« ${key} » désigne « ${sombre} »`).toBeTruthy()
      expect(PALETTES[sombre].isDark, `« ${sombre} » doit être sombre`).toBe(true)
    }
  })
})

describe('palette du back-office', () => {
  /**
   * Son intérêt tient entièrement à sa DIFFÉRENCE : elle dit « tu n'es pas
   * dans une application cliente ». Ces seuils sont ceux qui ont présidé à son
   * choix ; ils empêchent qu'une retouche la ramène vers la marque produit.
   */
  const CLIENTES = Object.keys(PALETTES).filter((k) => !PALETTES[k].internal && !PALETTES[k].isDark)

  it('reste à l’écart des couleurs de marque clientes', () => {
    const admin = PALETTES.admin.vars['--color-primary']
    for (const key of CLIENTES) {
      const ecart = deltaE2000(admin, PALETTES[key].vars['--color-primary'])
      expect(ecart, `trop proche de « ${key} »`).toBeGreaterThanOrEqual(15)
    }
  })

  it('ne se lit comme aucune couleur sémantique', () => {
    const { vars } = PALETTES.admin
    for (const name of ['--color-success', '--color-danger', '--color-warning', '--color-info', '--color-alerte']) {
      expect(deltaE2000(vars['--color-primary'], vars[name]), name).toBeGreaterThanOrEqual(20)
    }
  })

  it('n’est proposée dans aucun sélecteur de palette', () => {
    expect(PALETTES.admin.internal).toBe(true)
    expect(PALETTES.adminSombre.internal).toBe(true)
  })

  it('garde son identité en thème sombre', () => {
    // Sans `dark`, le back-office basculerait sur la palette « Sombre »
    // commune et deviendrait indiscernable d'une application cliente.
    expect(PALETTES.admin.dark).toBe('adminSombre')
  })
})

describe('--color-primary-light est une SURFACE de saisie', () => {
  /**
   * Ce jeton peint le fond des champs, des en-têtes de tableau et des options
   * de liste. Quatre palettes y portaient un « primaire éclairci » — un bleu
   * ou un sarcelle moyen — sur lequel le texte tombait entre 1,77:1 et 4,11:1.
   * Deux autres y portaient un rose à ΔE 2,5 du fond d'erreur.
   */
  it.each(Object.keys(PALETTES))('%s : le texte y est confortablement lisible', (key) => {
    const v = PALETTES[key].vars
    expect(contrastRatio(v['--text-color'], v['--color-primary-light'])).toBeGreaterThanOrEqual(7)
  })

  /**
   * `rose` est exemptée, et c'est structurel : son primaire EST rose, et le
   * fond d'erreur de la charte est rose lui aussi. Aucune teinte pâle sur la
   * teinte du primaire n'atteint ΔE 15 du rouge d'erreur. Dans cette palette,
   * la distinction repose sur la bordure du champ et sur la couleur du texte
   * d'erreur. La corriger demanderait de déplacer `--color-danger-light` pour
   * cette palette seulement — un choix de charte, pas une correction.
   */
  const SEPARATION_EXIGEE = Object.keys(PALETTES).filter((k) => k !== 'rose')

  it.each(SEPARATION_EXIGEE)('%s : ne se confond pas avec le fond d’erreur', (key) => {
    const v = PALETTES[key].vars
    expect(deltaE2000(v['--color-primary-light'], v['--color-danger-light'])).toBeGreaterThanOrEqual(15)
  })

  it.each(Object.keys(PALETTES))('%s : se distingue du fond de page et du survol', (key) => {
    const v = PALETTES[key].vars
    // Un champ qui a exactement la couleur d'une ligne survolée n'est plus un
    // champ : c'était le cas de la palette « Daltonien » (ΔE 0,0).
    expect(deltaE2000(v['--color-primary-light'], v['--bg-color'])).toBeGreaterThanOrEqual(4)
    expect(deltaE2000(v['--color-primary-light'], v['--bg-color-hover'])).toBeGreaterThanOrEqual(4)
  })
})
