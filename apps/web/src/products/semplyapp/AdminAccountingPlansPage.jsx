import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../../lib/apiBase.js'
import { useSudo } from '../../hooks/useSudo.jsx'
import { useAdminAccess } from '../../hooks/useAdminAccess.js'
import './AdminAccountingPlansPage.css'

/**
 * Back-office › Modèles de plan comptable.
 *
 * Ce que ces modèles décident : à la création d'un dossier, le plan choisi est
 * COPIÉ dans les comptes de la société. Une erreur ici ne se voit donc pas
 * ici — elle se voit dans la comptabilité de clients réels, des semaines plus
 * tard. D'où trois partis pris :
 *
 *  - les comptes se saisissent en TEXTE, une ligne par compte. Un modèle en
 *    compte plusieurs dizaines : un formulaire ligne à ligne serait
 *    impraticable, alors qu'un bloc de texte se relit, se colle depuis un
 *    tableur et se compare d'un coup d'œil. C'est déjà l'idiome du
 *    questionnaire d'onboarding dans ce back-office ;
 *  - le nombre de dossiers qui utilisent le modèle est affiché en permanence,
 *    et la suppression d'un modèle utilisé est refusée par le serveur ;
 *  - toute écriture demande une ré-authentification (SudoGuard) et est
 *    journalisée.
 */

/** Types de compte acceptés par le serveur (accounting-plan.service.ts). */
const ACCOUNT_TYPES = ['CLIENT', 'FOURNISSEUR', 'TRESORERIE', 'CHARGE', 'PRODUIT', 'TVA', 'AUTRE']

const EMPTY = {
  id: null,
  code: '',
  name: '',
  description: '',
  norm: '',
  active: true,
  accountsText: '',
}

/**
 * « 411000 | Clients | CLIENT » → objet. Le type est facultatif (AUTRE par
 * défaut) : on préfère un compte importé sans type qu'un import refusé.
 */
function parseAccounts(text) {
  const rows = []
  const errors = []
  const seen = new Set()

  ;(text ?? '').split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return

    const [code, name, type] = line.split('|').map((part) => part.trim())
    const position = index

    if (!code || !name) {
      errors.push(`Ligne ${index + 1} : « code | libellé » attendu.`)
      return
    }
    if (seen.has(code)) {
      errors.push(`Ligne ${index + 1} : le compte ${code} est en doublon.`)
      return
    }
    const upper = (type ?? '').toUpperCase()
    if (type && !ACCOUNT_TYPES.includes(upper)) {
      errors.push(`Ligne ${index + 1} : type « ${type} » inconnu.`)
      return
    }

    seen.add(code)
    rows.push({ code, name, type: upper || 'AUTRE', position })
  })

  return { rows, errors }
}

function accountsToText(accounts) {
  return (accounts ?? [])
    .map((account) => `${account.code} | ${account.name} | ${account.type}`)
    .join('\n')
}

export function AdminAccountingPlansPage() {
  const [allowed, setAllowed] = useState(null)
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [usage, setUsage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
      err.code = body?.error
      throw err
    }
    return res.status === 204 ? null : res.json()
  }, [])

  const load = useCallback(async () => {
    setTemplates(await call('/admin/accounting-plans/templates'))
  }, [call])

  useEffect(() => {
    ;(async () => {
      try {
        await load()
        setAllowed(true)
      } catch (e) {
        if (e?.code === 'MFA_REQUIRED') setAllowed('mfa')
        else setAllowed(false)
      }
    })()
  }, [load])

  const parsed = useMemo(() => parseAccounts(form.accountsText), [form.accountsText])

  const select = async (template) => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    try {
      const full = await call(`/admin/accounting-plans/templates/${template.id}`)
      setForm({
        id: full.id,
        code: full.code,
        name: full.name,
        description: full.description ?? '',
        norm: full.norm ?? '',
        active: full.active,
        accountsText: accountsToText(full.accounts),
      })
      setUsage(full.companies ?? 0)
    } catch (e) {
      setError(String(e.message ?? e))
    }
  }

  const startNew = () => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    setForm(EMPTY)
    setUsage(0)
  }

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  const save = async (event) => {
    event.preventDefault()
    if (parsed.errors.length > 0) {
      setError('Corrigez les lignes en erreur avant d’enregistrer.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      norm: form.norm.trim() || null,
      active: form.active,
      accounts: parsed.rows,
    }

    try {
      const saved = await withSudo(() =>
        form.id
          ? call(`/admin/accounting-plans/templates/${form.id}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            })
          : call('/admin/accounting-plans/templates', {
              method: 'POST',
              body: JSON.stringify(payload),
            }),
      )
      setForm((f) => ({ ...f, id: saved.id, code: saved.code }))
      setNotice(
        `Modèle enregistré : ${parsed.rows.length} compte${parsed.rows.length > 1 ? 's' : ''}.`,
      )
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
      await withSudo(() =>
        call(`/admin/accounting-plans/templates/${form.id}`, { method: 'DELETE' }),
      )
      setNotice('Modèle supprimé.')
      startNew()
      await load()
    } catch (e) {
      // Cas le plus fréquent : modèle utilisé par des dossiers, refusé par le
      // serveur avec le nombre en clair.
      setError(String(e.message ?? e))
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  const seed = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await withSudo(() =>
        call('/admin/accounting-plans/seed', { method: 'POST', body: '{}' }),
      )
      const added = Object.entries(result ?? {})
        .map(([code, n]) => `${code} +${n}`)
        .join(', ')
      setNotice(`Modèles par défaut chargés${added ? ` (${added})` : ''}.`)
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
        <h1>Modèles de plan comptable</h1>
        <p className="acp-warn">
          Cette page exige une double authentification active sur votre compte. Activez-la
          depuis l’onglet <strong>Sécurité</strong>, puis revenez ici.
        </p>
      </div>
    )
  }

  if (allowed === false) {
    return (
      <div className="admin-page">
        <h1>Modèles de plan comptable</h1>
        <p className="acp-warn">Accès réservé aux super administrateurs.</p>
      </div>
    )
  }

  return (
    <div className="admin-page admin-acp">
      <header className="acp-head">
        <div>
          <h1>Modèles de plan comptable</h1>
          <p>
            Plans proposés à la création d’un dossier. Les comptes du modèle sont{' '}
            <strong>copiés</strong> dans la société : modifier un modèle ne change rien aux
            dossiers déjà créés.
          </p>
        </div>
        {canWrite && (
          <div className="acp-head-actions">
            <button type="button" className="acp-btn" onClick={seed} disabled={saving}>
              Charger les modèles par défaut
            </button>
            <button type="button" className="acp-btn primary" onClick={startNew}>
              Nouveau modèle
            </button>
          </div>
        )}
      </header>

      {!canWrite && (
        <p className="acp-readonly">
          Profil {profileLabel ?? 'de consultation'} : les modèles sont en lecture seule.
        </p>
      )}
      {error && <p className="acp-error">{error}</p>}
      {notice && <p className="acp-notice">{notice}</p>}

      <div className="acp-layout">
        <aside className="acp-list">
          {templates.length === 0 ? (
            <p className="acp-empty">
              Aucun modèle. « Charger les modèles par défaut » installe BIC, BNC, BA et RF.
            </p>
          ) : (
            <ul>
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className={`acp-item${form.id === template.id ? ' active' : ''}`}
                    onClick={() => select(template)}
                  >
                    <span className="acp-item-title">
                      <code>{template.code}</code> {template.name}
                    </span>
                    <span className="acp-item-meta">
                      {template._count?.accounts ?? 0} comptes
                      {template.companies > 0 && (
                        <> · {template.companies} dossier{template.companies > 1 ? 's' : ''}</>
                      )}
                      {!template.active && <span className="acp-badge">inactif</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <form className="acp-form" onSubmit={save}>
          <fieldset disabled={!canWrite} className="acp-fieldset">
            <div className="acp-row">
              <label>
                <span>Code</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={set('code')}
                  placeholder="BIC"
                  required
                  disabled={Boolean(form.id)}
                />
                <small>
                  {form.id
                    ? 'Non modifiable : les dossiers y font référence.'
                    : 'Identifiant court, en majuscules.'}
                </small>
              </label>
              <label>
                <span>Nom</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Plan comptable BIC"
                  required
                />
              </label>
            </div>

            <div className="acp-row">
              <label>
                <span>Norme</span>
                <input
                  type="text"
                  value={form.norm}
                  onChange={set('norm')}
                  placeholder="ANC 2022-06"
                />
              </label>
              <label className="acp-check-inline">
                <input type="checkbox" checked={form.active} onChange={set('active')} />
                Actif
                <small>Un modèle inactif disparaît des sélecteurs, sans rien casser.</small>
              </label>
            </div>

            <label>
              <span>Description</span>
              <textarea value={form.description} onChange={set('description')} rows={2} />
            </label>

            <label>
              <span>Comptes</span>
              <textarea
                className="acp-accounts"
                value={form.accountsText}
                onChange={set('accountsText')}
                rows={16}
                spellCheck={false}
                placeholder={'411000 | Clients | CLIENT\n706000 | Prestations de services | PRODUIT'}
              />
              <small>
                Un compte par ligne : <code>code | libellé | type</code>. Type facultatif
                (AUTRE par défaut) parmi {ACCOUNT_TYPES.join(', ')}. Les lignes vides et
                celles commençant par <code>#</code> sont ignorées.
              </small>
            </label>

            <div className="acp-parse">
              <span className="acp-parse-count">
                {parsed.rows.length} compte{parsed.rows.length > 1 ? 's' : ''} reconnu
                {parsed.rows.length > 1 ? 's' : ''}
              </span>
              {parsed.errors.length > 0 && (
                <ul className="acp-parse-errors">
                  {parsed.errors.slice(0, 5).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                  {parsed.errors.length > 5 && (
                    <li>… et {parsed.errors.length - 5} autre(s).</li>
                  )}
                </ul>
              )}
            </div>

            {form.id && usage > 0 && (
              <p className="acp-usage">
                {usage} dossier{usage > 1 ? 's' : ''} utilise{usage > 1 ? 'nt' : ''} ce
                modèle. Vos modifications ne les toucheront pas — leurs comptes ont été
                copiés à la création. La suppression sera refusée ; désactivez le modèle
                pour le retirer des sélecteurs.
              </p>
            )}

            <div className="acp-actions">
              {form.id &&
                (confirmDelete ? (
                  <button
                    type="button"
                    className="acp-btn danger"
                    onClick={remove}
                    disabled={saving}
                  >
                    Confirmer la suppression
                  </button>
                ) : (
                  <button
                    type="button"
                    className="acp-btn"
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving}
                  >
                    Supprimer
                  </button>
                ))}
              <span className="acp-spacer" />
              <button
                type="submit"
                className="acp-btn primary"
                disabled={saving || parsed.errors.length > 0}
              >
                {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>

      {sudoPrompt}
    </div>
  )
}

export default AdminAccountingPlansPage
