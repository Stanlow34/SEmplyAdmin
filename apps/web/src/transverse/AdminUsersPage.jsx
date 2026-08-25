import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase.js';
import { useSudo } from '../hooks/useSudo.jsx';
import './AdminUsersPage.css';

/**
 * Utilisateurs du back-office — réservé au rôle OWNER (menu UTILISATEURS).
 *
 * Deux moitiés du même pouvoir :
 *  - les COLLABORATEURS : qui entre dans l'administration, avec quel rôle ;
 *  - les RÔLES : ce que chaque rôle ouvre, menu par menu.
 *
 * Les rôles intégrés (Owner, Back-office, Support) s'affichent mais ne se
 * modifient pas : leur périmètre est une décision de code (admin-menus.ts).
 * Seuls les rôles personnalisés se composent ici, en cases à cocher.
 *
 * On PROMEUT des comptes existants (par adresse email exacte), on n'en crée
 * pas : un administrateur est d'abord une personne avec un compte et une
 * double authentification qu'elle a appairée elle-même.
 */

const EMPTY_ROLE_FORM = { name: '', menus: [] };

export function AdminUsersPage() {
  const [admins, setAdmins] = useState([]);
  const [rolesData, setRolesData] = useState({ menus: [], roles: [] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteRole, setPromoteRole] = useState('SUPPORT');

  /** Rôle personnalisé en cours d'édition : null = fermé, 'new' = création. */
  const [roleForm, setRoleForm] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);

  const { run: withSudo, prompt: sudoPrompt } = useSudo();

  const call = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new Error(body?.message ?? `HTTP ${res.status}`);
      err.code = body?.error;
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }, []);

  const load = useCallback(async () => {
    try {
      const [adminsRes, rolesRes] = await Promise.all([
        call('/admin/users'),
        call('/admin/users/roles'),
      ]);
      setAdmins(adminsRes);
      setRolesData(rolesRes);
    } catch (err) {
      setError(err.message);
    }
  }, [call]);

  useEffect(() => {
    // IIFE asynchrone : aucun setState avant le premier await, le linter
    // (set-state-in-effect) vérifie qu'on ne déclenche pas de rendu en cascade.
    (async () => {
      await load();
    })();
  }, [load]);

  const flash = (message) => {
    setNotice(message);
    setError('');
    window.setTimeout(() => setNotice(''), 4000);
  };

  const promote = async (event) => {
    event.preventDefault();
    try {
      const next = await withSudo(() =>
        call('/admin/users', {
          method: 'POST',
          body: JSON.stringify({ email: promoteEmail, role: promoteRole }),
        }),
      );
      setAdmins(next);
      setPromoteEmail('');
      flash('Collaborateur ajouté.');
    } catch (err) {
      setError(err.message);
    }
  };

  const changeRole = async (admin, roleKey) => {
    try {
      const next = await withSudo(() =>
        call(`/admin/users/${admin.id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: roleKey }),
        }),
      );
      setAdmins(next);
      flash(`Rôle de ${admin.email} mis à jour.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const revoke = async (admin) => {
    if (!window.confirm(`Retirer l'accès administration à ${admin.email} ? Son compte applicatif est conservé.`)) return;
    try {
      const next = await withSudo(() =>
        call(`/admin/users/${admin.id}`, { method: 'DELETE' }),
      );
      setAdmins(next);
      flash('Accès révoqué.');
    } catch (err) {
      setError(err.message);
    }
  };

  const openRoleForm = (role) => {
    if (role) {
      setEditingRoleId(role.id);
      setRoleForm({ name: role.name, menus: [...role.menus] });
    } else {
      setEditingRoleId(null);
      setRoleForm({ ...EMPTY_ROLE_FORM });
    }
  };

  const toggleMenu = (key) => {
    setRoleForm((form) => ({
      ...form,
      menus: form.menus.includes(key)
        ? form.menus.filter((k) => k !== key)
        : [...form.menus, key],
    }));
  };

  const saveRole = async (event) => {
    event.preventDefault();
    try {
      const next = await withSudo(() =>
        editingRoleId
          ? call(`/admin/users/roles/${editingRoleId}`, {
              method: 'PATCH',
              body: JSON.stringify(roleForm),
            })
          : call('/admin/users/roles', {
              method: 'POST',
              body: JSON.stringify(roleForm),
            }),
      );
      setRolesData(next);
      setRoleForm(null);
      setEditingRoleId(null);
      flash('Rôle enregistré.');
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteRole = async (role) => {
    if (!window.confirm(`Supprimer le rôle « ${role.name} » ?`)) return;
    try {
      const next = await withSudo(() =>
        call(`/admin/users/roles/${role.id}`, { method: 'DELETE' }),
      );
      setRolesData(next);
      flash('Rôle supprimé.');
    } catch (err) {
      setError(err.message);
    }
  };

  const displayName = (admin) =>
    [admin.firstname, admin.name].filter(Boolean).join(' ') || '—';

  return (
    <div className="admin-page admin-users">
      <h1>Utilisateurs de l’administration</h1>
      <p className="au-intro">
        Qui entre dans le back-office, et avec quel rôle. Les comptes
        applicatifs des clients ne se gèrent pas ici.
      </p>

      {error && <p className="au-error">{error}</p>}
      {notice && <p className="au-notice">{notice}</p>}

      {/* ── Collaborateurs ─────────────────────────────────────────────── */}
      <section className="au-section">
        <h2>Collaborateurs</h2>
        <table className="au-table">
          <thead>
            <tr>
              <th>Compte</th>
              <th>Nom</th>
              <th>2FA</th>
              <th>Rôle</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.email}</td>
                <td>{displayName(admin)}</td>
                <td>
                  {admin.totp_enabled ? (
                    <span className="au-ok">active</span>
                  ) : (
                    /* Sans 2FA le guard refuse tout : le signaler ici évite
                       de chercher pourquoi « ça ne marche pas » chez lui. */
                    <span className="au-warn" title="Sans double authentification, l’administration lui reste fermée.">
                      à activer
                    </span>
                  )}
                </td>
                <td>
                  <select
                    value={admin.role?.key ?? ''}
                    onChange={(e) => changeRole(admin, e.target.value)}
                  >
                    {!admin.role && <option value="">— aucun rôle —</option>}
                    {rolesData.roles.map((role) => (
                      <option key={role.key} value={role.key}>{role.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" className="au-danger" onClick={() => revoke(admin)}>
                    Révoquer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form className="au-promote" onSubmit={promote}>
          <input
            type="email"
            required
            placeholder="adresse@exemple.fr du compte à promouvoir"
            value={promoteEmail}
            onChange={(e) => setPromoteEmail(e.target.value)}
          />
          <select value={promoteRole} onChange={(e) => setPromoteRole(e.target.value)}>
            {rolesData.roles.map((role) => (
              <option key={role.key} value={role.key}>{role.name}</option>
            ))}
          </select>
          <button type="submit">Ajouter</button>
        </form>
        <p className="au-hint">
          Le compte doit déjà exister : l’administration se greffe sur un compte
          que la personne a créé et sécurisé elle-même. La double
          authentification lui sera exigée à sa première connexion ici.
        </p>
      </section>

      {/* ── Rôles ──────────────────────────────────────────────────────── */}
      <section className="au-section">
        <h2>Rôles</h2>
        <ul className="au-roles">
          {rolesData.roles.map((role) => (
            <li key={role.id} className="au-role">
              <div className="au-role-head">
                <strong>{role.name}</strong>
                {role.builtin && <span className="au-badge">intégré</span>}
                <span className="au-count">
                  {role.user_count} compte{role.user_count > 1 ? 's' : ''}
                </span>
                {!role.builtin && (
                  <span className="au-role-actions">
                    <button type="button" onClick={() => openRoleForm(role)}>Modifier</button>
                    <button type="button" className="au-danger" onClick={() => deleteRole(role)}>
                      Supprimer
                    </button>
                  </span>
                )}
              </div>
              <p className="au-role-menus">
                {role.manage_admins
                  ? 'Tous les menus, gestion des collaborateurs comprise.'
                  : rolesData.menus
                      .filter((menu) => role.menus.includes(menu.key))
                      .map((menu) => menu.label)
                      .join(' · ') || 'Aucun menu.'}
              </p>
            </li>
          ))}
        </ul>

        {roleForm ? (
          <form className="au-role-form" onSubmit={saveRole}>
            <h3>{editingRoleId ? 'Modifier le rôle' : 'Nouveau rôle'}</h3>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Nom du rôle (ex. Rédaction)"
              value={roleForm.name}
              onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="au-menu-grid">
              {rolesData.menus
                /* UTILISATEURS suit `manage_admins`, réservé aux owners : la
                   case n'est pas proposée, le serveur la refuserait. */
                .filter((menu) => menu.key !== 'UTILISATEURS')
                .map((menu) => (
                  <label key={menu.key} className="au-menu-check">
                    <input
                      type="checkbox"
                      checked={roleForm.menus.includes(menu.key)}
                      onChange={() => toggleMenu(menu.key)}
                    />
                    <span>{menu.label}</span>
                  </label>
                ))}
            </div>
            <div className="au-form-actions">
              <button type="submit">Enregistrer</button>
              <button type="button" onClick={() => { setRoleForm(null); setEditingRoleId(null); }}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="au-new-role" onClick={() => openRoleForm(null)}>
            Créer un rôle personnalisé
          </button>
        )}
      </section>

      {sudoPrompt}
    </div>
  );
}

export default AdminUsersPage;
