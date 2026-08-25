# SEmplyAdmin

Back-office **unique** de la suite SEmply, servi sur `admin.semply.fr`.

## Forme

Une interface statique et un relais, sur la **même origine**.

```
admin.semply.fr  →  nginx
      ├── /            dist/ statique                (aucun processus)
      └── /api/        BFF, 127.0.0.1:3010           (PM2 : SEmplyAdminBFF)
                          │  Authorization: Bearer
                          ├── api.semply.fr/api/admin/*      SEmplyApp
                          ├── api-auth.semply.fr/admin/*     AuthSEmply
                          ├── api-compta.semply.fr/admin/*   SEmplyCompta
                          └── api-previ.semply.fr/admin/*    SEmplyPrevi
```

**Pourquoi un relais plutôt qu'une SPA seule.** Un jeton bearer tenu par le
JavaScript est exfiltrable : une XSS le vole et l'attaquant s'en sert depuis sa
machine. Ici le navigateur ne reçoit qu'un identifiant de session opaque, dans
un cookie httpOnly *host-only* — les jetons OIDC ne quittent jamais le
processus. C'est la propriété que `admin-origin.ts` cherchait à obtenir côté
SEmplyApp, obtenue cette fois sans empêcher de franchir les produits.

Prix payé, assumé : un processus Node (~150 Mo) et une cible de valeur à
protéger.

## Les quatre règles

**1. Zéro accès base.** Ni ici ni dans le relais : aucun Prisma, aucun
`DATABASE_URL`. Chaque écriture passe par le service métier du produit
propriétaire — donc par son AuditInterceptor, son chiffrement, ses règles.

**2. Les contrôleurs `admin/` restent chez le produit.** Seuls les écrans
migrent. Ce dépôt n'héberge jamais de logique métier, et le relais ne
transforme rien.

**3. Le relais ne relaie que ce qui est déclaré.** Le navigateur choisit une
**clé** de produit, jamais une URL — sinon `/api/p/:product/*` serait une SSRF.
Et seuls les chemins sous `admin/` passent.

**4. Un endpoint qui doit survivre à l'arrêt d'un produit n'appartient pas à ce
produit.** Identité, rôles, MFA → AuthSEmply. Support et facturation →
transverse. Le reste meurt avec son produit, et c'est voulu.

Ces règles sont vérifiées par `apps/web/src/isolation.test.js`, qui inspecte
les deux paquets.

## Organisation

```
apps/web/    interface — ne connaît aucune URL d'API, ne détient aucun jeton
  src/shell/       navigation, session, garde par menu
  src/lib/         client vers /api, registre, droits
  src/transverse/  écrans qui survivent à l'arrêt d'un produit
  src/products/    un module de routes par produit, chargé à la demande
apps/api/    relais — OIDC, sessions en mémoire, liste blanche, proxy
packages/admin-http/   fabrique de client axios
```

Un module produit est **détachable** : supprimer son dossier et son entrée dans
`products/index.js` retire le produit du back-office.

## Mise en service

1. Déclarer `semply-admin` comme client **confidentiel** dans le catalogue OIDC
   d'AuthSEmply, `redirectUris = https://admin.semply.fr/api/auth/callback`.
2. `cp apps/api/.env.example apps/api/.env`, renseigner `OIDC_CLIENT_SECRET` et
   `PRODUCTS`.
3. `npm ci && npm run build`, puis `pm2 start ecosystem.config.js`.
4. nginx : voir `nginx.admin.semply.fr.conf.example`.

## État

Squelette fonctionnel côté relais, **zéro écran** côté interface. Les écrans
sont repris progressivement depuis `SEmplyApp/admin/`, qui reste en service sur
`adminv2.semply.fr` jusqu'à la bascule.

## Deux régimes d'authentification

SEmplyCompta et SEmplyPrevi valident les jetons du portail contre son JWKS
(`@semply/auth`) : le relais leur présente directement l'access token.

SEmplyApp ne fait **délibérément pas** confiance aux jetons du portail pour
l'autorisation — son `oidc-exchange.service.ts` le dit : *« Seules les claims
d'IDENTITÉ en sortent ; entitlements, quotas et rôles restent calculés par
SEmplyApp »*. Le relais fait donc pour lui le même échange que le navigateur :
POST de l'`id_token` sur `/api/auth/oidc/login`, puis usage du jeton qu'il
émet. **Aucune modification du modèle d'authentification de SEmplyApp n'est
nécessaire** — sa `JwtStrategy` accepte déjà `Authorization: Bearer`, et le
jeton présenté est un jeton qu'il a signé lui-même.

Deux prérequis de configuration côté SEmplyApp, sans code :

- l'`audience` acceptée par `oidc-exchange.service.ts` doit inclure
  `semply-admin` en plus de `semply-app` ;
- `ADMIN_ORIGIN` doit désigner un hôte d'API dédié (`adminapi.semply.fr`)
  routé par nginx vers le même NestJS, car `adminOnly()` compare le *host de la
  requête* — un appel du relais arrive sur l'hôte d'API, pas sur
  admin.semply.fr.

**Reste à faire côté AuthSEmply** : la matrice rôle → menus vit encore dans la
base de SEmplyApp. Tant qu'elle y est, `apps/web/src/lib/access.js` interroge
SEmplyApp — et SEmplyApp reste un point de défaillance unique pour
l'administration des quatre produits.
