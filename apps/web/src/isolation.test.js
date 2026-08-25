import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const WEB = resolve(process.cwd(), 'src');
const API = resolve(process.cwd(), '../api/src');

/**
 * Garde-fou de l'architecture.
 *
 * Les règles du README tiennent à des ABSENCES, et une absence ne se voit pas à
 * la relecture. Ce fichier les rend visibles, des deux côtés du BFF.
 *
 * La séparation des rôles est le point sensible : côté navigateur il ne doit
 * JAMAIS y avoir de jeton (c'est tout l'intérêt du BFF) ; côté serveur il ne
 * doit jamais y avoir d'accès base ni d'URL en dur.
 */

function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [full] : [];
  });
}

/** Le CODE seul : les commentaires expliquent volontiers ce qui a été retiré. */
const codeOf = (file) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const webFiles = sourceFiles(WEB);
const apiFiles = sourceFiles(API);

describe('interface — aucun secret dans le navigateur', () => {
  it('trouve bien les sources à inspecter', () => {
    expect(webFiles.length).toBeGreaterThan(3);
  });

  it.each([
    ['un jeton porté à la main', /Authorization['"]?\s*:/],
    ['un stockage navigateur', /localStorage|sessionStorage/],
    ['un accès base', /PrismaClient|PrismaService|DATABASE_URL/],
    ['la portée société', /getCompanyHeaders|companyScope|x-company-id/],
    ['les cookies de portée partagés', /semply_active_(company|space)/],
  ])('ne contient jamais %s', (_label, pattern) => {
    const offenders = webFiles.filter((f) => pattern.test(codeOf(f))).map((f) => relative(WEB, f));
    expect(offenders).toEqual([]);
  });

  it('n’appelle jamais une API de produit en direct', () => {
    // Tout passe par /api sur la même origine. Une URL absolue ici signifierait
    // qu'on a contourné le relais — donc qu'un jeton devrait vivre dans la page.
    const offenders = webFiles
      .filter((f) => /https?:\/\/(api|api-)/.test(codeOf(f)))
      .map((f) => relative(WEB, f));
    expect(offenders).toEqual([]);
  });
});

describe('relais — aucune logique métier, aucun accès base', () => {
  it('trouve bien les sources à inspecter', () => {
    expect(apiFiles.length).toBeGreaterThan(3);
  });

  it('ne contient aucun accès base', () => {
    const offenders = apiFiles
      .filter((f) => /PrismaClient|PrismaService|DATABASE_URL|pg\.Pool/.test(codeOf(f)))
      .map((f) => relative(API, f));
    expect(offenders).toEqual([]);
  });

  it('ne code en dur aucune URL de produit hors du registre', () => {
    // `registry/` est la liste blanche ; `auth/oidc.service.ts` porte l'adresse
    // du portail, qui n'est pas un produit relayé.
    const allowed = new Set(['registry/products.service.ts', 'auth/oidc.service.ts']);
    const offenders = apiFiles
      .filter((f) => !allowed.has(relative(API, f).replace(/\\/g, '/')))
      .filter((f) => /https?:\/\/[a-z-]*\.semply\.fr/.test(codeOf(f)))
      .map((f) => relative(API, f));
    expect(offenders).toEqual([]);
  });
});
