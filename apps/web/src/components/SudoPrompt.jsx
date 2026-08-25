import React, { useState } from 'react';
import { apiFetch, useIdentityProofMode, startGoogleReauth } from '@semplyadmin/http'
import './SudoPrompt.css';

/**
 * Ré-authentification avant une action d'administration.
 *
 * S'affiche quand l'API répond 403 `SUDO_REQUIRED`. Une fois validée, le
 * serveur pose un cookie `sudo_token` de 15 min et l'action est rejouée : le
 * mot de passe et le code ne quittent jamais ce composant.
 *
 *   const sudo = useSudoPrompt()
 *   await sudo.run(() => apiFetch('/admin/billing/plans', { method: 'POST', … }))
 *
 * Comptes créés via Google : ils n'ont pas de mot de passe utilisable, la preuve
 * d'identité vient d'un aller-retour Google. Celui-ci quitte la page, donc
 * l'action en cours est perdue — mais la preuve, elle, reste valable 5 minutes :
 * l'utilisateur relance son action, cette fenêtre se réaffiche, et il n'a plus
 * qu'à saisir son code.
 */
function SudoPrompt({ onConfirmed, onCancel }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { mode } = useIdentityProofMode();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/auth/sudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Omis pour un compte Google : la preuve voyage dans le cookie
          // `reauth_token`, jamais dans le corps de la requête.
          ...(mode?.hasUsablePassword && { password }),
          code: code.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);

      setPassword('');
      setCode('');
      onConfirmed();
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  if (!mode) return null;

  return (
    <div className="sudo-overlay" role="dialog" aria-modal="true" aria-labelledby="sudo-title">
      <div className="sudo-modal">
        <h2 id="sudo-title">Confirmez votre identité</h2>
        <p>
          Cette action modifie la plateforme pour l’ensemble des utilisateurs.
          Votre confirmation reste valable 15 minutes.
        </p>

        <form onSubmit={submit}>
          {mode.hasUsablePassword ? (
            <>
              <label htmlFor="sudo-password">Mot de passe</label>
              <input
                id="sudo-password"
                required
                autoFocus
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          ) : mode.reauthConfirmed ? (
            <p className="sudo-reauth-ok">Identité confirmée avec Google.</p>
          ) : (
            <>
              <p className="sudo-reauth-hint">
                Votre compte se connecte avec Google. Confirmez votre identité
                auprès de Google : vous serez ramené ici pour saisir votre code.
              </p>
              <button type="button" className="sudo-btn" onClick={() => startGoogleReauth()}>
                Confirmer avec Google
              </button>
            </>
          )}

          <label htmlFor="sudo-code">Code de double authentification</label>
          <input
            id="sudo-code"
            required
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />

          {error && <p className="sudo-error">{error}</p>}

          <div className="sudo-actions">
            <button type="button" className="sudo-btn" onClick={onCancel} disabled={busy}>
              Annuler
            </button>
            <button
              type="submit"
              className="sudo-btn primary"
              // Sans preuve Google, l'API répondrait REAUTH_REQUIRED.
              disabled={busy || (!mode.hasUsablePassword && !mode.reauthConfirmed)}
            >
              {busy ? 'Vérification…' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { SudoPrompt };
export default SudoPrompt;
