import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Product } from '../registry/products.service';

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Jeton présenté à un produit donné.
 *
 * Deux régimes, parce que les produits ne font pas la même hypothèse :
 *
 *  - `direct` — le produit valide les jetons du portail contre son JWKS
 *    (`@semply/auth`). On lui présente l'access token du portail tel quel.
 *
 *  - `exchange` — le produit refuse d'autoriser sur la foi d'un jeton du
 *    portail : il veut n'en tirer que l'IDENTITÉ et calculer lui-même les
 *    droits. C'est le choix de SEmplyApp, et c'est le bon : ses entitlements,
 *    quotas, permissions et `is_superadmin` sont à lui. Le relais fait donc
 *    exactement ce que fait le navigateur — POST de l'id_token sur la route
 *    d'échange — et se sert ensuite du jeton que le produit a émis.
 *
 * Conséquence pratique : AUCUNE modification du modèle d'authentification de
 * SEmplyApp n'est nécessaire. `JwtStrategy` accepte déjà
 * `Authorization: Bearer`, et le jeton présenté est un jeton qu'il a signé
 * lui-même.
 *
 * Les jetons obtenus sont mémorisés par (session, produit) et renouvelés à
 * l'expiration. Ils ne quittent jamais ce processus.
 */
@Injectable()
export class ProductTokenService {
  private readonly logger = new Logger(ProductTokenService.name);
  private readonly cache = new Map<string, CachedToken>();

  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (entry.expiresAt <= now) this.cache.delete(key);
      }
    }, 5 * 60_000).unref();
  }

  async tokenFor(
    product: Product,
    session: { sub: string; accessToken: string; idToken: string },
  ): Promise<string> {
    if (product.authMode === 'direct') return session.accessToken;

    const key = `${session.sub}::${product.key}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const token = await this.exchange(product, session.idToken);
    // Pas de durée de vie annoncée par la route d'échange : on garde le jeton
    // 5 minutes. Trop court coûterait un échange par écran ; trop long
    // retarderait la prise en compte d'une révocation côté produit.
    this.cache.set(key, { token, expiresAt: Date.now() + 5 * 60_000 });
    return token;
  }

  /** Invalide les jetons produits d'une session — à la déconnexion. */
  forget(sub: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${sub}::`)) this.cache.delete(key);
    }
  }

  private async exchange(product: Product, idToken: string): Promise<string> {
    if (!idToken) throw new UnauthorizedException('Aucun id_token dans la session');

    const res = await fetch(`${product.apiBaseUrl}/${product.exchangePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (!res.ok) {
      this.logger.warn(`Échange refusé par ${product.key} : HTTP ${res.status}`);
      throw new UnauthorizedException(`${product.key} a refusé l’identité du portail`);
    }

    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && (body.mfaRequired || body.signupRequired)) {
      // Le produit demande une étape que le back-office ne sait pas conduire :
      // le dire clairement vaut mieux qu'un 401 opaque trois écrans plus loin.
      throw new UnauthorizedException(
        `${product.key} exige une étape supplémentaire (MFA ou inscription) — connectez-vous une fois directement sur ce produit.`,
      );
    }

    // La route d'échange pose des cookies plutôt que de renvoyer le jeton :
    // on récupère l'access token là où il est réellement.
    const token = ProductTokenService.readCookie(res, 'access_token');
    if (!token) {
      throw new UnauthorizedException(`${product.key} n’a pas émis de jeton exploitable`);
    }
    return token;
  }

  private static readCookie(res: Response, name: string): string | null {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      if (index > 0 && pair.slice(0, index).trim() === name) {
        return decodeURIComponent(pair.slice(index + 1).trim());
      }
    }
    return null;
  }
}
