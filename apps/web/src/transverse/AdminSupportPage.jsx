import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, apiErrorMessage, errorMessage, useIdentityProofMode, startGoogleReauth } from '@semplyadmin/http'
import './AdminSupportPage.css';

/**
 * Ouverture d'une session support depuis le back-office.
 *
 * Deux étapes, imposées par le navigateur autant que par la sécurité :
 *
 *  1. le code du client est validé ici, sur `admin.semply.fr`, derrière
 *     SuperAdminGuard + SudoGuard (mot de passe + TOTP récents) ;
 *  2. l'API renvoie un ticket d'une minute que l'on va échanger sur le domaine
 *     de l'application cliente — un cookie ne peut pas être posé pour un autre
 *     domaine. La session support n'existe donc jamais sur le domaine
 *     d'administration, ce qui préserve son isolation.
 *
 * L'ouverture se fait dans un nouvel onglet : le back-office reste disponible.
 */

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function AdminSupportPage() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsSudo, setNeedsSudo] = useState(false);
  // Un super admin dont le compte a été créé via Google n'a pas de mot de passe
  // utilisable : sa preuve d'identité est un aller-retour Google.
  const { mode } = useIdentityProofMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(null);

  const elevate = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await apiFetch('/auth/sudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Omis pour un compte Google : la preuve voyage dans le cookie
          // `reauth_token`, jamais dans le corps de la requête.
          ...(mode?.hasUsablePassword && { password }),
          code: totp.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Ré-authentification refusée.'));
      setNeedsSudo(false);
      setPassword(''); setTotp('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openSession = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setOpened(null);
    try {
      const res = await apiFetch('/admin/support/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        // 403 sans code métier = élévation sudo manquante ou expirée.
        const body = await res.clone().json().catch(() => null);
        if (res.status === 403 && !body?.error?.startsWith?.('SUPPORT_')) {
          setNeedsSudo(true);
        }
        throw new Error(await apiErrorMessage(res, 'Ouverture de session refusée.'));
      }
      const data = await res.json();
      setOpened(data);
      setCode('');
      // Le ticket ne vaut qu'une minute : on l'échange tout de suite.
      window.open(data.redirect_url, '_blank', 'noopener');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="asup-page">
      <header className="asup-header">
        <h1>Session support</h1>
        <p className="asup-sub">
          Consulter l’espace d’un client qui vous y a autorisé. Le client génère un code
          depuis Paramètres › Sécurité et le communique dans son ticket —{' '}
          <Link to="/admin/support/tickets">voir la file des tickets</Link>.
        </p>
      </header>

      <section className="asup-rules">
        <h2>Ce que permet une session support</h2>
        <ul>
          <li><strong>Consultation seule.</strong> Toute écriture est refusée par le serveur — une facture ou une déclaration émise ici serait imputée au client, dans sa numérotation et sous son identité fiscale.</li>
          <li><strong>Une société à la fois.</strong> La session ne donne accès qu’à celle qui a autorisé l’accès.</li>
          <li><strong>Révocable et tracée.</strong> Le client peut couper à tout instant ; il est averti par email et retrouve chaque consultation dans son historique.</li>
        </ul>
      </section>

      {error && <div className="asup-alert">{error}</div>}

      {needsSudo ? (
        <section className="asup-form">
          <h2>Ré-authentification</h2>
          <p className="asup-hint">
            {mode?.hasUsablePassword === false
              ? 'Entrer chez un client demande une confirmation Google et votre second facteur, même avec une session ouverte.'
              : 'Entrer chez un client demande votre mot de passe et votre second facteur, même avec une session ouverte.'}
          </p>
          <form onSubmit={elevate}>
            {mode?.hasUsablePassword === false ? (
              mode.reauthConfirmed ? (
                <p className="asup-hint">Identité confirmée avec Google.</p>
              ) : (
                <button type="button" onClick={() => startGoogleReauth()}>
                  Confirmer avec Google
                </button>
              )
            ) : (
              <>
                <label htmlFor="asup-pwd">Mot de passe</label>
                <input
                  id="asup-pwd"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </>
            )}
            <label htmlFor="asup-totp">Code à usage unique</label>
            <input
              id="asup-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
            />
            <button
              type="submit"
              // Sans preuve Google, l'API répondrait REAUTH_REQUIRED.
              disabled={
                busy ||
                (mode?.hasUsablePassword === false && !mode.reauthConfirmed)
              }
            >
              {busy ? 'Vérification…' : 'Valider'}
            </button>
          </form>
        </section>
      ) : (
        <section className="asup-form">
          <h2>Code communiqué par le client</h2>
          <form onSubmit={openSession}>
            <label htmlFor="asup-code">Code d’accès</label>
            <input
              id="asup-code"
              type="text"
              className="asup-code-input"
              placeholder="ABCD-EFGH-JKMN"
              value={code}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Ouverture…' : 'Ouvrir la session'}
            </button>
          </form>
        </section>
      )}

      {opened && (
        <section className="asup-opened">
          <h2>Session ouverte</h2>
          <p>
            {/* Sans société à nommer, c'est le compte qu'il faut afficher : le
                support doit pouvoir vérifier qu'il entre chez la bonne personne
                avant de basculer sur l'onglet client. */}
            {opened.company ? (
              <>Espace <strong>{opened.company.denomination}</strong></>
            ) : (
              <>
                Compte <strong>{opened.client?.email}</strong>
                {opened.client?.name ? ` (${opened.client.name})` : ''} — sans dossier
              </>
            )}{' '}
            — autorisation valable jusqu’au{' '}
            {DATE_FMT.format(new Date(opened.access.expires_at))}.
            {opened.access?.reason ? ` Motif indiqué : ${opened.access.reason}.` : ''}
          </p>
          <p className="asup-hint">
            Un onglet a dû s’ouvrir sur l’application. S’il a été bloqué,{' '}
            <a href={opened.redirect_url} target="_blank" rel="noreferrer">
              ouvrez-le manuellement
            </a>{' '}
            — ce lien n’est valable qu’une minute.
          </p>
        </section>
      )}
    </div>
  );
}

export default AdminSupportPage;
