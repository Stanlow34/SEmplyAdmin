# SEmplyAdmin

> [!IMPORTANT]
> **Dépôt parké depuis le 27 août 2026. Ce n'est pas la version courante des
> écrans d'administration.**
>
> Le back-office unique a été abandonné au profit d'**un back-office par
> produit** : garder les sites vraiment indépendants, pour qu'un produit qu'on
> arrête puisse mourir seul sans emporter l'administration des autres. La seule
> couture prévue entre eux est un contrat de tickets
> (`CONTRAT-TICKETS.md`, présent dans chaque produit), en vue d'un
> éventuel site support unique.
>
> **Où sont les écrans, alors.** Les 16 écrans de `apps/web/src/` sont des
> COPIES de ceux de SEmplyApp — la seule différence tenait aux chemins
> d'import. Les originaux n'ont jamais bougé : ils sont dans
> `SEmplyApp/admin/src/pages/`, servis par `adminv2`, et c'est là qu'il faut
> les modifier. Toute correction faite ici serait perdue.
>
> **Ce qui reste utile ici**, le jour où le site support centralisé existera :
> le patron BFF (session serveur, jetons OIDC jamais exposés au navigateur),
> la liste blanche du proxy, les tests d'isolation, le `deploy.sh` rsync en
> même origine. Le client OIDC `semply-admin` a en revanche été **retiré** du
> catalogue d'AuthSEmply : ses URI de redirection pointaient vers un hôte qui
> n'existera pas.
>
> Rien ici n'est déployé ni lancé. Ne pas y revenir sans avoir relu ce bloc.

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

Les **16 écrans** sont repris de `SEmplyApp/admin/` : 8 transverses
(`src/transverse/`) et 8 propres à SEmplyApp (`src/products/semplyapp/`),
chacun chargé à la demande. `apps/web` et `apps/api` compilent, et le test
d'isolation passe (10 assertions).

Non vérifié en conditions réelles : rien n'a encore parlé à une vraie API.

Une limite connue : la preuve d'identité **« Confirmer avec Google »** n'est pas
disponible depuis ce back-office. C'est une navigation de premier niveau dont le
retour pose des cookies sur le domaine du produit — un relais qui transmet des
requêtes fetch ne sait pas la conduire. Le mot de passe reste disponible pour le
mode sudo ; un compte sans mot de passe utilisable devra en poser un, ou
attendre le déplacement de la preuve d'identité vers le portail, qui l'a de
toute façon déjà conduite une fois à la connexion.

**Reste à faire côté AuthSEmply** : la matrice rôle → menus vit encore dans la
base de SEmplyApp. Tant qu'elle y est, `hooks/useAdminAccess.js` interroge
SEmplyApp — et SEmplyApp reste un point de défaillance unique pour
l'administration des quatre produits.
