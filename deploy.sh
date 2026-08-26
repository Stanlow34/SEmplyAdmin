#!/usr/bin/env bash
#
# Déploiement SEmplyAdmin — le back-office de la suite, sur CE VPS.
#
#   ./deploy.sh
#
# Pas de FTP ici, et ce n'est pas un oubli : l'interface DOIT être servie
# par le même nginx que le relais, sur la même origine (admin.semply.fr) —
# c'est ce qui permet le cookie de session host-only et l'absence totale
# de CORS. Le script copie donc le front dans la racine web locale, lue
# dans .env (WEB_ROOT).
#
# Même convention que AuthSEmply : s'arrête à la première erreur, les
# secrets vivent dans apps/api/.env, jamais ici — ce script est versionné.
#
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1m── %s\033[0m\n' "$*"; }
ok()  { printf '   \033[32m✔\033[0m %s\n' "$*"; }
die() { printf '   \033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

envval() {
  grep -E "^[[:space:]]*$1=" apps/api/.env 2>/dev/null | tail -1 | sed -E 's/^[^=]*=//; s/^["'\'']//; s/["'\'']$//'
}

[ -f apps/api/.env ] || die "apps/api/.env absent — voir apps/api/.env.example"

PORT=$(envval PORT); PORT=${PORT:-3010}
WEB_ROOT=$(envval WEB_ROOT); WEB_ROOT=${WEB_ROOT:-/var/www/admin.semply.fr}
PRODUCTS=$(envval PRODUCTS)
[ -n "$PRODUCTS" ] || die "apps/api/.env ne définit pas PRODUCTS — le relais n'aurait aucune liste blanche"
[ -d "$WEB_ROOT" ] || die "WEB_ROOT ($WEB_ROOT) n'existe pas — créer le dossier et le vhost d'abord (nginx.admin.semply.fr.conf.example)"

# ── 1. Code ─────────────────────────────────────────────────────────────
say "Code"
git pull --ff-only
ok "git : $(git log --oneline -1)"
npm ci --no-audit --no-fund >/dev/null
ok "dépendances installées"

# ── 2. Builds ───────────────────────────────────────────────────────────
say "Builds"
npm run build >/dev/null
[ -f apps/api/dist/main.js ] || die "apps/api/dist/main.js absent du build"
[ -f apps/web/dist/index.html ] || die "apps/web/dist/index.html absent du build"
ok "relais + interface construits"

# ── 3. Interface — copie atomique vers la racine web ───────────────────
# rsync --delete : la racine reflète exactement le build, rien ne traîne.
say "Interface"
rsync -a --delete apps/web/dist/ "$WEB_ROOT"/
ok "interface déposée dans $WEB_ROOT"

# ── 4. Relais ───────────────────────────────────────────────────────────
# ⚠ Les sessions vivent en mémoire (c'est le principe : les jetons ne
# quittent jamais le processus) : ce reload déconnecte les administrateurs.
# À quelques comptes, c'est une reconnexion — pas un incident.
say "Relais"
pm2 startOrReload ecosystem.config.js --only SEmplyAdminBFF --update-env >/dev/null
for i in $(seq 1 20); do
  curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/api/health" && break
  [ "$i" = 20 ] && die "le relais ne répond pas sur :${PORT}/api/health — voir pm2 logs SEmplyAdminBFF"
  sleep 1
done
ok "relais en ligne (:${PORT}/api/health)"
pm2 save >/dev/null

# ── 5. Ce que voit réellement un navigateur ────────────────────────────
say "Contrôle"
if curl -fsS "http://127.0.0.1:${PORT}/api/p" | grep -q '"key"'; then
  ok "liste blanche servie — produits déclarés : $(curl -fsS http://127.0.0.1:${PORT}/api/p | grep -o '"key":"[^"]*"' | cut -d'"' -f4 | paste -sd', ' -)"
else
  printf '   \033[33m⚠ /api/p ne renvoie aucun produit — vérifier PRODUCTS dans apps/api/.env\033[0m\n'
fi

say "Terminé — back-office déployé"
ok "https://admin.semply.fr (les administrateurs connectés devront se reconnecter)"
