import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { configureHttp, resetHttpConfig } from '@semplyadmin/http'
import { resetAdminAccessCache } from '../../hooks/useAdminAccess.js'
import { insertBlockAt } from '../../lib/articleEditor.js'
import { AdminArticlesPage } from './AdminArticlesPage.jsx'

/**
 * L'écran de rédaction des articles, monté COMME EN PRODUCTION : à l'intérieur
 * du routeur de l'application.
 *
 * Ce détail est tout le sujet. La page enveloppait son aperçu dans un
 * `<MemoryRouter>` pour empêcher qu'un lien interne cliqué en relecture ne
 * fasse naviguer le back-office. React Router v7 refuse un routeur imbriqué
 * dans un autre : la page levait « You cannot render a <Router> inside another
 * <Router> » dès son montage, et l'onglet Articles n'affichait plus qu'un écran
 * de repli générique — sans aucune trace lisible, le bundle de production étant
 * minifié et sans sourcemap.
 *
 * Aucun test ne montait cette page : c'est ce qui a permis au défaut de vivre.
 * Rendre le composant sous un `<BrowserRouter>` suffit à le rattraper, et c'est
 * pour cela que le premier test ci-dessous ne vérifie presque rien d'autre.
 */

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const ARTICLES = [
  {
    id: 1,
    slug: 'facturation-electronique',
    title: 'Facturation électronique',
    category: 'Réforme',
    summary: 'Ce qui change et à quelle date.',
    published: true,
    position: 10,
  },
]

const renderPage = () =>
  render(
    <BrowserRouter>
      <AdminArticlesPage />
    </BrowserRouter>,
  )

beforeEach(() => {
  resetHttpConfig()
  resetAdminAccessCache()
  configureHttp({ apiBase: '/api' })

  vi.stubGlobal(
    'fetch',
    vi.fn((input) => {
      const url = String(input)
      if (url.includes('/admin/access')) {
        return Promise.resolve(jsonResponse({ is_superadmin: true, capabilities: ['write'] }))
      }
      if (url.includes('/admin/articles')) {
        return Promise.resolve(jsonResponse(ARTICLES))
      }
      return Promise.resolve(jsonResponse({ message: 'inattendu' }, 404))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetAdminAccessCache()
  resetHttpConfig()
})

describe('insertBlockAt', () => {
  const insert = (text, start, end = start) =>
    insertBlockAt(text, start, end, '![Légende](/img.png)', 'Légende').body

  it('isole le bloc du texte qui l’entoure', () => {
    // Une image collée au milieu d'un paragraphe deviendrait une image EN LIGNE
    // au rendu : la ligne vide est ce qui en fait une figure pleine largeur.
    expect(insert('Avant. Après.', 7)).toBe('Avant.\n\n![Légende](/img.png)\n\nAprès.')
  })

  it('n’ouvre pas l’article sur une ligne vide', () => {
    expect(insert('Suite.', 0)).toBe('![Légende](/img.png)\n\nSuite.')
  })

  it('termine par un simple retour à la ligne en fin de corps', () => {
    expect(insert('Fin.', 4)).toBe('Fin.\n\n![Légende](/img.png)\n')
  })

  it('remplace la sélection courante', () => {
    expect(insert('Avant TROU après', 6, 11)).toBe('Avant\n\n![Légende](/img.png)\n\naprès')
  })

  it('désigne le texte alternatif, pas le bloc entier', () => {
    const { body, start, end } = insertBlockAt('', 0, 0, '![Légende](/img.png)', 'Légende')
    expect(body.slice(start, end)).toBe('Légende')
  })
})

describe('AdminArticlesPage', () => {
  it('se monte à l’intérieur du routeur de l’application', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Articles' })).toBeInTheDocument()
    // La liste est arrivée : le montage est allé jusqu'au bout, pas seulement
    // jusqu'à l'écran « Chargement… ».
    expect(await screen.findByText('Facturation électronique')).toBeInTheDocument()
  })

  it('affiche « Aucun article » plutôt que de tomber si la liste n’est pas un tableau', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input) => {
        const url = String(input)
        if (url.includes('/admin/access')) {
          return Promise.resolve(jsonResponse({ is_superadmin: true, capabilities: ['write'] }))
        }
        // 204 : `call` renvoie alors `null`, que le rendu traitait comme un
        // tableau à la ligne suivante.
        return Promise.resolve(new Response(null, { status: 204 }))
      }),
    )

    renderPage()

    expect(await screen.findByText('Aucun article.')).toBeInTheDocument()
  })

  it('dépose une image et l’insère à la position du curseur', async () => {
    const uploads = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input, init) => {
        const url = String(input)
        if (url.includes('/admin/access')) {
          return Promise.resolve(jsonResponse({ is_superadmin: true, capabilities: ['write'] }))
        }
        if (url.includes('/admin/articles/images')) {
          uploads.push(init)
          return Promise.resolve(
            jsonResponse({ url: '/v1/articles/images/abc-0123456789abcdef.png' }),
          )
        }
        return Promise.resolve(jsonResponse(ARTICLES))
      }),
    )

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Articles' })

    const body = screen.getByLabelText('Contenu')
    fireEvent.change(body, { target: { value: 'Avant.\n\nAprès.' } })
    // Curseur à la fin du premier paragraphe : c'est là que l'image doit
    // atterrir, et non à la fin du texte.
    body.setSelectionRange(6, 6)

    const file = new File(['png'], 'capture.png', { type: 'image/png' })
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [file] },
    })

    await waitFor(() =>
      expect(body.value).toBe(
        'Avant.\n\n![Légende](/v1/articles/images/abc-0123456789abcdef.png)\n\nAprès.',
      ),
    )

    // Le corps du dépôt est un multipart : lui coller un Content-Type JSON
    // rendrait le fichier invisible au serveur.
    expect(uploads[0].body).toBeInstanceOf(FormData)
    expect(uploads[0].headers).toEqual({})

    // La légende est présélectionnée : le rédacteur la remplace en tapant.
    expect(body.value.slice(body.selectionStart, body.selectionEnd)).toBe('Légende')
  })

  it('dépose l’image collée et laisse passer un collage de texte', async () => {
    const upload = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn((input) => {
        const url = String(input)
        if (url.includes('/admin/access')) {
          return Promise.resolve(jsonResponse({ is_superadmin: true, capabilities: ['write'] }))
        }
        if (url.includes('/admin/articles/images')) {
          upload()
          return Promise.resolve(
            jsonResponse({ url: '/v1/articles/images/abc-0123456789abcdef.png' }),
          )
        }
        return Promise.resolve(jsonResponse(ARTICLES))
      }),
    )

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Articles' })
    const body = screen.getByLabelText('Contenu')

    // Collage de texte — le cas d'un copier-coller depuis Word, qui ne met pas
    // ses illustrations dans `files` : rien n'est déposé, le navigateur fait
    // son travail habituel.
    fireEvent.paste(body, { clipboardData: { files: [] } })
    expect(upload).not.toHaveBeenCalled()

    fireEvent.paste(body, {
      clipboardData: { files: [new File([''], 'c.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(body.value).toContain('![Légende](/v1/articles/images/'))
  })

  it('neutralise la navigation d’un lien interne de l’aperçu', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Articles' })

    fireEvent.change(screen.getByLabelText('Contenu'), {
      target: { value: '[Échéances](/echeances)' },
    })

    const link = await screen.findByRole('link', { name: 'Échéances' })
    const before = window.location.pathname

    fireEvent.click(link)

    // Sans la neutralisation en phase de capture, <Link> aurait poussé
    // /echeances dans l'historique et le rédacteur aurait perdu sa saisie.
    expect(window.location.pathname).toBe(before)
  })
})
