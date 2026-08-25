import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { configureHttp, resetHttpConfig } from '@semplyadmin/http'
import { ArticleMarkdown } from './markdown.jsx'

/**
 * Le corps des articles vient de la base, écrit depuis le back-office. Ce
 * rendu est donc la frontière : les tests vérifient d'abord ce qui NE DOIT PAS
 * arriver (HTML interprété, schéma d'URL exotique dans un href), ensuite la
 * syntaxe utile.
 *
 * COPIE DE `frontend/src/containers/articles/markdown.test.jsx`, comme
 * `markdown.jsx` lui-même est une copie. Le rendu est dupliqué de part et
 * d'autre parce que le back-office est autonome ; sans cette copie du test, la
 * copie du rendu serait la seule des deux à n'être vérifiée par rien — et une
 * divergence entre l'aperçu du rédacteur et l'écran du lecteur est justement le
 * défaut que ce module cherche à rendre impossible.
 *
 * À garder synchronisée avec l'original.
 */

const view = (body, props = {}) =>
  render(
    <MemoryRouter>
      <ArticleMarkdown body={body} {...props} />
    </MemoryRouter>,
  )

/** `can` d'un lecteur qui possède les fonctionnalités listées. */
const withFeatures = (...keys) => (key) => keys.includes(key)

describe('sûreté du contenu', () => {
  it('n’interprète pas le HTML saisi en base', () => {
    const { container } = view('<script>alert(1)</script> et <b>gras</b>')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    // Le texte reste visible : on affiche, on n'exécute pas.
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })

  it('refuse javascript: dans un lien et retombe sur le texte brut', () => {
    const { container } = view('[cliquez](javascript:alert(1))')
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('[cliquez](javascript:alert(1))')
  })

  it('refuse data: et les schémas inconnus', () => {
    const { container } = view('[x](data:text/html,<script>1</script>) [y](ftp://h/f)')
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  it('refuse un lien protocol-relative, qui sortirait du domaine', () => {
    const { container } = view('[ailleurs](//evil.example.com)')
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('//evil.example.com')
  })

  it.each([
    ['data:', '![x](data:image/svg+xml,<svg onload=alert(1)>)'],
    ['javascript:', '![x](javascript:alert(1))'],
    ['protocol-relative', '![x](//evil.example.com/p.png)'],
  ])('refuse une image en %s et retombe sur le texte brut', (_schema, body) => {
    const { container } = view(body)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('![x](')
  })
})

describe('liens', () => {
  it('ouvre les liens externes dans un nouvel onglet, avec rel complet', () => {
    view('Voir [SuperPDP](https://www.superpdp.tech/) pour comparer.')
    const link = screen.getByRole('link', { name: 'SuperPDP' })
    expect(link).toHaveAttribute('href', 'https://www.superpdp.tech/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('garde les liens internes en navigation react-router', () => {
    view('Voir le [calendrier](/echeances).')
    const link = screen.getByRole('link', { name: 'calendrier' })
    expect(link).toHaveAttribute('href', '/echeances')
    expect(link).not.toHaveAttribute('target')
  })
})

describe('images', () => {
  // Les illustrations sont servies par l'API, pas par l'origine du front : le
  // corps de l'article ne stocke qu'un chemin, résolu au rendu.
  beforeEach(() => configureHttp({ apiBase: '/api' }))
  afterEach(() => resetHttpConfig())

  it('rend une image seule sur sa ligne en figure légendée', () => {
    const { container } = view('![Écran des échéances](/v1/articles/images/a1-b2.png)')

    const image = container.querySelector('figure.article-figure img')
    expect(image).toHaveAttribute('src', '/api/v1/articles/images/a1-b2.png')
    expect(image).toHaveAttribute('alt', 'Écran des échéances')
    // Chargement différé : une image plus bas dans l'article ne retarde pas
    // l'affichage du texte.
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(container.querySelector('figcaption').textContent).toBe('Écran des échéances')
  })

  it('n’ajoute pas de légende quand le texte alternatif est vide', () => {
    const { container } = view('![](/v1/articles/images/a1-b2.png)')
    expect(container.querySelector('img')).toBeInTheDocument()
    expect(container.querySelector('figcaption')).toBeNull()
  })

  it('sépare l’image du texte qui la précède', () => {
    // Sans le bloc dédié, la ligne serait absorbée par le paragraphe et
    // produirait une figure imbriquée dans un <p> — un HTML invalide.
    const { container } = view('Avant.\n\n![L](/v1/articles/images/a.png)\n\nAprès.')
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('p figure')).toBeNull()
  })

  it('rend une image au fil du texte sans en faire une figure', () => {
    const { container } = view('Cliquez sur ![+](/v1/articles/images/a.png) pour ajouter.')
    expect(container.querySelector('figure')).toBeNull()
    const image = container.querySelector('p img.article-inline-image')
    expect(image).toHaveAttribute('src', '/api/v1/articles/images/a.png')
    expect(container.textContent).toContain('Cliquez sur')
  })

  it('ne confond pas une image et un lien', () => {
    const { container } = view('![L](/v1/articles/images/a.png) et [texte](/echeances)')
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'texte' })).toBeInTheDocument()
    // Le « ! » a bien été consommé par l'image, pas laissé devant un lien.
    expect(container.textContent).not.toContain('!')
  })

  it('accepte une image hébergée ailleurs, en https', () => {
    const { container } = view('![Schéma](https://www.superpdp.tech/schema.png)')
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://www.superpdp.tech/schema.png',
    )
  })
})

describe('syntaxe de bloc', () => {
  it('rend les titres de niveau 2 et 3, mais pas de h1', () => {
    const { container } = view('## Grand\n\n### Petit\n\n# Interdit')
    expect(screen.getByRole('heading', { level: 2, name: 'Grand' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Petit' })).toBeInTheDocument()
    expect(container.querySelector('h1')).toBeNull()
    // Un « # » seul n'est pas une syntaxe reconnue : il s'affiche tel quel.
    expect(container.textContent).toContain('# Interdit')
  })

  it('regroupe les lignes contiguës en un paragraphe et sépare sur ligne vide', () => {
    const { container } = view('une ligne\nsuite\n\nautre paragraphe')
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].textContent).toBe('une ligne suite')
  })

  it('rend les listes à puces et numérotées', () => {
    const { container } = view('- un\n- deux\n\n1. premier\n2. second')
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
  })

  it('transforme une citation en encadré', () => {
    const { container } = view('> **Titre**\n> Corps de l’encadré')
    const callout = container.querySelector('.article-callout')
    expect(callout).toBeInTheDocument()
    expect(callout.querySelectorAll('p')).toHaveLength(2)
    expect(callout.querySelector('strong').textContent).toBe('Titre')
  })

  it('rend un tableau avec en-tête', () => {
    const { container } = view(
      '| Plateforme | Tarif |\n| --- | --- |\n| [Solo](https://www.solo.fr/tarifs) | Gratuit |',
    )
    expect(container.querySelectorAll('thead th')).toHaveLength(2)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Solo' })).toBeInTheDocument()
  })

  it('n’invente pas de tableau sans ligne de séparation', () => {
    const { container } = view('| a | b |\n| c | d |')
    expect(container.querySelector('table')).toBeNull()
    expect(container.textContent).toContain('a | b')
  })

  it('rend un filet horizontal', () => {
    const { container } = view('avant\n\n---\n\naprès')
    expect(container.querySelectorAll('hr')).toHaveLength(1)
  })
})

describe('syntaxe en ligne', () => {
  it('rend le gras et l’italique', () => {
    const { container } = view('du **gras** et de l’*italique*')
    expect(container.querySelector('strong').textContent).toBe('gras')
    expect(container.querySelector('em').textContent).toBe('italique')
  })

  it('ne confond pas gras et italique', () => {
    const { container } = view('**1ᵉʳ septembre 2026**')
    expect(container.querySelector('strong').textContent).toBe('1ᵉʳ septembre 2026')
    expect(container.querySelector('em')).toBeNull()
  })
})

describe('blocs conditionnels', () => {
  const body = [
    ':::si app.menu.pa',
    '[Inscrire ma société](/pa/inscription)',
    ':::sinon',
    'Ouvrez un compte sur [superpdp.tech](https://www.superpdp.tech/).',
    ':::',
  ].join('\n')

  it('affiche la branche « si » au lecteur qui a la fonctionnalité', () => {
    view(body, { can: withFeatures('app.menu.pa') })
    expect(screen.getByRole('link', { name: 'Inscrire ma société' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'superpdp.tech' })).toBeNull()
  })

  it('affiche la branche « sinon » aux autres', () => {
    view(body, { can: withFeatures('app.menu.ventes') })
    expect(screen.queryByRole('link', { name: 'Inscrire ma société' })).toBeNull()
    expect(screen.getByRole('link', { name: 'superpdp.tech' })).toBeInTheDocument()
  })

  it('retombe sur « sinon » quand les droits sont inconnus', () => {
    // Repli sûr : sans `can`, on ne propose jamais un écran non inclus.
    view(body)
    expect(screen.queryByRole('link', { name: 'Inscrire ma société' })).toBeNull()
    expect(screen.getByRole('link', { name: 'superpdp.tech' })).toBeInTheDocument()
  })

  it('affiche les deux branches étiquetées en mode aperçu', () => {
    const { container } = view(body, { preview: true })
    expect(screen.getByRole('link', { name: 'Inscrire ma société' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'superpdp.tech' })).toBeInTheDocument()
    const labels = [...container.querySelectorAll('.article-conditional-label')].map(
      (n) => n.textContent,
    )
    expect(labels[0]).toContain('app.menu.pa')
    expect(labels[1]).toBe('Sinon')
  })

  it('accepte un bloc sans branche « sinon »', () => {
    const only = ':::si app.menu.pa\nRéservé.\n:::\nToujours visible.'
    expect(view(only, { can: withFeatures('app.menu.pa') }).container.textContent).toContain(
      'Réservé.',
    )
    const other = view(only, { can: withFeatures() }).container.textContent
    expect(other).not.toContain('Réservé.')
    expect(other).toContain('Toujours visible.')
  })

  it('n’avale rien quand le bloc n’est pas refermé', () => {
    // Le pire défaut possible serait de masquer la fin de l'article en silence.
    const { container } = view(':::si app.menu.pa\nSuite de l’article.')
    expect(container.textContent).toContain(':::si app.menu.pa')
    expect(container.textContent).toContain('Suite de l’article.')
  })

  it('fonctionne à l’intérieur d’un encadré', () => {
    const callout = [
      '> **SuperPDP**',
      '> Recommandé.',
      '> :::si app.menu.pa',
      '> [Inscrire ma société](/pa/inscription)',
      '> :::sinon',
      '> Inclus dans les formules avec facturation électronique.',
      '> :::',
    ].join('\n')

    const { container } = view(callout, { can: withFeatures('app.menu.pa') })
    const box = container.querySelector('.article-callout')
    expect(box).toBeInTheDocument()
    expect(box.querySelector('strong').textContent).toBe('SuperPDP')
    expect(box.textContent).toContain('Inscrire ma société')
    expect(box.textContent).not.toContain('facturation électronique')
  })

  it('garde un retour à la ligne par ligne dans un encadré', () => {
    // Le titre d'un encadré est sur sa propre ligne : il ne doit pas fusionner
    // avec le paragraphe suivant.
    const { container } = view('> **Titre**\n> Corps.')
    expect(container.querySelectorAll('.article-callout p')).toHaveLength(2)
  })
})

describe('corps dégénérés', () => {
  it('n’affiche rien pour un corps vide, sans planter', () => {
    expect(view('').container.innerHTML).toBe('')
    expect(view('   \n\n  ').container.innerHTML).toBe('')
    expect(view(undefined).container.innerHTML).toBe('')
  })
})
