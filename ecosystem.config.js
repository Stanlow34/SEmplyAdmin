/**
 * PM2 — production SEmplyAdmin.
 *
 * Seul le BFF tourne sous PM2 : l'interface (apps/web/dist) est statique,
 * servie par nginx sur admin.semply.fr. Déploiement type :
 *
 *   npm ci && npm run build
 *   pm2 start ecosystem.config.js && pm2 save
 *
 * Rechargement après build : `pm2 reload SEmplyAdminBFF`.
 *
 * ⚠️ Les sessions vivent en mémoire : un `reload` déconnecte les
 * administrateurs. C'est le prix du « aucun jeton ne quitte le processus ».
 */
module.exports = {
  apps: [
    {
      name: 'SEmplyAdminBFF',
      script: 'apps/api/dist/main.js',
      cwd: __dirname,
      instances: 1,
      // fork obligatoire, PAS cluster : les sessions sont en mémoire, deux
      // processus ne les partageraient pas et une requête sur deux échouerait.
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '200M',
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 8000,
      time: true,
      out_file: 'logs/bff.out.log',
      error_file: 'logs/bff.err.log',
      merge_logs: true,
    },
  ],
};
