import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

/**
 * Garde-fou de l'architecture.
 *
 * Les trois règles du README tiennent à des ABSENCES, et une absence ne se voit
 * pas à la relecture. Ce fichier les rend visibles.
 *
 * Le jour où quelqu'un — moi compris — reprendra un écran depuis un produit et
 * recopiera au passage un `PrismaService` ou un `getCompanyHeaders()`, c'est ce
 * test qui le dira.
 */

function sourceFiles(dir = SRC) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

/** Le CODE seul : les commentaires expliquent volontiers ce qui a été retiré. */
const codeOf = (file) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const files = sourceFiles();

describe('isolation du back-office', () => {
  it('trouve bien les sources à inspecter', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each([
    ['un accès base', /PrismaClient|PrismaService|DATABASE_URL|pg\.Pool/],
    ['la portée société', /getCompanyHeaders|companyScope|x-company-id/],
    ['la portée espace', /getSpaceHeaders|spaceScope|x-space-id/],
    ['les cookies de portée partagés', /semply_active_(company|space)/],
    ['un en-tête Authorization', /Authorization['"]?\s*:/],
  ])('ne contient jamais %s', (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(codeOf(f))).map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it('ne code en dur aucune URL d’API de produit hors du registre', () => {
    // Le registre (products.js) est le SEUL endroit qui connaît les adresses.
    const allowed = new Set(['lib/products.js']);
    const offenders = files
      .filter((f) => !allowed.has(relative(SRC, f).replace(/\\/g, '/')))
      .filter((f) => /https:\/\/api[-.]/.test(codeOf(f)))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
