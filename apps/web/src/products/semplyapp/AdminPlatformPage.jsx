import React, { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiErrorMessage } from '@semplyadmin/http'
import { useAdminAccess } from '../../hooks/useAdminAccess.js'
import './AdminPlatformPage.css'

/**
 * Back-office › Ouverture : les deux robinets de la plateforme.
 *
 *   1. vend-on des formules payantes ?
 *   2. laisse-t-on créer des comptes, et à quelles conditions ?
 *
 * Ce sont les seuls réglages de cet écran, et c'est délibéré : une page de
 * « paramètres généraux » qui accumule des cases finit par être parcourue sans
 * être lue. Ici, deux décisions, leurs conséquences écrites en toutes lettres,
 * et rien d'autre.
 *
 * L'enregistrement est EXPLICITE (bouton), pas au basculement d'un
 * interrupteur : fermer les inscriptions d'une plateforme en production par
 * inadvertance en cliquant à côté n'est pas un risque acceptable.
 */

const SIGNUP_MODES = [
  {
    value: 'OPEN',
    label: 'Ouvertes',
    help: 'N’importe qui peut créer un compte gratuit.',
  },
  {
    value: 'INVITE',
    label: 'Sur invitation',
    help: 'Un code valide est exigé, pour l’inscription classique comme pour Google.',
  },
  {
    value: 'CLOSED',
    label: 'Fermées',
    help: 'Aucun compte ne peut être créé. Les comptes existants se connectent normalement.',
  },
]

const dtf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
const formatDate = (value) => (value ? dtf.format(new Date(value)) : '—')

export function AdminPlatformPage() {
  const { can } = useAdminAccess()
  const writable = can('write')

  const [form, setForm] = useState(null)
  const [invitations, setInvitations] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [settingsRes, invitationsRes] = await Promise.all([
        apiFetch('/admin/platform/settings'),
        apiFetch('/admin/platform/invitations'),
      ])
      if (!settingsRes.ok) {
        throw new Error(await apiErrorMessage(settingsRes, 'Lecture des réglages impossible.'))
      }
      const { settings } = await settingsRes.json()
      // L'écran ne connaît pas les clés en dur : il lit le catalogue renvoyé
      // par le serveur et se contente d'en extraire ce qu'il sait afficher.
      const byKey = Object.fromEntries(settings.map((s) => [s.key, s]))
      setForm({
        paidSignupOpen: Boolean(byKey['billing.paid_signup_open']?.value),
        signupMode: byKey['signup.mode']?.value ?? 'OPEN',
        signupClosedMessage: byKey['signup.closed_message']?.value ?? '',
        meta: byKey,
      })

      if (invitationsRes.ok) {
        const data = await invitationsRes.json()
        setInvitations(Array.isArray(data.invitations) ? data.invitations : [])
      }
    } catch (e) {
      setError(String(e.message ?? e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await apiFetch('/admin/platform/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidSignupOpen: form.paidSignupOpen,
          signupMode: form.signupMode,
          signupClosedMessage: form.signupClosedMessage,
        }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Enregistrement impossible.'))
      setNotice('Réglages enregistrés. Ils prennent effet en quelques secondes.')
      await load()
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const createInvitation = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const maxUses = data.get('maxUses')
    const expiresAt = data.get('expiresAt')

    setBusy(true)
    setError('')
    try {
      const res = await apiFetch('/admin/platform/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: data.get('label') || undefined,
          email: data.get('email') || undefined,
          maxUses: maxUses ? Number(maxUses) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Création du code impossible.'))
      event.target.reset()
      await load()
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id) => {
    setBusy(true)
    try {
      await apiFetch(`/admin/platform/invitations/${id}/revoke`, { method: 'POST' })
      await load()
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  if (!form) {
    return <div className="admin-loading">Chargement…</div>
  }

  return (
    <div className="admin-platform">
      <h1>Ouverture de la plateforme</h1>

      {error && <p className="admin-platform-error">{error}</p>}
      {notice && <p className="admin-platform-notice">{notice}</p>}
      {!writable && (
        <p className="admin-platform-readonly">
          Votre profil d’administration ne permet pas de modifier ces réglages.
        </p>
      )}

      <section className="admin-platform-card">
        <h2>Formules payantes</h2>
        <label className="admin-platform-switch">
          <input
            type="checkbox"
            disabled={!writable}
            checked={form.paidSignupOpen}
            onChange={(e) => setForm({ ...form, paidSignupOpen: e.target.checked })}
          />
          <span>
            <strong>
              {form.paidSignupOpen ? 'Ouvertes à la souscription' : 'Fermées à la souscription'}
            </strong>
            <em>
              Fermées, aucune session de paiement ne peut être ouverte, même en
              appelant l’API directement. Les abonnements en cours ne sont pas
              affectés, et restent résiliables.
            </em>
          </span>
        </label>
        <p className="admin-platform-hint">
          Avant d’ouvrir : vérifiez dans <strong>Catalogue</strong> que chaque formule
          vendable est rattachée à un prix Stripe. Une formule sans prix n’apparaît
          dans aucune grille tarifaire.
        </p>
      </section>

      <section className="admin-platform-card">
        <h2>Création de compte</h2>
        <div className="admin-platform-modes">
          {SIGNUP_MODES.map((mode) => (
            <label
              key={mode.value}
              className={form.signupMode === mode.value ? 'selected' : ''}
            >
              <input
                type="radio"
                name="signupMode"
                disabled={!writable}
                value={mode.value}
                checked={form.signupMode === mode.value}
                onChange={() => setForm({ ...form, signupMode: mode.value })}
              />
              <span>
                <strong>{mode.label}</strong>
                <em>{mode.help}</em>
              </span>
            </label>
          ))}
        </div>

        {form.signupMode === 'CLOSED' && (
          <label className="admin-platform-field">
            <span>Message affiché aux visiteurs</span>
            <textarea
              rows={3}
              maxLength={500}
              disabled={!writable}
              placeholder="Réouverture des inscriptions le 15 septembre."
              value={form.signupClosedMessage}
              onChange={(e) => setForm({ ...form, signupClosedMessage: e.target.value })}
            />
            <em>
              Laissé vide, un message générique s’affiche. Dire pourquoi et jusqu’à
              quand vaut mieux qu’une porte close sans explication.
            </em>
          </label>
        )}
      </section>

      <div className="admin-platform-actions">
        <button type="button" onClick={save} disabled={!writable || busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {form.signupMode === 'INVITE' && (
        <section className="admin-platform-card">
          <h2>Codes d’invitation</h2>

          {writable && (
            <form className="admin-platform-invite-form" onSubmit={createInvitation}>
              <input name="label" placeholder="Libellé (suivi interne)" maxLength={200} />
              <input name="email" type="email" placeholder="Réservé à (facultatif)" />
              <input name="maxUses" type="number" min="1" placeholder="Usages max" />
              <input name="expiresAt" type="date" aria-label="Expire le" />
              <button type="submit" disabled={busy}>
                Générer un code
              </button>
            </form>
          )}

          <table className="admin-platform-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Libellé</th>
                <th>Réservé à</th>
                <th>Usages</th>
                <th>Expire</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-platform-empty">
                    Aucun code pour l’instant.
                  </td>
                </tr>
              )}
              {invitations.map((inv) => {
                const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date()
                const exhausted = inv.maxUses !== null && inv.usedCount >= inv.maxUses
                const state = inv.revokedAt
                  ? 'Révoqué'
                  : expired
                    ? 'Expiré'
                    : exhausted
                      ? 'Épuisé'
                      : 'Actif'
                return (
                  <tr key={inv.id} className={state === 'Actif' ? '' : 'inactive'}>
                    <td>
                      <code>{inv.code}</code>
                    </td>
                    <td>{inv.label || '—'}</td>
                    <td>{inv.email || <em>au porteur</em>}</td>
                    <td>
                      {inv.usedCount}
                      {inv.maxUses === null ? ' / ∞' : ` / ${inv.maxUses}`}
                    </td>
                    <td>{formatDate(inv.expiresAt)}</td>
                    <td>{state}</td>
                    <td>
                      {writable && !inv.revokedAt && (
                        <button type="button" onClick={() => revoke(inv.id)} disabled={busy}>
                          Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p className="admin-platform-hint">
            Un code révoqué n’est pas supprimé : la trace des comptes créés avec lui
            est conservée.
          </p>
        </section>
      )}
    </div>
  )
}

export default AdminPlatformPage
