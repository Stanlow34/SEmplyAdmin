# SEmplyAdmin

Back-office **unique** de la suite SEmply, servi sur `admin.semply.fr`.

## Ce que ce dépôt est

Un client d'agrégation. Il ne contient que du React : il appelle en HTTP les API
d'administration de chaque produit, avec la session SSO portée par le cookie posé
sur `.semply.fr`.

```
admin.semply.fr  →  nginx  →  dist/ statique       (aucun processus, aucun PM2)
      │
      └── XHR (credentials: include)
            ├── api.semply.fr/api/admin/*     SEmplyApp
            ├── api-auth.semply.fr/admin/*    AuthSEmply
            ├── api-compta.semply.fr/…        SEmplyCompta
            └── api-previ.semply.fr/…         SEmplyPrevi
```

## Les trois règles qui tiennent l'architecture

**1. Zéro accès base.** Aucun Prisma, aucun `DATABASE_URL`, aucun processus
serveur. Chaque écriture passe par le service métier du produit propriétaire —
donc par son AuditInterceptor, son chiffrement, ses règles. Copier un contrôleur
ici créerait deux vérités sur les mêmes tables.

**2. Les contrôleurs `admin/` restent chez le produit.** Seuls les écrans
migrent. Ce dépôt n'héberge jamais de logique métier.

**3. Un endpoint qui doit survivre à l'arrêt d'un produit n'appartient pas à ce
produit.** C'est le test à appliquer avant d'ajouter une route côté serveur.
Identité, rôles, MFA → AuthSEmply. Support et facturation → transverse. Le reste
meurt avec son produit, et c'est voulu.

## Organisation

```
apps/web/src/
  shell/        coquille : navigation, session, garde par menu
  lib/          registre des produits, fabrique de clients HTTP
  transverse/   écrans qui survivent à l'arrêt d'un produit
  products/     un module de routes par produit, chargé à la demande
packages/admin-http/   client axios partagé (refresh 401, credentials)
```

Un module produit est **détachable** : supprimer son dossier retire le produit du
back-office, sans toucher au reste.

## État

Squelette. Les écrans sont repris progressivement depuis `SEmplyApp/admin/`,
qui reste en service sur `adminv2.semply.fr` jusqu'à la bascule.
