import type { Response } from 'express';

/**
 * Cookie de session du back-office.
 *
 * `domain` est VOLONTAIREMENT absent : sans cet attribut le cookie est
 * *host-only* et n'est envoyé qu'à admin.semply.fr. C'est la propriété que
 * `admin-origin.ts` cherchait à obtenir côté SEmplyApp — une XSS sur le site
 * vitrine ou son CMS, qui partagent `.semply.fr`, ne peut pas voir passer
 * cette session.
 *
 * `SameSite=Strict` : aucun envoi depuis une navigation venue d'un autre site,
 * donc pas de CSRF possible sur les routes du relais. Le retour OIDC arrive par
 * une redirection top-level depuis le portail — c'est `Lax` qu'il faudrait si
 * le cookie devait accompagner ce retour ; il ne le doit pas, la session n'est
 * créée qu'APRÈS l'échange du code.
 */
export const SESSION_COOKIE = 'semply_admin_session';

const secure = process.env.NODE_ENV === 'production';

export function setSessionCookie(res: Response, id: string, maxAgeMs: number): void {
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'strict', path: '/' });
}
