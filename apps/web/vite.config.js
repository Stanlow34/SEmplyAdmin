import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // GARDE-FOU. Dans un monorepo, Vite remonte volontiers chercher un `.env` à
  // la racine — qui contiendrait ici les secrets des autres paquets. On fige
  // donc le répertoire d'environnement sur CE paquet, et on garde le préfixe
  // par défaut : seules les variables `VITE_*` de `apps/web/.env` sont exposées
  // au bundle. Ne jamais élargir `envPrefix`, ne jamais définir `process.env`.
  envDir: here,
  envPrefix: 'VITE_',

  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
