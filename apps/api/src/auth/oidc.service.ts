import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';

/**
 * Client OIDC du back-office, côté serveur.
 *
 * Le back-office est déclaré en client PUBLIC avec PKCE S256 — comme les autres
 * clients de la suite. AuthSEmply ne vérifie pas les secrets clients : la
 * colonne `clientSecretHash` existe dans son schéma mais n'est lue nulle part.
 * Envoyer un `client_secret` donnerait donc l'illusion d'une authentification
 * de client qui n'a pas lieu.
 *
 * Ce que PKCE garantit ici : le code d'autorisation ne vaut rien sans le
 * `code_verifier`, qui ne quitte jamais ce processus. Et `redirectUris` est
 * une liste fermée côté portail, donc un tiers qui connaîtrait le
 * `client_id` ne peut pas se faire livrer le code.
 *
 * `OIDC_CLIENT_SECRET` reste accepté, et transmis s'il est renseigné : le jour
 * où AuthSEmply vérifiera les clients confidentiels, il n'y aura rien à
 * changer ici.
 *
 * Les chemins sont configurables : AuthSEmply monte son contrôleur sur
 * `/oidc`, mais nginx peut préfixer. Ne jamais deviner en production.
 */

const base = (process.env.AUTH_API_URL ?? 'https://api-auth.semply.fr').replace(/\/$/, '');
const AUTHORIZE = process.env.AUTH_AUTHORIZE_PATH ?? '/oidc/authorize';
const TOKEN = process.env.AUTH_TOKEN_PATH ?? '/oidc/token';
const USERINFO = process.env.AUTH_USERINFO_PATH ?? '/oidc/userinfo';

export interface PendingAuth {
  verifier: string;
  state: string;
  createdAt: number;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Jeton d'IDENTITÉ. Certains produits ne l'échangent pas contre l'access
   *  token du portail mais contre une session à eux — voir ProductTokenService. */
  idToken: string;
  expiresAt: number;
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  /** Autorisations en vol, indexées par `state`. Durée de vie : 10 minutes. */
  private readonly pending = new Map<string, PendingAuth>();

  constructor() {
    setInterval(() => {
      const cutoff = Date.now() - 10 * 60_000;
      for (const [state, entry] of this.pending) {
        if (entry.createdAt < cutoff) this.pending.delete(state);
      }
    }, 60_000).unref();
  }

  /** Démarre le flux : renvoie l'URL du portail vers laquelle rediriger. */
  beginAuthorization(): string {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(16).toString('base64url');

    this.pending.set(state, { verifier, state, createdAt: Date.now() });

    const url = new URL(base + AUTHORIZE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  /** Échange le code contre des jetons. Le `state` est à usage unique. */
  async exchange(code: string, state: string): Promise<TokenSet> {
    const entry = this.pending.get(state);
    // Consommé quoi qu'il arrive : un state rejoué ne doit jamais aboutir.
    this.pending.delete(state);
    if (!entry) throw new UnauthorizedException('State inconnu ou expiré');

    return this.postToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: entry.verifier,
    });
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return this.postToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /** Identité du porteur — appel VIVANT au portail, donc révocation immédiate. */
  async userinfo(accessToken: string): Promise<Record<string, unknown>> {
    const res = await fetch(base + USERINFO, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new UnauthorizedException('Jeton refusé par le portail');
    return res.json() as Promise<Record<string, unknown>>;
  }

  private async postToken(body: Record<string, string>): Promise<TokenSet> {
    const res = await fetch(base + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...body,
        client_id: this.clientId,
        ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
      }),
    });

    if (!res.ok) {
      // Le corps peut contenir le code d'erreur OAuth ; il n'a rien de secret,
      // mais on ne le renvoie pas au navigateur — seulement au journal.
      this.logger.warn(`Échec /token : HTTP ${res.status} ${await res.text().catch(() => '')}`);
      throw new UnauthorizedException('Échange de jeton refusé');
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      id_token?: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token ?? '',
      // 30 s de marge : on renouvelle avant l'expiration plutôt qu'après un 401.
      expiresAt: Date.now() + (data.expires_in - 30) * 1000,
    };
  }

  private get clientId(): string {
    return required('OIDC_CLIENT_ID');
  }
  /** Optionnel : AuthSEmply ne vérifie pas encore les clients confidentiels. */
  private get clientSecret(): string | null {
    return process.env.OIDC_CLIENT_SECRET?.trim() || null;
  }
  private get redirectUri(): string {
    return required('OIDC_REDIRECT_URI');
  }
  private get scopes(): string {
    return process.env.OIDC_SCOPES ?? 'openid profile email';
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}
