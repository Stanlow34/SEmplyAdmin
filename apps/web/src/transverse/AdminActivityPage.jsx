import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, apiErrorMessage, errorMessage } from '@semplyadmin/http'
import { useAdminAccess } from '../hooks/useAdminAccess.js'
import './AdminActivityPage.css'

/**
 * Back-office › Journal d'activité de la plateforme.
 *
 * Ce que cet écran doit permettre, et qui a dicté sa forme :
 *
 *  1. **Répondre à « qui a fait ça ? »** — donc un tableau chronologique dense,
 *     pas des graphiques. On cherche une ligne précise, on ne contemple pas une
 *     tendance.
 *  2. **Partir d'un soupçon** — d'où les filtres rapides en haut (échecs,
 *     actions du support, actions d'un super admin) : ce sont les trois entrées
 *     réelles dans un journal, avant même de savoir quoi chercher.
 *  3. **Descendre jusqu'à la valeur modifiée** — une ligne s'ouvre sur son
 *     avant/après. Ces JSON ne sont chargés qu'à ce moment-là : les embarquer
 *     dans la liste ferait des mégaoctets par page.
 *  4. **Recomposer une action complète** — une requête HTTP produit une ligne
 *     « requête » et N lignes « base ». Le lien « voir la requête entière » les
 *     rassemble par identifiant de corrélation.
 *
 * Lecture seule, comme le journal lui-même : aucune action n'y modifie quoi que
 * ce soit. L'export CSV est la seule opération soumise à une capacité (`export`),
 * parce qu'emporter des données n'est pas les consulter.
 */

const PAGE_SIZE = 50

/** Fenêtres proposées. `null` = sans borne basse (tout l'historique conservé). */
const PERIODS = [
  { key: '24h', label: '24 heures', hours: 24 },
  { key: '7j', label: '7 jours', hours: 24 * 7 },
  { key: '30j', label: '30 jours', hours: 24 * 30 },
  { key: 'tout', label: 'Tout', hours: null },
]

/** Ordre fixe : la couleur suit la catégorie, jamais son rang dans les résultats. */
const CATEGORIES = [
  { key: 'data', label: 'Données' },
  { key: 'read', label: 'Consultations' },
  { key: 'auth', label: 'Authentification' },
  { key: 'admin', label: 'Back-office' },
  { key: 'support', label: 'Support' },
  { key: 'system', label: 'Système' },
]

const SOURCES = [
  { key: 'HTTP', label: 'Requête' },
  { key: 'DB', label: 'Base' },
  { key: 'AUTH', label: 'Auth' },
  { key: 'SYSTEM', label: 'Système' },
]

const SCOPES = [
  { key: '', label: 'Tout le monde' },
  { key: 'superadmin', label: 'Super admins' },
  { key: 'support', label: 'Sessions support' },
]

const STATUSES = [
  { key: '', label: 'Tous' },
  { key: 'failed', label: 'Refusés / échoués' },
  { key: 'ok', label: 'Aboutis' },
]

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'medium',
})
const NUM_FMT = new Intl.NumberFormat('fr-FR')

const EMPTY_FILTERS = {
  period: '24h',
  q: '',
  categories: [],
  sources: [],
  scope: '',
  status: '',
  entity: '',
  action: '',
}

function periodStart(key) {
  const period = PERIODS.find((entry) => entry.key === key)
  if (!period?.hours) return null
  return new Date(Date.now() - period.hours * 3600_000).toISOString()
}

function buildQuery(filters, { page, withTotal } = {}) {
  const params = new URLSearchParams()
  const from = periodStart(filters.period)
  if (from) params.set('from', from)
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.categories.length) params.set('category', filters.categories.join(','))
  if (filters.sources.length) params.set('source', filters.sources.join(','))
  if (filters.scope) params.set('scope', filters.scope)
  if (filters.status) params.set('status', filters.status)
  if (filters.entity) params.set('entity', filters.entity)
  if (filters.action) params.set('action', filters.action)
  if (page) params.set('page', String(page))
  params.set('pageSize', String(PAGE_SIZE))
  if (withTotal) params.set('withTotal', '1')
  return params
}

export function AdminActivityPage() {
  const { can, loading: accessLoading } = useAdminAccess()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(null)
  const [facets, setFacets] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [correlated, setCorrelated] = useState(null)

  // Une signature stable des filtres : sert de dépendance d'effet sans relancer
  // la requête à chaque frappe dans le champ de recherche (cf. le formulaire,
  // qui ne valide qu'à la soumission).
  const signature = useMemo(() => JSON.stringify(filters), [filters])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = buildQuery(filters, { page, withTotal: page === 1 })
      const res = await apiFetch(`/admin/activity?${params.toString()}`)
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Lecture du journal refusée.'))
      const data = await res.json()
      setRows(data.items ?? [])
      // Le total n'est calculé qu'en page 1 : on conserve celui du jeu de
      // filtres courant pendant la pagination.
      if (data.total !== null && data.total !== undefined) setTotal(data.total)
    } catch (err) {
      setError(errorMessage(err))
      setRows([])
    } finally {
      setLoading(false)
    }
    // `signature` remplace `filters` : même contenu, référence stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    apiFetch('/admin/activity/facets?days=30')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setFacets(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const update = (patch) => {
    setPage(1)
    setSelected(null)
    setFilters((current) => ({ ...current, ...patch }))
  }

  const toggle = (key, value) =>
    update({
      [key]: filters[key].includes(value)
        ? filters[key].filter((entry) => entry !== value)
        : [...filters[key], value],
    })

  const openRow = async (row) => {
    if (selected?.id === row.id) {
      setSelected(null)
      return
    }
    // La ligne de la liste est affichée immédiatement ; l'avant/après arrive
    // ensuite, sans faire clignoter le panneau.
    setSelected({ ...row, _loading: true })
    setCorrelated(null)
    try {
      const res = await apiFetch(`/admin/activity/${row.id}`)
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Détail indisponible.'))
      setSelected({ ...(await res.json()), _loading: false })
    } catch (err) {
      setSelected({ ...row, _loading: false, _error: errorMessage(err) })
    }
  }

  const loadCorrelated = async (requestId) => {
    setCorrelated({ loading: true, items: [] })
    try {
      const res = await apiFetch(`/admin/activity/request/${requestId}`)
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Corrélation indisponible.'))
      setCorrelated({ loading: false, items: await res.json() })
    } catch (err) {
      setCorrelated({ loading: false, items: [], error: errorMessage(err) })
    }
  }

  const exportCsv = async () => {
    const params = buildQuery(filters)
    params.delete('page')
    params.delete('pageSize')
    try {
      const res = await apiFetch(`/admin/activity/export?${params.toString()}`)
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Export refusé.'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `journal-activite-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const hasFilters = signature !== JSON.stringify(EMPTY_FILTERS)

  return (
    <div className="admin-activity">
      <header className="aac-head">
        <h1>Journal d'activité</h1>
        <p>
          Toutes les actions des utilisateurs de la plateforme : requêtes, écritures en base,
          connexions. Consultable ici uniquement, jamais depuis l'application cliente, et conservé{' '}
          {facets?.retentionMonths ?? 13} mois avant purge automatique.
        </p>
      </header>

      {facets && (
        <div className="aac-tiles">
          <div className="aac-tile">
            <span className="aac-tile-value">{NUM_FMT.format(facets.last24h)}</span>
            <span className="aac-tile-label">actions sur 24 h</span>
          </div>
          <div className={`aac-tile ${facets.failuresLast24h > 0 ? 'is-alert' : ''}`}>
            <span className="aac-tile-value">{NUM_FMT.format(facets.failuresLast24h)}</span>
            <span className="aac-tile-label">refus ou échecs sur 24 h</span>
          </div>
          <div className="aac-tile">
            <span className="aac-tile-value">{NUM_FMT.format(facets.pendingWrites)}</span>
            <span className="aac-tile-label">en attente d'écriture</span>
          </div>
        </div>
      )}

      <form
        className="aac-filters"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          void load()
        }}
      >
        <div className="aac-filter-row">
          {PERIODS.map((period) => (
            <button
              key={period.key}
              type="button"
              className={`aac-chip ${filters.period === period.key ? 'is-active' : ''}`}
              onClick={() => update({ period: period.key })}
            >
              {period.label}
            </button>
          ))}

          <input
            type="search"
            className="aac-search"
            placeholder="Adresse e-mail, route, identifiant…"
            value={filters.q}
            onChange={(event) => setFilters((c) => ({ ...c, q: event.target.value }))}
          />
          <button type="submit" className="aac-btn">
            Rechercher
          </button>
          {can('export') && (
            <button type="button" className="aac-btn aac-btn-ghost" onClick={exportCsv}>
              Exporter en CSV
            </button>
          )}
        </div>

        <div className="aac-filter-row">
          {CATEGORIES.map((category) => (
            <button
              key={category.key}
              type="button"
              className={`aac-chip aac-chip-${category.key} ${
                filters.categories.includes(category.key) ? 'is-active' : ''
              }`}
              onClick={() => toggle('categories', category.key)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="aac-filter-row">
          {SOURCES.map((source) => (
            <button
              key={source.key}
              type="button"
              className={`aac-chip ${filters.sources.includes(source.key) ? 'is-active' : ''}`}
              onClick={() => toggle('sources', source.key)}
            >
              {source.label}
            </button>
          ))}

          <select
            className="aac-select"
            value={filters.scope}
            onChange={(event) => update({ scope: event.target.value })}
          >
            {SCOPES.map((scope) => (
              <option key={scope.key} value={scope.key}>
                {scope.label}
              </option>
            ))}
          </select>

          <select
            className="aac-select"
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
          >
            {STATUSES.map((status) => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            className="aac-select"
            value={filters.entity}
            onChange={(event) => update({ entity: event.target.value })}
          >
            <option value="">Toutes les tables</option>
            {(facets?.entities ?? []).map((entity) => (
              <option key={entity.value} value={entity.value}>
                {entity.value} ({NUM_FMT.format(entity.count)})
              </option>
            ))}
          </select>

          <select
            className="aac-select"
            value={filters.action}
            onChange={(event) => update({ action: event.target.value })}
          >
            <option value="">Toutes les actions</option>
            {(facets?.actions ?? []).map((action) => (
              <option key={action.value} value={action.value}>
                {action.value} ({NUM_FMT.format(action.count)})
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              className="aac-btn aac-btn-ghost"
              onClick={() => {
                setPage(1)
                setSelected(null)
                setFilters(EMPTY_FILTERS)
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </form>

      {error && <p className="aac-error">{error}</p>}

      <div className={`aac-table-wrap ${loading ? 'is-loading' : ''}`}>
        <table className="aac-table">
          <thead>
            <tr>
              <th>Quand</th>
              <th>Qui</th>
              <th>Action</th>
              <th>Cible</th>
              <th>Origine</th>
              <th>Résultat</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="aac-empty">
                  Aucune action ne correspond à ces filtres.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr
                  className={`aac-row ${selected?.id === row.id ? 'is-open' : ''} ${
                    row.success ? '' : 'is-failed'
                  }`}
                  onClick={() => openRow(row)}
                >
                  <td className="aac-when">{DATE_FMT.format(new Date(row.occurred_at))}</td>
                  <td className="aac-who">
                    <span>{row.user_email ?? <em>anonyme</em>}</span>
                    {row.user_is_superadmin && <span className="aac-tag aac-tag-sa">super admin</span>}
                    {row.support_access_id && <span className="aac-tag aac-tag-support">support</span>}
                    {row.company_id && <span className="aac-muted">société #{row.company_id}</span>}
                  </td>
                  <td>
                    <span className={`aac-badge aac-badge-${row.category}`}>{row.action}</span>
                    <span className="aac-label">{row.label}</span>
                  </td>
                  <td className="aac-target">
                    {row.entity ? (
                      <code>
                        {row.entity}
                        {row.entity_id ? ` #${row.entity_id}` : ''}
                      </code>
                    ) : (
                      <span className="aac-muted">—</span>
                    )}
                    {row.changed_fields?.length > 0 && (
                      <span className="aac-fields">{row.changed_fields.join(', ')}</span>
                    )}
                  </td>
                  <td className="aac-origin">
                    <span className="aac-muted">{row.source}</span>
                    {row.method && <code>{row.method}</code>}
                    <span className="aac-route">{row.route}</span>
                  </td>
                  <td className="aac-result">
                    {row.success ? (
                      <span className="aac-ok">{row.status_code ?? 'ok'}</span>
                    ) : (
                      <span className="aac-ko">{row.error_code ?? row.status_code ?? 'échec'}</span>
                    )}
                    {row.duration_ms != null && <span className="aac-muted">{row.duration_ms} ms</span>}
                  </td>
                </tr>

                {selected?.id === row.id && (
                  <tr className="aac-detail-row">
                    <td colSpan={6}>
                      <ActivityDetail
                        entry={selected}
                        correlated={correlated}
                        onCorrelate={loadCorrelated}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="aac-pager">
        <button
          type="button"
          className="aac-btn aac-btn-ghost"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Précédent
        </button>
        <span className="aac-muted">
          Page {page}
          {total != null && ` — ${NUM_FMT.format(total)} action${total > 1 ? 's' : ''}`}
        </span>
        <button
          type="button"
          className="aac-btn aac-btn-ghost"
          disabled={rows.length < PAGE_SIZE || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Suivant
        </button>
      </div>

      {accessLoading === false && !can('export') && (
        <p className="aac-note">
          L'export CSV n'est pas ouvert à votre profil : consulter le journal et en sortir une copie
          sont deux droits distincts.
        </p>
      )}
    </div>
  )
}

/** Panneau dépliant : contexte technique, avant/après, corrélation. */
function ActivityDetail({ entry, correlated, onCorrelate }) {
  if (entry._error) return <p className="aac-error">{entry._error}</p>

  return (
    <div className="aac-detail">
      <dl className="aac-meta">
        <div>
          <dt>Identifiant</dt>
          <dd>
            <code>{entry.id}</code>
          </dd>
        </div>
        <div>
          <dt>Adresse IP</dt>
          <dd>{entry.ip ?? '—'}</dd>
        </div>
        <div>
          <dt>Navigateur</dt>
          <dd className="aac-ua">{entry.user_agent ?? '—'}</dd>
        </div>
        <div>
          <dt>Requête</dt>
          <dd>
            {entry.request_id ? (
              <button type="button" className="aac-link" onClick={() => onCorrelate(entry.request_id)}>
                voir la requête entière
              </button>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>

      {entry.error_message && <p className="aac-error">{entry.error_message}</p>}

      {entry._loading ? (
        <p className="aac-muted">Chargement des valeurs…</p>
      ) : (
        <div className="aac-diff">
          <JsonBlock title="Avant" value={entry.before} />
          <JsonBlock title="Après" value={entry.after} />
          <JsonBlock title="Contexte" value={entry.meta} />
        </div>
      )}

      {correlated && (
        <div className="aac-correlated">
          <h4>Traces de la même requête</h4>
          {correlated.loading && <p className="aac-muted">Chargement…</p>}
          {correlated.error && <p className="aac-error">{correlated.error}</p>}
          <ul>
            {correlated.items.map((item) => (
              <li key={item.id}>
                <span className={`aac-badge aac-badge-${item.category}`}>{item.action}</span>
                <span>{item.label}</span>
                <span className="aac-muted">{item.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function JsonBlock({ title, value }) {
  if (value === null || value === undefined) return null
  return (
    <section>
      <h4>{title}</h4>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  )
}
