import { Injectable, Logger } from '@nestjs/common';

/** Comment le produit reconnaît le porteur. */
export type AuthMode =
  /** Il valide lui-même les jetons du portail (JWKS). Cas de `@semply/auth`. */
  | 'direct'
  /** Il échange un id_token du portail contre une session à lui. Cas SEmplyApp. */
  | 'exchange';

export interface Product {
  key: string;
  name: string;
  apiBaseUrl: string;
  authMode: AuthMode;
  /** Route d'échange, pour `authMode: 'exchange'`. */
  exchangePath: string;
}

/**
 * Registre des produits joignables par le relais.
 *
 * C'est la LISTE BLANCHE du proxy : le navigateur ne choisit jamais une URL,
 * il choisit une CLÉ. Sans cela, `/api/p/:product/*` serait une SSRF offerte —
 * une session d'admin compromise ferait émettre au serveur des requêtes vers
 * l'hôte de son choix, depuis le réseau interne du VPS.
 *
 * Le mode d'authentification n'est pas cosmétique. SEmplyCompta et SEmplyPrevi
 * valident les jetons du portail contre son JWKS (`@semply/auth`) : le relais
 * leur présente directement l'access token du portail. SEmplyApp, lui, ne fait
 * délibérément PAS confiance aux jetons du portail pour l'autorisation — son
 * `oidc-exchange.service.ts` le dit : « Seules les claims d'IDENTITÉ en
 * sortent ; entitlements, quotas et rôles restent calculés par SEmplyApp ».
 * Pour lui, le relais fait le même échange que le navigateur.
 *
 * Format : `clé=url[|mode[|chemin d'échange]]`, séparés par des virgules.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly products = new Map<string, Product>();

  constructor() {
    const raw = process.env.PRODUCTS ?? '';
    for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [left, mode, path] = entry.split('|').map((s) => s?.trim());
      const [key, url] = (left ?? '').split('=').map((s) => s?.trim());
      if (!key || !url) {
        this.logger.error(`PRODUCTS : entrée « ${entry} » ignorée — format attendu clé=url[|mode[|chemin]]`);
        continue;
      }
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
          throw new Error('https requis en production');
        }
        const authMode: AuthMode = mode === 'exchange' ? 'exchange' : 'direct';
        this.products.set(key, {
          key,
          name: key,
          apiBaseUrl: url.replace(/\/$/, ''),
          authMode,
          exchangePath: path || 'auth/oidc/login',
        });
      } catch (error) {
        // Une entrée invalide est ignorée bruyamment : mieux vaut un produit
        // absent du back-office qu'une URL douteuse dans la liste blanche.
        this.logger.error(`PRODUCTS : entrée « ${entry} » ignorée — ${String(error)}`);
      }
    }
    const summary = [...this.products.values()].map((p) => `${p.key}(${p.authMode})`).join(', ');
    this.logger.log(`Produits joignables : ${summary || 'aucun'}`);
  }

  get(key: string): Product | null {
    return this.products.get(key) ?? null;
  }

  list(): Product[] {
    return [...this.products.values()];
  }
}
