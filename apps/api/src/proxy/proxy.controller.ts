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
/**
 * Chemins que le relais accepte de transmettre.
 *
 * `admin/` est la surface d'administration proprement dite. S'y ajoutent
 * quelques routes d'authentification, et elles ne sont PAS un assouplissement
 * de confort : les écrans repris de SEmplyApp exigent une preuve d'identité
 * fraîche avant les mutations sensibles (`SudoGuard`), et l'écran Sécurité doit
 * pouvoir appairer un TOTP — sans quoi un compte habilité mais non appairé
 * reste enfermé dehors, la double authentification étant obligatoire.
 *
 * La liste est ÉNUMÉRÉE, jamais un préfixe large comme `auth/` : `auth/login`
 * ou `auth/refresh` relayés donneraient au navigateur prise sur la session que
 * le relais est justement là pour lui soustraire.
 *
 * ⚠️ `auth/google/reauth` n'y est PAS et ne peut pas y être : c'est une
 * navigation de premier niveau vers Google, dont le retour pose des cookies sur
 * le domaine du produit. Un relais qui transmet des requêtes fetch ne sait pas
 * conduire ça. Conséquence : la preuve d'identité « Confirmer avec Google »
 * n'est pas disponible depuis ce back-office — seul le mot de passe l'est. Un
 * compte sans mot de passe utilisable devra soit en poser un, soit attendre le
 * déplacement de la preuve d'identité vers le portail, qui l'a déjà conduite
 * une fois à la connexion.
 */
const RELAYABLE_EXACT = new Set([
  'health/environment',
  'auth/sudo',
  'auth/reauth/status',
  // Remontée des erreurs hors rendu du back-office lui-même.
  'client-errors',
]);
const RELAYABLE_PREFIXES = ['admin/', 'auth/totp/'];

function isRelayable(path: string): boolean {
  // Une remontée de chemin viderait ces règles de leur sens.
  if (path.includes('..')) return false;
  const clean = path.split('?')[0];
  return (
    RELAYABLE_EXACT.has(clean) || RELAYABLE_PREFIXES.some((prefix) => clean.startsWith(prefix))
  );
}

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
    if (!isRelayable(path)) {
      throw new BadRequestException('Route non relayée');
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
