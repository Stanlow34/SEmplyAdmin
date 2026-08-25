import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';

export interface AdminSession {
  sub: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  /** Expiration de l'access token, en millisecondes epoch. */
  expiresAt: number;
  createdAt: number;
}

/**
 * Sessions du back-office — EN MÉMOIRE, volontairement.
 *
 * C'est tout l'intérêt du BFF : les jetons OIDC ne quittent jamais ce
 * processus. Le navigateur ne reçoit qu'un identifiant de session opaque, dans
 * un cookie httpOnly *host-only* sur admin.semply.fr. Une XSS dans le
 * back-office ne peut donc rien exfiltrer d'utilisable ailleurs.
 *
 * Conséquence assumée : un redémarrage PM2 déconnecte les administrateurs. À
 * une poignée de comptes, c'est une reconnexion — pas un incident. Le jour où
 * ça gênera, remplacer cette Map par Redis ne touche que ce fichier.
 *
 * Le cookie porte l'identifiant EN CLAIR mais la Map est indexée par son
 * SHA-256 : une fuite de la mémoire du processus (core dump, heap snapshot) ne
 * livre pas des cookies rejouables.
 */
@Injectable()
export class SessionStore {
  private readonly logger = new Logger(SessionStore.name);
  private readonly sessions = new Map<string, AdminSession>();

  /** Purge périodique : sans elle, une session jamais fermée fuit. */
  constructor() {
    setInterval(() => this.sweep(), 10 * 60_000).unref();
  }

  private static key(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  create(session: Omit<AdminSession, 'createdAt'>): string {
    const id = randomBytes(32).toString('base64url');
    this.sessions.set(SessionStore.key(id), { ...session, createdAt: Date.now() });
    return id;
  }

  get(id: string | undefined): AdminSession | null {
    if (!id) return null;
    return this.sessions.get(SessionStore.key(id)) ?? null;
  }

  update(id: string, patch: Partial<AdminSession>): void {
    const key = SessionStore.key(id);
    const current = this.sessions.get(key);
    if (current) this.sessions.set(key, { ...current, ...patch });
  }

  destroy(id: string | undefined): void {
    if (id) this.sessions.delete(SessionStore.key(id));
  }

  /** Le refresh token dure 30 jours côté AuthSEmply : au-delà, rien à garder. */
  private sweep(): void {
    const cutoff = Date.now() - 30 * 24 * 3600_000;
    let removed = 0;
    for (const [key, session] of this.sessions) {
      if (session.createdAt < cutoff) {
        this.sessions.delete(key);
        removed += 1;
      }
    }
    if (removed) this.logger.log(`${removed} session(s) expirée(s) purgée(s)`);
  }
}
