import { useEffect, useState } from 'react';
import { getBffBase, handleUnauthorized } from '@semplyadmin/http';

/**
 * Session du back-office, telle que le relais la connaît.
 *
 * Il n'y a plus de contexte d'authentification côté navigateur, plus de profil
 * en `localStorage`, plus de jeton : la page demande « qui suis-je » au relais,
 * qui le tient d'un appel vivant au portail. Une révocation prend donc effet au
 * rechargement suivant, sans attendre l'expiration de quoi que ce soit.
 */
export function useSession() {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`${getBffBase()}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((user) => {
        if (cancelled) return;
        // Pas de session : c'est au portail de trancher, pas à un écran local.
        if (!user) handleUnauthorized();
        else setState({ loading: false, user });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export async function logout() {
  await fetch(`${getBffBase()}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  window.location.assign('/');
}
