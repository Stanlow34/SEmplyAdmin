import React, { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../../lib/apiBase.js'
import { useSudo } from '../../hooks/useSudo.jsx'
import { useAdminAccess } from '../../hooks/useAdminAccess.js'
import './AdminProceduresPage.css'

/**
 * Back-office › Procédures de déclaration.
 *
 * Ce sont les trois boutons mis en avant dans la popup de l'extension. Deux
 * choses distinguent cet écran de la rédaction d'articles :
 *
 *  - il y en a TROIS, et c'est le sujet. L'aperçu reproduit la rangée telle
 *    qu'elle s'affiche dans une popup de 380 px, parce que le seul défaut qu'on
 *    ne voit pas en lisant un formulaire, c'est un libellé qui déborde ;
 *  - la destination est éditoriale : site officiel (impots.gouv.fr) ou écran de
 *    préparation de SEmply. Le formulaire propose les deux, sans trancher.
 *
 * Comme les articles, les mutations passent par `withSudo` : l'API exige une
 * ré-authentification de moins de 15 minutes pour écrire.
 */

const EMPTY = {
  id: null,
  slug: '',
  label: '',
  description: '',
  url: '',
  icon: '',
  position: 100,
  active: true,
}

/**
 * Destinations proposées en un clic. Ce ne sont que des raccourcis de saisie :
 * le champ reste libre, et rien n'oblige une procédure à figurer ici.
 */
const SUGGESTIONS = [
  { label: 'URSSAF — indépendants', url: 'https://www.urssaf.fr/accueil/independant.html' },
  { label: 'TVA — impots.gouv.fr', url: 'https://www.impots.gouv.fr/professionnel/tva' },
  { label: 'Espace professionnel', url: 'https://www.impots.gouv.fr/professionnel' },
  { label: 'SEmply — TVA', url: '/impots/tva', app: true },
  { label: 'SEmply — URSSAF', url: '/remuneration/urssaf', app: true },
  { label: 'SEmply — Impôts', url: '/remuneration/impots', app: true },
]

/** Base de l'application, pour les destinations internes. Le champ stocke une
 *  URL absolue : l'extension n'a pas de contexte de navigation, un chemin
 *  relatif n'y voudrait rien dire. */
const APP_ORIGIN = window.location.origin

export function AdminProceduresPage() {
  const [allowed, setAllowed] = useState(null) // null = vérification en cours
  const [procedures, setProcedures] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [stats, setStats] = useState(null)
  const [statsDays, setStatsDays] = useState(30)

  const { run: withSudo, prompt: sudoPrompt } = useSudo()
  const { can, profileLabel } = useAdminAccess()
  const canWrite = can('write')

  const call = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: options.body
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
    setProcedures(await call('/admin/procedures'))
  }, [call])

  /**
   * Les statistiques sont chargées à PART de la liste, et leur échec est avalé.
   * Un incident sur la mesure ne doit pas empêcher de corriger l'URL d'un
   * bouton — c'est justement le jour où l'on en a le plus besoin.
   */
  const loadStats = useCallback(async () => {
    try {
      setStats(await call(`/admin/procedures/stats?days=${statsDays}`))
    } catch {
      setStats(null)
    }
  }, [call, statsDays])

  useEffect(() => {
    ;(async () => {
      try {
        await load()
        setAllowed(true)
      } catch (e) {
        // Super admin sans double authentification : le guard répond
        // MFA_REQUIRED. On l'oriente vers l'activation plutôt que d'afficher un
        // refus (même traitement que les articles).
        if (e?.code === 'MFA_REQUIRED') {
          setAllowed('mfa')
          return
        }
        setAllowed(false)
      }
    })()
  }, [load])

  useEffect(() => {
    if (allowed === true) void loadStats()
  }, [allowed, loadStats])

  const select = (procedure) => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    setForm({
      id: procedure.id,
      slug: procedure.slug,
      label: procedure.label,
      description: procedure.description ?? '',
      url: procedure.url,
      icon: procedure.icon ?? '',
      position: procedure.position,
      active: procedure.active,
    })
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

  const applySuggestion = (suggestion) => {
    setForm((f) => ({
      ...f,
      url: suggestion.app ? `${APP_ORIGIN}${suggestion.url}` : suggestion.url,
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      // Slug vide à la création = dérivé du libellé par le serveur. À la
      // modification on l'envoie tel quel : c'est la clé de repli hors ligne de
      // l'extension, la réécrire à l'insu du rédacteur serait un piège.
      slug: form.slug.trim() || undefined,
      label: form.label.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      icon: form.icon.trim(),
      position: Number(form.position) || 100,
      active: form.active,
    }

    try {
      const saved = await withSudo(() =>
        form.id
          ? call(`/admin/procedures/${form.id}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            })
          : call('/admin/procedures', { method: 'POST', body: JSON.stringify(payload) }),
      )
      setForm((f) => ({ ...f, id: saved.id, slug: saved.slug, url: saved.url }))
      setNotice(form.id ? 'Procédure enregistrée.' : 'Procédure créée.')
      await load()
      await loadStats()
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
      await withSudo(() => call(`/admin/procedures/${form.id}`, { method: 'DELETE' }))
      setNotice('Procédure supprimée.')
      setForm(EMPTY)
      setConfirmDelete(false)
      await load()
      await loadStats()
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
        <h1>Procédures</h1>
        <p className="admin-proc-warn">
          Cette page exige une double authentification active sur votre compte. Activez-la
          depuis l’onglet <strong>Sécurité</strong>, puis revenez ici.
        </p>
      </div>
    )
  }

  if (allowed === false) {
    return (
      <div className="admin-page">
        <h1>Procédures</h1>
        <p className="admin-proc-warn">Accès réservé aux super administrateurs.</p>
      </div>
    )
  }

  const active = procedures.filter((procedure) => procedure.active)
  // Échelle des barres : le clic le plus élevé fait 100 %. Une échelle absolue
  // rendrait les trois barres invisibles au démarrage, quand tout est à zéro ou
  // presque.
  const maxClicks = stats?.procedures?.reduce((m, p) => Math.max(m, p.clicks), 0) ?? 0

  return (
    <div className="admin-page admin-proc">
      <header className="admin-proc-head">
        <div>
          <h1>Procédures de déclaration</h1>
          <p>
            Les boutons mis en avant dans l’extension navigateur, au-dessus de l’annuaire.
            Une destination corrigée ici s’applique sans repasser par la revue du Chrome
            Web&nbsp;Store, et sans mise à jour chez l’utilisateur.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="admin-proc-btn primary" onClick={startNew}>
            Nouvelle procédure
          </button>
        )}
      </header>

      {!canWrite && (
        <p className="admin-proc-notice readonly">
          Profil {profileLabel ?? 'de consultation'} : vous pouvez lire les procédures, mais
          pas les modifier.
        </p>
      )}

      {active.length > 3 && (
        <p className="admin-proc-notice">
          {active.length} procédures actives : la rangée passe sur plusieurs lignes dans la
          popup. Trois est la limite confortable.
        </p>
      )}

      {error && <p className="admin-proc-error">{error}</p>}
      {notice && <p className="admin-proc-notice">{notice}</p>}

      <div className="admin-proc-layout">
        <aside className="admin-proc-list">
          {procedures.length === 0 ? (
            <p className="admin-proc-empty">
              Aucune procédure. <code>npm run import:procedures</code> amorce les trois
              habituelles.
            </p>
          ) : (
            <ul>
              {procedures.map((procedure) => (
                <li key={procedure.id}>
                  <button
                    type="button"
                    className={`admin-proc-item${form.id === procedure.id ? ' active' : ''}`}
                    onClick={() => select(procedure)}
                  >
                    <span className="admin-proc-item-label">{procedure.label}</span>
                    <span className="admin-proc-item-meta">
                      <span className="admin-proc-item-host">{hostOf(procedure.url)}</span>
                      {!procedure.active && (
                        <span className="admin-proc-badge">masquée</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* `fieldset disabled` : un seul attribut neutralise toute la saisie, y
            compris les champs ajoutés plus tard. */}
        <form className="admin-proc-form" onSubmit={save}>
          <fieldset disabled={!canWrite} className="admin-proc-fieldset">
            <div className="admin-proc-row">
              <label>
                <span>Libellé du bouton</span>
                <input
                  type="text"
                  value={form.label}
                  onChange={set('label')}
                  placeholder="Déclarer TVA"
                  required
                  maxLength={60}
                />
                <small>
                  {form.label.length}/60 — au-delà d’une vingtaine de caractères, le
                  libellé passe sur deux lignes dans la popup.
                </small>
              </label>
              <label className="admin-proc-narrow">
                <span>Ordre</span>
                <input type="number" value={form.position} onChange={set('position')} />
              </label>
            </div>

            <label>
              <span>Destination</span>
              <input
                type="text"
                value={form.url}
                onChange={set('url')}
                placeholder="https://www.impots.gouv.fr/professionnel/tva"
                required
                maxLength={1000}
              />
              <small>
                Site officiel ou écran de SEmply, au choix. Seuls <code>http</code> et{' '}
                <code>https</code> sont acceptés ; une adresse saisie sans schéma est
                préfixée en <code>https://</code>.
              </small>
            </label>

            <div className="admin-proc-suggest">
              <span>Destinations courantes :</span>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.url}
                  type="button"
                  className={`admin-proc-chip${suggestion.app ? ' app' : ''}`}
                  onClick={() => applySuggestion(suggestion)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>

            <label>
              <span>Précision</span>
              <textarea
                value={form.description}
                onChange={set('description')}
                rows={2}
                maxLength={300}
                placeholder="Déclaration et paiement des cotisations sociales."
              />
              <small>
                Facultative. Affichée sous le libellé — inutile de paraphraser un bouton
                déjà clair. {form.description.length}/300
              </small>
            </label>

            <div className="admin-proc-row">
              <label>
                <span>Identifiant</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={set('slug')}
                  placeholder="dérivé du libellé si laissé vide"
                  maxLength={80}
                />
                <small>
                  Clé de repli hors ligne de l’extension. La changer fait perdre le repli
                  aux versions déjà installées.
                </small>
              </label>
              <label>
                <span>Icône</span>
                <input
                  type="text"
                  value={form.icon}
                  onChange={set('icon')}
                  placeholder="Calculator"
                  maxLength={50}
                />
                <small>
                  Nom lucide-react (<code>Calculator</code>, <code>Landmark</code>,{' '}
                  <code>HeartPulse</code>). Vide = pas d’icône.
                </small>
              </label>
            </div>

            <label className="admin-proc-check">
              <input type="checkbox" checked={form.active} onChange={set('active')} />
              Active
              <small>
                Décochée, la procédure disparaît de la popup sans être supprimée — de quoi
                retirer un bouton le temps qu’un portail rouvre.
              </small>
            </label>

            <div className="admin-proc-actions">
              {form.id &&
                (confirmDelete ? (
                  <button
                    type="button"
                    className="admin-proc-btn danger"
                    onClick={remove}
                    disabled={saving}
                  >
                    Confirmer la suppression
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-proc-btn"
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving}
                  >
                    Supprimer
                  </button>
                ))}
              <span className="admin-proc-spacer" />
              <button type="submit" className="admin-proc-btn primary" disabled={saving}>
                {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </fieldset>
        </form>

        <section className="admin-proc-preview">
          <h2>Clics</h2>
          <div className="admin-proc-windows" role="group" aria-label="Fenêtre d’observation">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                className={`admin-proc-chip${statsDays === days ? ' on' : ''}`}
                aria-pressed={statsDays === days}
                onClick={() => setStatsDays(days)}
              >
                {days} jours
              </button>
            ))}
          </div>

          {!stats ? (
            <p className="admin-proc-preview-hint">Mesure indisponible.</p>
          ) : stats.totals.clicks === 0 ? (
            <p className="admin-proc-preview-hint">
              Aucun clic sur la période. Les clics du jour sont comptés en direct, ceux des
              jours précédents sont agrégés chaque nuit à 3h20.
            </p>
          ) : (
            <>
              <ul className="admin-proc-stats">
                {stats.procedures.map((procedure) => (
                  <li key={procedure.id}>
                    <span className="admin-proc-stat-label">
                      {procedure.label}
                      {!procedure.active && (
                        <span className="admin-proc-badge">masquée</span>
                      )}
                    </span>
                    {/* Une seule série : la LONGUEUR porte la valeur, jamais la
                        teinte. Le nombre reste lisible sans survol. */}
                    <span className="admin-proc-bar" aria-hidden="true">
                      <span
                        className="admin-proc-bar-fill"
                        style={{
                          width: `${maxClicks ? (procedure.clicks / maxClicks) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span className="admin-proc-stat-value">{procedure.clicks}</span>
                  </li>
                ))}
              </ul>

              <p className="admin-proc-sources">
                {stats.totals.clicks} clic{stats.totals.clicks > 1 ? 's' : ''} au total —
                site {stats.totals.bySource.SITE}, extension{' '}
                {stats.totals.bySource.EXTENSION}, application {stats.totals.bySource.APP}.
              </p>
            </>
          )}

          <h2 className="admin-proc-preview-second">Aperçu</h2>
          <p className="admin-proc-preview-hint">
            La zone « procédures » de la popup, à sa largeur réelle.
          </p>
          {/* Largeur figée à 380 px : l'aperçu ne sert à rien s'il s'étire.
              C'est la contrainte qu'on vient vérifier. */}
          <div className="admin-proc-popup">
            <h3 className="admin-proc-popup-title">Procédures</h3>
            <div className="admin-proc-popup-grid">
              {(active.length > 0 ? active : [form]).map((procedure, index) => (
                <span
                  key={procedure.id ?? `draft-${index}`}
                  className={`admin-proc-popup-btn${
                    form.id && procedure.id === form.id ? ' current' : ''
                  }`}
                >
                  <span className="admin-proc-popup-label">
                    {(form.id === procedure.id ? form.label : procedure.label) || 'Libellé'}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      {sudoPrompt}
    </div>
  )
}

/** Domaine de la destination, pour distinguer d'un coup d'œil un lien officiel
 *  d'un écran de l'application. Une URL illisible est affichée telle quelle
 *  plutôt que masquée : c'est le signe qu'il y a quelque chose à corriger. */
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default AdminProceduresPage
