import {
  All, Controller, Req, Res, Param, BadRequestException,
  ForbiddenException, UnauthorizedException, Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProductsService } from '../registry/products.service';
import { SessionStore } from '../session/session.store';
import { OidcService } from '../auth/oidc.service';
import { ProductTokenService } from '../auth/product-token.service';
import { SESSION_COOKIE } from '../session/cookie';

/**
 * Relais vers les API d'administration des produits.
 *
 * C'est le SEUL endroit où un jeton quitte ce processus, et il part vers une
 * API de la suite, jamais vers le navigateur.
 *
 * Trois restrictions, toutes nécessaires :
 *
 *  1. Le produit est une CLÉ résolue dans le registre, jamais une URL fournie
 *     par l'appelant. Sans ça, cette route serait une SSRF : une session
 *     d'admin compromise ferait émettre au serveur des requêtes vers le réseau
 *     interne du VPS.
 *  2. Le chemin doit commencer par `admin/`. Le back-office n'a aucune raison
 *     d'atteindre les routes clientes d'un produit, et un relais généraliste
 *     contournerait les gardes applicatives par simple oubli.
 *  3. Aucun en-tête de la requête entrante n'est recopié tel quel — en
 *     particulier `Cookie`, qui porte la session du back-office : la relayer
 *     l'exposerait à quatre API qui n'en ont pas l'usage.
 */
@Controller('p')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(
    private readonly products: ProductsService,
    private readonly sessions: SessionStore,
    private readonly oidc: OidcService,
    private readonly productTokens: ProductTokenService,
  ) {}

  @All(':product/*path')
  async relay(@Param('product') productKey: string, @Req() req: Request, @Res() res: Response) {
    const product = this.products.get(productKey);
    if (!product) throw new ForbiddenException('Produit inconnu');

    const id = req.cookies?.[SESSION_COOKIE];
    const session = this.sessions.get(id);
    if (!session) throw new UnauthorizedException();

    const path = String((req.params as Record<string, unknown>).path ?? '');
    if (!path.startsWith('admin/')) {
      throw new BadRequestException('Seules les routes d’administration sont relayées');
    }

    // Renouvellement avant expiration : évite un 401 et un aller-retour.
    let current = session;
    if (Date.now() >= session.expiresAt) {
      try {
        const renewed = await this.oidc.refresh(session.refreshToken);
        this.sessions.update(id, renewed);
        current = { ...session, ...renewed };
      } catch {
        // Refresh refusé : la famille de jetons a probablement été révoquée.
        // On ferme la session plutôt que de laisser un état incohérent.
        this.sessions.destroy(id);
        this.productTokens.forget(session.sub);
        throw new UnauthorizedException('Session expirée');
      }
    }

    // Le jeton dépend du produit : le portail pour ceux qui valident son JWKS,
    // un jeton émis par le produit lui-même pour ceux qui n'autorisent que sur
    // leur propre base (SEmplyApp). Voir ProductTokenService.
    const accessToken = await this.productTokens.tokenFor(product, current);

    const url = new URL(`${product.apiBaseUrl}/${path}`);
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') url.searchParams.append(key, value);
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        // Liste blanche stricte — surtout pas de Cookie, surtout pas de Host.
        Authorization: `Bearer ${accessToken}`,
        Accept: req.headers.accept ?? 'application/json',
        ...(hasBody ? { 'Content-Type': req.headers['content-type'] ?? 'application/json' } : {}),
        // Trace l'administrateur pour le journal d'audit du produit : c'est ce
        // qui permet d'écrire « qui » plutôt que « le back-office ».
        'X-Admin-Subject': session.sub,
      },
      body: hasBody ? JSON.stringify(req.body) : undefined,
    }).catch((error) => {
      this.logger.error(`Relais ${productKey} injoignable : ${String(error)}`);
      return null;
    });

    if (!upstream) {
      res.status(502).json({ error: 'Produit injoignable' });
      return;
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    res.status(upstream.status).type(contentType);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }

  /** Produits joignables — alimente la navigation du back-office. */
  @All('')
  list() {
    return this.products.list().map(({ key, name }) => ({ key, name }));
  }
}
