import React, { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '../../lib/apiBase.js'
import { useSudo } from '../../hooks/useSudo.jsx'
import { useAdminAccess } from '../../hooks/useAdminAccess.js'
import { ArticleMarkdown } from '../../lib/markdown.jsx'
import { ALT_PLACEHOLDER, IMAGE_TYPES, imageOf, insertBlockAt } from '../../lib/articleEditor.js'
import '../../lib/articles.css'
import './AdminArticlesPage.css'

/**
 * Rédaction des articles de conseil (back-office super admin).
 *
 * Le contenu est du markdown restreint, rendu par le MÊME composant que
 * l'application cliente : l'aperçu n'est pas une approximation, c'est
 * exactement ce que verra le lecteur. Une divergence entre les deux rendus
 * serait le pire défaut possible pour un outil d'édition.
 *
 * Les mutations passent par `withSudo` : l'API exige une ré-authentification de
 * moins de 15 minutes pour écrire (SudoGuard), la modale s'affiche au premier
 * refus puis l'action est rejouée.
 */

const EMPTY = {
  id: null,
  slug: '',
  title: '',
  category: '',
  summary: '',
  body: '',
  published: false,
  position: 100,
}

/** Aide-mémoire de la syntaxe : ce que le rendu sait faire, et rien de plus. */
const SYNTAX_HELP = [
  ['## Titre', 'Titre de section (### pour un sous-titre)'],
  ['- item', 'Liste à puces (1. pour une liste numérotée)'],
  ['> texte', 'Encadré, pour une recommandation'],
  ['**gras**', '*italique*'],
  ['[texte](https://…)', 'Lien externe, ouvert dans un nouvel onglet'],
  ['[texte](/echeances)', 'Lien interne à l’application'],
  ['![Légende](…)', 'Image — passez par « Insérer une image », le chemin est fourni'],
  ['| a | b |', 'Tableau — la 2ᵉ ligne doit être « | --- | --- | »'],
  [':::si app.menu.pa', 'Contenu réservé aux formules qui ont cette fonctionnalité'],
  [':::sinon', 'Variante pour les autres (facultatif)'],
  [':::', 'Ferme le bloc conditionnel — obligatoire'],
]

export function AdminArticlesPage() {
  const [allowed, setAllowed] = useState(null) // null = vérification en cours
  const [articles, setArticles] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  // Plage à sélectionner APRÈS que React a réécrit le champ. Poser la sélection
  // dans la foulée du setForm ne tiendrait pas : le rendu qui suit la remet à
  // la fin du texte, et le rédacteur retrouverait son curseur loin de l'image.
  const pendingSelection = useRef(null)

  useEffect(() => {
    const selection = pendingSelection.current
    if (!selection) return
    pendingSelection.current = null

    const textarea = bodyRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(selection.start, selection.end)
  }, [form.body])

  const { run: withSudo, prompt: sudoPrompt } = useSudo()
  // Profil de consultation : on masque les actions d'écriture plutôt que de les
  // laisser échouer en 403. Le serveur refuse de toute façon (capacité `write`).
  const { can, profileLabel } = useAdminAccess()
  const canWrite = can('write')

  const call = useCallback(async (path, options = {}) => {
    // Un corps FormData part SANS Content-Type : la frontière du multipart est
    // posée par le navigateur, et l'annoncer en `application/json` rendrait le
    // corps illisible côté serveur — sans autre symptôme qu'un « Aucun fichier
    // reçu ».
    const multipart = options.body instanceof FormData
    const res = await fetch(`${API_BASE}${path}`, {
      headers: options.body && !multipart
        ? { 'Content-Type': 'application/json' }
        : {},
      ...options,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const err = new Error(body?.message ?? `HTTP ${res.status}`)
      // useSudo lit ce code pour déclencher la ré-authentification plutôt que
      // d'afficher un refus sec.
      err.code = body?.error
      err.status = res.status
      throw err
    }
    return res.status === 204 ? null : res.json()
  }, [])

  const load = useCallback(async () => {
    const list = await call('/admin/articles')
    // Le rendu suppose un tableau (`articles.length`, puis `.map`). `call`
    // renvoie `null` sur un 204, et toute réponse d'une autre forme ferait
    // tomber l'écran entier dans la frontière d'erreur — là où une liste vide
    // dit la même chose sans rien casser.
    setArticles(Array.isArray(list) ? list : [])
  }, [call])

  useEffect(() => {
    ;(async () => {
      try {
        await load()
        setAllowed(true)
      } catch (e) {
        // Super admin sans double authentification : le guard répond
        // MFA_REQUIRED. On l'oriente vers l'activation plutôt que d'afficher un
        // refus (même traitement que le catalogue commercial).
        if (e?.code === 'MFA_REQUIRED') {
          setAllowed('mfa')
          return
        }
        setAllowed(false)
      }
    })()
  }, [load])

  const select = async (article) => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    try {
      // La liste ne transporte pas le corps : on recharge l'article complet.
      const full = await call(`/admin/articles/${article.id}`)
      setForm({
        id: full.id,
        slug: full.slug,
        title: full.title,
        category: full.category,
        summary: full.summary,
        body: full.body,
        published: full.published,
        position: full.position,
      })
    } catch (e) {
      setError(String(e.message ?? e))
    }
  }

  const startNew = () => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    setForm(EMPTY)
  }

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  /**
   * Dépose une image et l'insère là où était le curseur.
   *
   * Trois chemins mènent ici — le bouton, un collage, un glisser-déposer — et
   * ils font tous exactement la même chose : c'est ce qui permet de promettre
   * « à la position du curseur » sans exception à retenir.
   */
  const uploadImage = async (file) => {
    if (!file || !canWrite || uploading) return
    setError('')
    setNotice('')
    setUploading(true)

    try {
      const data = new FormData()
      data.append('file', file)
      const { url } = await withSudo(() =>
        call('/admin/articles/images', { method: 'POST', body: data }),
      )

      const textarea = bodyRef.current
      const start = textarea?.selectionStart ?? form.body.length
      const end = textarea?.selectionEnd ?? form.body.length
      const inserted = insertBlockAt(
        form.body,
        start,
        end,
        `![${ALT_PLACEHOLDER}](${url})`,
        ALT_PLACEHOLDER,
      )

      pendingSelection.current = { start: inserted.start, end: inserted.end }
      setForm((f) => ({ ...f, body: inserted.body }))
      setNotice('Image insérée. Le texte sélectionné devient sa légende.')
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setUploading(false)
    }
  }

  const pickImage = (event) => {
    const file = event.target.files?.[0]
    // Vidé tout de suite : sans cela, redéposer LE MÊME fichier ne déclenche
    // aucun change et le bouton paraît cassé.
    event.target.value = ''
    uploadImage(file)
  }

  /**
   * Collage et dépôt d'une image dans le champ. Un collage de texte n'est pas
   * intercepté : Word met du texte brut dans le presse-papiers, et ses
   * illustrations n'y sont pas des fichiers — elles se déposent une par une.
   */
  const handlePaste = (event) => {
    const file = imageOf(event.clipboardData)
    if (!file) return
    event.preventDefault()
    uploadImage(file)
  }

  const handleDrop = (event) => {
    const file = imageOf(event.dataTransfer)
    if (!file) return
    event.preventDefault()
    uploadImage(file)
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      // Slug vide à la création = dérivé du titre par le serveur. À la
      // modification on l'envoie tel quel : le rédacteur reste maître d'une URL
      // déjà partagée.
      slug: form.slug.trim() || undefined,
      title: form.title.trim(),
      category: form.category.trim(),
      summary: form.summary.trim(),
      body: form.body,
      published: form.published,
      position: Number(form.position) || 100,
    }

    try {
      const saved = await withSudo(() =>
        form.id
          ? call(`/admin/articles/${form.id}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            })
          : call('/admin/articles', { method: 'POST', body: JSON.stringify(payload) }),
      )
      setForm((f) => ({ ...f, id: saved.id, slug: saved.slug }))
      setNotice(form.id ? 'Article enregistré.' : 'Article créé.')
      await load()
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await withSudo(() => call(`/admin/articles/${form.id}`, { method: 'DELETE' }))
      setNotice('Article supprimé.')
      setForm(EMPTY)
      setConfirmDelete(false)
      await load()
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setSaving(false)
    }
  }

  if (allowed === null) return <div className="admin-loading">Chargement…</div>

  if (allowed === 'mfa') {
    return (
      <div className="admin-page">
        <h1>Articles</h1>
        <p className="admin-articles-warn">
          Cette page exige une double authentification active sur votre compte. Activez-la
          depuis l’onglet <strong>Sécurité</strong>, puis revenez ici.
        </p>
      </div>
    )
  }

  if (allowed === false) {
    return (
      <div className="admin-page">
        <h1>Articles</h1>
        <p className="admin-articles-warn">Accès réservé aux super administrateurs.</p>
      </div>
    )
  }

  return (
    <div className="admin-page admin-articles">
      <header className="admin-articles-head">
        <div>
          <h1>Articles</h1>
          <p>
            Rubrique « Articles &amp; conseils » de l’application. Les articles publiés sont
            servis à toutes les formules, compte gratuit compris.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="admin-articles-btn primary" onClick={startNew}>
            Nouvel article
          </button>
        )}
      </header>

      {!canWrite && (
        <p className="admin-articles-notice readonly">
          Profil {profileLabel ?? 'de consultation'} : vous pouvez lire les articles et
          leur aperçu, mais pas les modifier.
        </p>
      )}

      {error && <p className="admin-articles-error">{error}</p>}
      {notice && <p className="admin-articles-notice">{notice}</p>}

      <div className="admin-articles-layout">
        <aside className="admin-articles-list">
          {articles.length === 0 ? (
            <p className="admin-articles-empty">Aucun article.</p>
          ) : (
            <ul>
              {articles.map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    className={`admin-articles-item${form.id === article.id ? ' active' : ''}`}
                    onClick={() => select(article)}
                  >
                    <span className="admin-articles-item-title">{article.title}</span>
                    <span className="admin-articles-item-meta">
                      {article.category}
                      <span
                        className={`admin-articles-badge${article.published ? ' on' : ''}`}
                      >
                        {article.published ? 'Publié' : 'Brouillon'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* `fieldset disabled` : un seul attribut neutralise toute la saisie, y
            compris les champs ajoutés plus tard — plus sûr qu'un `readOnly`
            répété sur chaque input, qu'on oublierait. */}
        <form className="admin-articles-form" onSubmit={save}>
        <fieldset disabled={!canWrite} className="admin-articles-fieldset">
          <div className="admin-articles-row">
            <label>
              <span>Titre</span>
              <input type="text" value={form.title} onChange={set('title')} required maxLength={200} />
            </label>
            <label>
              <span>Catégorie</span>
              <input
                type="text"
                value={form.category}
                onChange={set('category')}
                placeholder="Facturation électronique"
                required
                maxLength={80}
              />
            </label>
          </div>

          <div className="admin-articles-row">
            <label>
              <span>Identifiant d’URL</span>
              <input
                type="text"
                value={form.slug}
                onChange={set('slug')}
                placeholder="dérivé du titre si laissé vide"
                maxLength={120}
              />
              <small>
                /articles/{form.slug || '…'} — le changer casse les liens déjà partagés.
              </small>
            </label>
            <label className="admin-articles-narrow">
              <span>Ordre</span>
              <input type="number" value={form.position} onChange={set('position')} />
            </label>
          </div>

          <label>
            <span>Résumé</span>
            <textarea
              value={form.summary}
              onChange={set('summary')}
              rows={2}
              maxLength={500}
              required
            />
            <small>Affiché sur les cartes de la liste et de l’accueil. {form.summary.length}/500</small>
          </label>

          {/* Le libellé est associé par `htmlFor` et non par imbrication : un
              <label> qui envelopperait aussi le bouton et le sélecteur de
              fichier désignerait le PREMIER contrôle qu'il contient, pas la
              zone de saisie. */}
          <div className="admin-articles-bodyfield">
            <div className="admin-articles-bodyhead">
              <label htmlFor="article-body">
                <span>Contenu</span>
              </label>
              <button
                type="button"
                className="admin-articles-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Envoi…' : 'Insérer une image'}
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_TYPES}
              onChange={pickImage}
              hidden
            />

            <textarea
              id="article-body"
              ref={bodyRef}
              className="admin-articles-body"
              value={form.body}
              onChange={set('body')}
              onPaste={handlePaste}
              onDrop={handleDrop}
              rows={20}
              required
              spellCheck
            />
            <small>
              Une image peut aussi être collée ou déposée directement dans le champ. Elle
              s’insère à la position du curseur — PNG, JPEG, GIF, WebP ou AVIF, 5 Mo maximum.
            </small>
          </div>

          <details className="admin-articles-help">
            <summary>Syntaxe acceptée</summary>
            <dl>
              {SYNTAX_HELP.map(([syntax, meaning]) => (
                <div key={syntax}>
                  <dt>{syntax}</dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
            <p>
              Le HTML n’est pas interprété : une balise saisie ici s’affichera comme du
              texte. Pas de titre de niveau 1 — le titre de l’article en tient lieu.
            </p>
            <p>
              Les clés de fonctionnalité sont celles du <strong>Catalogue</strong>{' '}
              (app.menu.pa, app.menu.ventes…). L’aperçu affiche les deux branches d’un bloc
              conditionnel ; le lecteur n’en verra qu’une. Un bloc non refermé par «&nbsp;:::&nbsp;»
              reste affiché tel quel, sans rien masquer.
            </p>
          </details>

          <label className="admin-articles-check">
            <input type="checkbox" checked={form.published} onChange={set('published')} />
            Publié
            <small>Un brouillon n’est visible que sur cette page ; son URL répond 404.</small>
          </label>

          <div className="admin-articles-actions">
            {form.id &&
              (confirmDelete ? (
                <button
                  type="button"
                  className="admin-articles-btn danger"
                  onClick={remove}
                  disabled={saving}
                >
                  Confirmer la suppression
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-articles-btn"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  Supprimer
                </button>
              ))}
            <span className="admin-articles-spacer" />
            <button type="submit" className="admin-articles-btn primary" disabled={saving}>
              {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </fieldset>
        </form>

        <section className="admin-articles-preview">
          <h2>Aperçu</h2>
          <div className="article">
            <header className="article-header">
              <span className="articles-card-cat">{form.category || 'Catégorie'}</span>
              <h1>{form.title || 'Titre de l’article'}</h1>
            </header>
            {/* Le rendu produit de vrais <Link> react-router, qui navigueraient
                dans le back-office et emporteraient la saisie en cours. On
                neutralise le clic en phase de CAPTURE : <Link> n'exécute son
                propre gestionnaire que si l'événement n'a pas déjà été annulé,
                et la capture passe avant le bouillonnement.

                ⚠️ Ne PAS remettre un <MemoryRouter> ici. C'est ce qu'il y avait,
                et react-router v7 refuse un routeur imbriqué dans un autre :
                « You cannot render a <Router> inside another <Router> ». L'onglet
                Articles tombait donc en entier dans la frontière d'erreur, sans
                autre trace pour le rédacteur qu'un écran de repli générique.

                Le routeur de l'application fournit déjà le contexte dont les
                <Link> ont besoin — il n'en manquait aucun, il y en avait un de
                trop. */}
            <div
              className="article-body"
              onClickCapture={(event) => {
                const anchor = event.target.closest?.('a')
                // Les liens externes gardent leur nouvel onglet : le
                // MemoryRouter ne les isolait pas non plus, et vérifier qu'une
                // URL citée fonctionne fait partie de la relecture.
                if (anchor && anchor.target !== '_blank') event.preventDefault()
              }}
            >
              {/* `preview` : les blocs conditionnels montrent LEURS DEUX
                  branches, étiquetées. Résoudre les conditions sur les droits
                  du super admin cacherait au rédacteur la moitié de ce qu'il
                  publie. */}
              <ArticleMarkdown body={form.body} preview />
            </div>
          </div>
        </section>
      </div>

      {sudoPrompt}
    </div>
  )
}

export default AdminArticlesPage
