import { Injectable, Logger } from '@nestjs/common';

export interface Product {
  key: string;
  name: string;
  apiBaseUrl: string;
}

/**
 * Registre des produits joignables par le relais.
 *
 * C'est la LISTE BLANCHE du proxy : le navigateur ne choisit jamais une URL,
 * il choisit une CLÉ. Sans cela, `/api/p/:product/*` serait une SSRF offerte —
 * n'importe qui muni d'une session d'admin ferait émettre au serveur des
 * requêtes vers l'hôte de son choix, depuis le réseau interne.
 *
 * Source : `PRODUCTS` en environnement, au format `clé=url,clé=url`. Le
 * catalogue OIDC d'AuthSEmply porte `productUrl` (l'URL publique du produit,
 * pour le portail) mais pas l'adresse de son API — le jour où une colonne
 * `apiBaseUrl` y sera ajoutée, ce service la lira au démarrage et cette
 * variable deviendra un simple repli.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly products = new Map<string, Product>();

  constructor() {
    const raw = process.env.PRODUCTS ?? '';
    for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [key, url] = entry.split('=').map((s) => s?.trim());
      if (!key || !url) continue;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
          throw new Error('https requis en production');
        }
        this.products.set(key, { key, name: key, apiBaseUrl: url.replace(/\/$/, '') });
      } catch (error) {
        // Une entrée invalide est ignorée bruyamment : mieux vaut un produit
        // absent du back-office qu'une URL douteuse dans la liste blanche.
        this.logger.error(`PRODUCTS : entrée « ${entry} » ignorée — ${String(error)}`);
      }
    }
    this.logger.log(`Produits joignables : ${[...this.products.keys()].join(', ') || 'aucun'}`);
  }

  get(key: string): Product | null {
    return this.products.get(key) ?? null;
  }

  list(): Product[] {
    return [...this.products.values()];
  }
}
