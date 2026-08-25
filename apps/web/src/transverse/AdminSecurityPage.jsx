import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase.js';
import { TwoFactorTab } from '../settings/TwoFactorTab.jsx';

/**
 * Sécurité du compte d'administration.
 *
 * La session du back-office est distincte de la session applicative (cookie
 * host-only sur le domaine d'administration) : l'appairage TOTP doit donc être
 * possible ICI. Sans cette page, un super admin fraîchement créé ne pourrait
 * jamais activer sa double authentification sur ce domaine, et resterait donc
 * bloqué devant `MFA_REQUIRED`.
 *
 * L'encart « Mon identité » vit ici et non dans Utilisateurs : chacun règle SA
 * fiche — y compris un rôle Support, dont c'est l'un des trois seuls menus. Le
 * SURNOM est ce que les clients voient signer les réponses sur leurs tickets ;
 * vide, les réponses partent sous « L'équipe SEmply ».
 */

function IdentityCard() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const call = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  useEffect(() => {
    call('/admin/identity')
      .then((data) =>
        setForm({
          firstname: data?.firstname ?? '',
          name: data?.name ?? '',
          admin_nickname: data?.admin_nickname ?? '',
        }),
      )
      .catch((err) => setError(err.message));
  }, [call]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await call('/admin/identity', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setMessage('Identité enregistrée.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return error ? <p className="au-error">{error}</p> : <p>Chargement…</p>;

  return (
    <form className="admin-identity" onSubmit={save}>
      <h2>Mon identité</h2>
      <div className="admin-identity-fields">
        <label>
          <span>Prénom</span>
          <input
            type="text"
            maxLength={100}
            value={form.firstname}
            onChange={(e) => setForm((f) => ({ ...f, firstname: e.target.value }))}
          />
        </label>
        <label>
          <span>Nom</span>
          <input
            type="text"
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label>
          <span>Surnom (visible des clients)</span>
          <input
            type="text"
            maxLength={60}
            placeholder="ex. Sam"
            value={form.admin_nickname}
            onChange={(e) => setForm((f) => ({ ...f, admin_nickname: e.target.value }))}
          />
        </label>
      </div>
      <p className="admin-identity-hint">
        Le surnom signe vos réponses sur les tickets de support, à la place de
        votre identité réelle. Laissé vide, les clients voient
        « L’équipe SEmply ».
      </p>
      <div className="admin-identity-actions">
        <button type="submit" disabled={saving}>Enregistrer</button>
        {message && <span className="admin-identity-ok">{message}</span>}
        {error && <span className="au-error">{error}</span>}
      </div>
    </form>
  );
}

function AdminSecurityPage() {
  return (
    <div className="admin-page">
      <h1>Sécurité du compte</h1>
      <IdentityCard />
      <TwoFactorTab />
    </div>
  );
}

export { AdminSecurityPage };
export default AdminSecurityPage;
