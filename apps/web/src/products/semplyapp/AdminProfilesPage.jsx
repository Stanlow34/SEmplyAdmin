import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/apiBase.js';
import { useSudo } from '../../hooks/useSudo.jsx';
import { useAdminAccess } from '../../hooks/useAdminAccess.js';
import './AdminProfilesPage.css';

/**
 * Back-office super admin — composition des profils.
 *
 * Un profil dit ce qu'un utilisateur atteint DANS un dossier. Il ne dit rien de
 * la portée (sur quelles sociétés il travaille) ni de la facturation : ça, c'est
 * le rôle dans l'espace, et il n'est pas paramétrable ici.
 *
 * Trois niveaux par fonctionnalité, et le niveau intermédiaire est la raison
 * d'être de l'écran : « consulter » permet le comptable qui rapproche les
 * écritures bancaires sans pouvoir saisir un mouvement. Un simple oui/non
 * obligeait à choisir entre tout lui ouvrir et le laisser dehors.
 *
 * Le catalogue est celui des FORMULES (`/admin/plans`). Une seule liste à tenir,
 * et l'assurance qu'un droit ne peut pas désigner une fonctionnalité qui ne se
 * vend nulle part. Corollaire à garder en tête : cocher une case n'achète rien.
 * Un profil qui autorise un module que la formule du client ne comprend pas
 * laisse ce module fermé.
 */

const LEVELS = [
  { id: 'NONE', label: 'Aucun', hint: 'La section n’apparaît pas.' },
  { id: 'READ', label: 'Consulter', hint: 'Lecture seule, aucune modification possible.' },
  { id: 'WRITE', label: 'Modifier', hint: 'Lecture et écriture.' },
];

const PRODUCT_LABELS = {
  APP: 'SEmplyApp',
  PREVI: 'SEmplyPrevi',
  COMPTA: 'SEmplyCompta',
};

export function AdminProfilesPage() {
  const [catalogue, setCatalogue] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  /** Grille en cours d'édition : clé → 'NONE' | 'READ' | 'WRITE'. */
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [copyFromId, setCopyFromId] = useState('');

  const { run: withSudo, prompt: sudoPrompt } = useSudo();
  // Profil de consultation : les actions d'écriture ne sont pas proposées. Le
  // serveur les refuse de toute façon (capacité `write` sur chaque mutation).
  const { can, profileLabel } = useAdminAccess();
  const canWrite = can('write');

  const jsonHeaders = () => ({ 'Content-Type': 'application/json' });

  const call = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: options.body ? jsonHeaders() : {},
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
    setLoading(true);
    setError('');
    try {
      const [cat, list] = await Promise.all([
        call('/admin/profiles/catalogue'),
        call('/admin/profiles'),
      ]);
      setCatalogue(cat);
      setProfiles(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  // La grille éditée est reconstruite à chaque changement de profil : toutes les
  // fonctionnalités du catalogue y figurent, celles sans droit à 'NONE'. Sans
  // cette normalisation, une case décochée serait une clé absente, et l'écran ne
  // saurait pas distinguer « jamais accordé » de « retiré à l'instant ».
  useEffect(() => {
    if (!selected) {
      setDraft({});
      return;
    }
    const next = {};
    for (const feature of catalogue) {
      next[feature.key] = selected.permissions[feature.key] ?? 'NONE';
    }
    setDraft(next);
  }, [selected, catalogue]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const feature of catalogue) {
      const product = PRODUCT_LABELS[feature.product] ?? feature.product;
      const title = `${product} · ${feature.category}`;
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(feature);
    }
    return [...groups.entries()];
  }, [catalogue]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    return catalogue.some(
      (feature) => (selected.permissions[feature.key] ?? 'NONE') !== draft[feature.key],
    );
  }, [selected, catalogue, draft]);

  const setLevel = (key, level) => {
    setDraft((current) => ({ ...current, [key]: level }));
    setNotice('');
  };

  /** Applique un niveau à toutes les fonctionnalités d'un groupe. */
  const setGroupLevel = (features, level) => {
    setDraft((current) => {
      const next = { ...current };
      for (const feature of features) next[feature.key] = level;
      return next;
    });
    setNotice('');
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      // Les 'NONE' ne partent pas : l'absence de clé vaut refus côté serveur.
      const permissions = Object.fromEntries(
        Object.entries(draft).filter(([, level]) => level !== 'NONE'),
      );
      const updated = await withSudo(() =>
        call(`/admin/profiles/${selected.id}/permissions`, {
          method: 'PUT',
          body: JSON.stringify({ permissions }),
        }),
      );
      setProfiles((list) =>
        list.map((profile) => (profile.id === updated.id ? updated : profile)),
      );
      setNotice(`Droits du profil « ${updated.name} » enregistrés.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const create = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const created = await withSudo(() =>
        call('/admin/profiles', {
          method: 'POST',
          body: JSON.stringify({
            name: newName,
            description: newDescription || undefined,
            copyFromId: copyFromId ? Number(copyFromId) : undefined,
          }),
        }),
      );
      setProfiles((list) => [...list, created]);
      setSelectedId(created.id);
      setCreating(false);
      setNewName('');
      setNewDescription('');
      setCopyFromId('');
      setNotice(`Profil « ${created.name} » créé.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (profile) => {
    if (!window.confirm(`Supprimer le profil « ${profile.name} » ?`)) return;
    setError('');
    try {
      await withSudo(() => call(`/admin/profiles/${profile.id}`, { method: 'DELETE' }));
      setProfiles((list) => list.filter((entry) => entry.id !== profile.id));
      setSelectedId((current) => (current === profile.id ? null : current));
      setNotice(`Profil « ${profile.name} » supprimé.`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="admin-profiles"><p>Chargement…</p></div>;

  return (
    <div className="admin-profiles">
      <header className="admin-profiles-header">
        <div>
          <h1>Profils</h1>
          <p className="admin-profiles-intro">
            Ce qu’un utilisateur atteint dans un dossier. La portée — sur quelles
            sociétés il travaille, et qui paie — relève du rôle dans l’espace
            (propriétaire, administrateur) et ne se paramètre pas ici.
          </p>
        </div>
        {profileLabel && <span className="admin-profiles-badge">{profileLabel}</span>}
      </header>

      {!canWrite && (
        <p className="admin-profiles-readonly">
          Votre profil d’administration est en consultation : les modifications
          ne vous sont pas proposées.
        </p>
      )}
      {error && <p className="admin-profiles-error">{error}</p>}
      {notice && <p className="admin-profiles-notice">{notice}</p>}

      <div className="admin-profiles-layout">
        <aside className="admin-profiles-list">
          <ul>
            {profiles.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  className={profile.id === selectedId ? 'active' : ''}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <span className="admin-profiles-name">{profile.name}</span>
                  <span className="admin-profiles-meta">
                    {profile.user_count} compte{profile.user_count > 1 ? 's' : ''}
                    {profile.is_system && ' · système'}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {canWrite && !creating && (
            <button type="button" className="admin-profiles-add" onClick={() => setCreating(true)}>
              + Nouveau profil
            </button>
          )}

          {creating && (
            <form className="admin-profiles-create" onSubmit={create}>
              <label>
                <span>Nom</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Comptable"
                  required
                />
              </label>
              <label>
                <span>Description</span>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Consulte la banque, saisit les achats"
                />
              </label>
              <label>
                {/* Partir d'un profil existant plutôt que d'une grille vide :
                    on crée presque toujours une variante — « comme le
                    comptable, mais sans la banque ». Repartir de zéro
                    obligerait à recocher trente cases pour en décocher une. */}
                <span>Partir de</span>
                <select value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)}>
                  <option value="">Grille vide</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>
              <div className="admin-profiles-create-actions">
                <button type="submit">Créer</button>
                <button type="button" onClick={() => setCreating(false)}>Annuler</button>
              </div>
            </form>
          )}
        </aside>

        <section className="admin-profiles-grid">
          {!selected ? (
            <p>Sélectionnez un profil pour voir ses droits.</p>
          ) : (
            <>
              <div className="admin-profiles-title">
                <div>
                  <h2>{selected.name}</h2>
                  {selected.description && <p>{selected.description}</p>}
                </div>
                {canWrite && !selected.is_system && (
                  <button
                    type="button"
                    className="admin-profiles-delete"
                    onClick={() => remove(selected)}
                  >
                    Supprimer
                  </button>
                )}
              </div>

              {grouped.map(([title, features]) => (
                <div key={title} className="admin-profiles-group">
                  <div className="admin-profiles-group-head">
                    <h3>{title}</h3>
                    {canWrite && (
                      <div className="admin-profiles-bulk">
                        {LEVELS.map((level) => (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => setGroupLevel(features, level.id)}
                          >
                            Tout : {level.label.toLowerCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Fonctionnalité</th>
                        {LEVELS.map((level) => (
                          <th key={level.id} title={level.hint}>{level.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((feature) => (
                        <tr key={feature.key}>
                          <td>
                            <span className="admin-profiles-feature">{feature.label}</span>
                            {feature.description && (
                              <span className="admin-profiles-feature-desc">
                                {feature.description}
                              </span>
                            )}
                            <code>{feature.key}</code>
                          </td>
                          {LEVELS.map((level) => (
                            <td key={level.id} className="admin-profiles-radio">
                              <input
                                type="radio"
                                name={`${selected.id}-${feature.key}`}
                                checked={(draft[feature.key] ?? 'NONE') === level.id}
                                disabled={!canWrite}
                                onChange={() => setLevel(feature.key, level.id)}
                                aria-label={`${feature.label} — ${level.label}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {catalogue.length === 0 && (
                <p className="admin-profiles-empty">
                  Aucune fonctionnalité au catalogue. Amorcez-le depuis{' '}
                  <strong>/admin/plans</strong> — les profils s’appuient sur la
                  même liste.
                </p>
              )}

              {canWrite && (
                <div className="admin-profiles-save">
                  <button type="button" onClick={save} disabled={!dirty || saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer les droits'}
                  </button>
                  {dirty && <span>Modifications non enregistrées.</span>}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {sudoPrompt}
    </div>
  );
}

export default AdminProfilesPage;
