import React, { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../../lib/apiBase.js'
import './AdminLinksPage.css'

/**
 * Back-office › Annuaire de liens : ce sur quoi les gens cliquent.
 *
 * Cet écran n'est pas de la télémétrie d'usage, c'est l'étude de marché qui
 * décide des modules à prioriser (cf. l'en-tête du modèle Link) : d'où le choix
 * de montrer trois choses que les seuls totaux ne disent pas —
 *   - la ventilation par SOURCE (site vitrine / extension / application), pour
 *     comparer les ordres de grandeur entre nos surfaces ;
 *   - les liens JAMAIS cliqués, aussi instructifs que les liens populaires ;
 *   - la fenêtre d'observation, ajustable.
 *
 * Lecture seule : aucune mutation, donc pas d'élévation « sudo » à demander.
 *
 * Formes retenues (et pourquoi) :
 *   - trois nombres de tête → tuiles, pas un graphique à trois barres ;
 *   - part-à-tout sur 3 sources → une barre empilée horizontale, avec les
 *     valeurs dans la légende (l'aqua passe sous 3:1 sur fond blanc : les
 *     étiquettes visibles sont la contrepartie obligatoire) ;
 *   - 47 liens porteurs de sens → un TABLEAU avec barre de magnitude en ligne,
 *     pas un nuage de couleurs. Il tient aussi de vue de repli : toutes les
 *     valeurs y sont lisibles sans survol.
 */

/** Fenêtres proposées. Au-delà de 90 jours, seuls les agrégats subsistent. */
const WINDOWS = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
]

/** Ordre FIXE des sources : la couleur suit la source, jamais son rang. */
const SOURCES = [
  { key: 'SITE', label: 'Site vitrine' },
  { key: 'EXTENSION', label: 'Extension' },
  { key: 'APP', label: 'Application' },
]

const nf = new Intl.NumberFormat('fr-FR')

export function AdminLinksPage() {
  const [allowed, setAllowed] = useState(null) // null = vérification en cours
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState(null)
  // Rechargement d'une autre fenêtre : on garde le rendu précédent en retrait
  // plutôt que de le remplacer par un squelette, qui ferait sauter la page.
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (window) => {
    const res = await fetch(`${API_BASE}/admin/links/stats?days=${window}`, {
      headers: {},
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const err = new Error(body?.message ?? `HTTP ${res.status}`)
      err.code = body?.error
      throw err
    }
    return res.json()
  }, [])

  useEffect(() => {
    let cancelled = false
    setRefreshing(true)

    load(days)
      .then((data) => {
        if (cancelled) return
        setStats(data)
        setAllowed(true)
        setError('')
      })
      .catch((e) => {
        if (cancelled) return
        // Super admin sans double authentification : on l'oriente vers
        // l'activation plutôt que d'afficher un refus sec.
        if (e?.code === 'MFA_REQUIRED') setAllowed('mfa')
        else if (allowed === null) setAllowed(false)
        else setError(String(e.message ?? e))
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false)
      })

    return () => {
      cancelled = true
    }
    // `allowed` volontairement hors dépendances : il ne sert qu'à distinguer le
    // premier échec (refus d'accès) d'un échec de rechargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, load])

  if (allowed === null) return <div className="admin-loading">Chargement…</div>

  if (allowed === 'mfa') {
    return (
      <div className="admin-page">
        <h1>Annuaire de liens</h1>
        <p className="alk-warn">
          Cette page exige une double authentification active sur votre compte. Activez-la
          depuis l’onglet <strong>Sécurité</strong>, puis revenez ici.
        </p>
      </div>
    )
  }

  if (allowed === false) {
    return (
      <div className="admin-page">
        <h1>Annuaire de liens</h1>
        <p className="alk-warn">Accès réservé aux super administrateurs.</p>
      </div>
    )
  }

  const totals = stats?.totals ?? { clicks: 0, bySource: {}, linksClicked: 0, linksTotal: 0 }
  const perDay = stats ? totals.clicks / stats.days : 0
  const max = stats?.links?.[0]?.clicks ?? 0

  return (
    <div className="admin-page admin-links">
      <header className="alk-head">
        <h1>Annuaire de liens</h1>
        <p>
          Clics enregistrés sur les liens de la boîte à outils, par source. Aucune donnée
          personnelle n’est collectée : ni adresse IP, ni compte, ni navigateur.
        </p>
      </header>

      {/* Une seule ligne de filtre, au-dessus de tout ce qu'elle cadre. */}
      <div className="alk-filters" role="group" aria-label="Fenêtre d’observation">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            type="button"
            className={`alk-chip${days === w.days ? ' active' : ''}`}
            aria-pressed={days === w.days}
            onClick={() => setDays(w.days)}
          >
            {w.label}
          </button>
        ))}
        {stats && (
          <span className="alk-since">
            depuis le{' '}
            {new Date(stats.since).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      {error && <p className="alk-error">{error}</p>}

      <div className={`alk-body${refreshing ? ' refreshing' : ''}`}>
        <div className="alk-tiles">
          <Tile label="Clics sur la période" value={nf.format(totals.clicks)} />
          <Tile
            label="Liens cliqués"
            value={nf.format(totals.linksClicked)}
            hint={`sur ${nf.format(totals.linksTotal)} liens`}
          />
          <Tile
            label="Clics par jour"
            // Une décimale seulement quand elle dit quelque chose : « 0,0 »
            // affiché pour un compteur à zéro fait croire à un arrondi.
            value={perDay === 0 ? '0' : perDay >= 10 ? nf.format(Math.round(perDay)) : perDay.toFixed(1).replace('.', ',')}
            hint={`moyenne sur ${stats?.days ?? days} jours`}
          />
        </div>

        <section className="alk-card">
          <h2>Répartition par source</h2>
          {totals.clicks === 0 ? (
            <p className="alk-empty">
              Aucun clic sur la période. Les clics du jour sont comptés en direct, ceux des
              jours précédents sont agrégés chaque nuit à 3h15 ; le détail au-delà de 90
              jours est purgé, seuls les agrégats subsistent.
            </p>
          ) : (
            <>
              {/* Barre empilée : 2px de fond entre les segments font la
                  séparation, jamais un contour. */}
              <div
                className="alk-stack"
                role="img"
                aria-label={SOURCES.map(
                  (s) => `${s.label} ${nf.format(totals.bySource[s.key] ?? 0)} clics`,
                ).join(', ')}
              >
                {SOURCES.map((s) => {
                  const value = totals.bySource[s.key] ?? 0
                  if (!value) return null
                  return (
                    <span
                      key={s.key}
                      className={`alk-seg src-${s.key.toLowerCase()}`}
                      style={{ flexGrow: value }}
                    />
                  )
                })}
              </div>

              {/* Légende systématique dès deux séries, avec les valeurs : elles
                  ne dépendent donc d'aucun survol. */}
              <ul className="alk-legend">
                {SOURCES.map((s) => {
                  const value = totals.bySource[s.key] ?? 0
                  const share = totals.clicks ? Math.round((value / totals.clicks) * 100) : 0
                  return (
                    <li key={s.key}>
                      <span className={`alk-key src-${s.key.toLowerCase()}`} aria-hidden="true" />
                      <span className="alk-legend-label">{s.label}</span>
                      <span className="alk-legend-value">
                        {nf.format(value)} <span className="alk-muted">· {share}%</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>

        {stats?.links?.length > 0 && (
          <section className="alk-card">
            <h2>Classement des liens</h2>
            <div className="alk-table-wrap">
              <table className="alk-table">
                <thead>
                  <tr>
                    <th className="alk-num">#</th>
                    <th>Lien</th>
                    <th>Catégorie</th>
                    <th className="alk-num">Clics</th>
                    <th className="alk-num">Site</th>
                    <th className="alk-num">Extension</th>
                    <th className="alk-num">App</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.links.map((link, index) => (
                    <tr key={link.id}>
                      <td className="alk-num alk-muted">{index + 1}</td>
                      <td>
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          {link.label}
                        </a>
                        {!link.active && <span className="alk-badge">désactivé</span>}
                        {/* Barre de magnitude : une seule série, donc une seule
                            couleur — la longueur porte la valeur, pas la teinte. */}
                        <span className="alk-bar" aria-hidden="true">
                          <span
                            className="alk-bar-fill"
                            style={{ width: `${max ? (link.clicks / max) * 100 : 0}%` }}
                          />
                        </span>
                      </td>
                      <td className="alk-cat">{link.category}</td>
                      <td className="alk-num alk-strong">{nf.format(link.clicks)}</td>
                      <td className="alk-num">{nf.format(link.bySource.SITE)}</td>
                      <td className="alk-num">{nf.format(link.bySource.EXTENSION)}</td>
                      <td className="alk-num">{nf.format(link.bySource.APP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {stats?.neverClicked?.length > 0 && (
          <section className="alk-card">
            <h2>
              Sans aucun clic{' '}
              <span className="alk-muted">({nf.format(stats.neverClicked.length)})</span>
            </h2>
            <p className="alk-sub">
              Liens actifs que personne n’a ouverts sur la période. À reformuler, à
              déplacer dans une autre catégorie, ou à retirer.
            </p>
            <ul className="alk-quiet">
              {stats.neverClicked.map((link) => (
                <li key={link.id}>
                  {/* `title` : le libellé est tronqué par l'ellipse quand il est
                      long, il doit rester lisible en entier au survol. */}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.label}
                  >
                    {link.label}
                  </a>
                  <span className="alk-cat">{link.category}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

/** Tuile de statistique : libellé, valeur, précision facultative. Pas d'écart
 *  affiché — nous ne disposons pas de la période précédente, et un écart inventé
 *  serait pire que pas d'écart. */
function Tile({ label, value, hint }) {
  return (
    <div className="alk-tile">
      <span className="alk-tile-label">{label}</span>
      <span className="alk-tile-value">{value}</span>
      {hint && <span className="alk-tile-hint">{hint}</span>}
    </div>
  )
}

export default AdminLinksPage
