import { Link } from 'react-router-dom'
import { getApiBase } from '@semplyadmin/http'

/**
 * Rendu du corps des articles, écrit en markdown restreint depuis le
 * back-office super admin.
 *
 * RÈGLE INTANGIBLE : ce module construit des composants React, jamais du HTML
 * depuis une chaîne. Aucun `dangerouslySetInnerHTML`, aucune balise saisie en
 * base n'est interprétée — un article contenant du HTML l'affichera comme du
 * texte. C'est ce qui permet de laisser un contenu de base arriver dans
 * l'application sans en faire une surface d'exécution de script : le jour où le
 * back-office serait compromis, l'attaquant peut publier un texte mensonger,
 * pas exécuter du code chez le lecteur.
 *
 * Syntaxe volontairement pauvre — tout ce qui n'est pas listé s'affiche tel quel :
 *
 *   ## Titre / ### Sous-titre
 *   Paragraphes séparés par une ligne vide
 *   - liste à puces          1. liste numérotée
 *   > encadré (une ou plusieurs lignes consécutives)
 *   | tableau | à | colonnes |   (ligne de séparation `| --- |` requise)
 *   ---                          (filet horizontal)
 *   **gras**  *italique*  [texte](https://…)  [texte](/route-interne)
 *   ![Légende](/v1/articles/images/…)   (illustration, déposée par le back-office)
 *   :::si app.menu.pa … :::sinon … :::   (contenu selon la formule du lecteur)
 *
 * Pas de titre de niveau 1 : le h1 de la page est le titre de l'article.
 */

/**
 * Rend le corps d'un article.
 *
 * @param body     markdown restreint (cf. en-tête)
 * @param can      `(cléFonctionnalité) => bool`, en général le `can` de
 *                 useEntitlements. Absent, les blocs conditionnels affichent
 *                 leur branche « sinon » — le repli sûr : c'est celle qui ne
 *                 promet rien que le lecteur n'a pas.
 * @param preview  rédaction : affiche LES DEUX branches, étiquetées, pour que
 *                 l'auteur relise ce que verra chaque lecteur.
 */
export function ArticleMarkdown({ body, can, preview = false }) {
  const blocks = parseBlocks(String(body ?? ''))
  return <Blocks blocks={blocks} can={can} preview={preview} />
}

/** Suite de blocs. Extraite pour que les blocs conditionnels s'y rappellent. */
function Blocks({ blocks, can, preview }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={index} block={block} can={can} preview={preview} />
      ))}
    </>
  )
}

function Block({ block, can, preview }) {
  switch (block.type) {
    case 'heading':
      return block.level === 2 ? (
        <h2>{inline(block.text)}</h2>
      ) : (
        <h3>{inline(block.text)}</h3>
      )

    case 'ul':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      )

    case 'ol':
      return (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ol>
      )

    case 'quote':
      // Contenu réanalysé en blocs : un encadré peut donc contenir une liste ou
      // un bloc conditionnel, ce dont la recommandation de plateforme a besoin
      // (l'appel à l'action diffère selon la formule du lecteur).
      return (
        <div className="article-callout">
          <Blocks blocks={block.blocks} can={can} preview={preview} />
        </div>
      )

    case 'conditional':
      if (preview) {
        // En rédaction, les deux branches sont montrées et étiquetées : c'est le
        // seul moyen de relire un texte qu'on ne verra jamais soi-même en entier.
        return (
          <div className="article-conditional">
            <p className="article-conditional-label">
              Affiché si la formule inclut « {block.feature} »
            </p>
            <Blocks blocks={block.then} can={can} preview={preview} />
            <p className="article-conditional-label">Sinon</p>
            <Blocks blocks={block.otherwise} can={can} preview={preview} />
          </div>
        )
      }
      return (
        <Blocks
          blocks={can?.(block.feature) ? block.then : block.otherwise}
          can={can}
          preview={preview}
        />
      )

    case 'table':
      return (
        // Un tableau de comparaison est plus large que la colonne de lecture :
        // il défile dans son propre conteneur plutôt que de faire défiler la page.
        <div className="article-table-wrap">
          <table className="article-table">
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i}>{inline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'image': {
      const src = imageSrc(block.src)
      // Source refusée : la ligne s'affiche telle quelle, comme un lien refusé.
      // Le rédacteur voit son erreur dans l'aperçu au lieu d'un cadre vide.
      if (!src) return <p>{block.raw}</p>
      return (
        <figure className="article-figure">
          <img src={src} alt={block.alt} loading="lazy" />
          {/* Pas de légende sans texte alternatif : une figure vide sous
              l'image ajouterait un blanc que personne n'a demandé. */}
          {block.alt && <figcaption>{block.alt}</figcaption>}
        </figure>
      )
    }

    case 'hr':
      return <hr />

    default:
      return <p>{inline(block.text)}</p>
  }
}

// Blocs conditionnels : `:::si <clé>` … `:::sinon` … `:::`.
// La clé est une fonctionnalité de formule (feature), celle-là même que le
// back-office coche dans /admin/plans — pas un nom inventé pour l'occasion.
const COND_START = /^:::\s*si\s+([A-Za-z0-9_.-]+)\s*$/
const COND_ELSE = /^:::\s*sinon\s*$/
const COND_END = /^:::\s*$/

// Illustration seule sur sa ligne : elle devient une figure légendée, à pleine
// largeur de la colonne de lecture. La même syntaxe au milieu d'un texte donne
// une image EN LIGNE (cf. `inline`) — un cas plus rare, mais qu'il vaut mieux
// rendre qu'afficher en clair au beau milieu d'une phrase.
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/

/**
 * Regroupe les lignes en blocs. Les lignes consécutives de même nature
 * fusionnent. Non exportée : le comportement se vérifie à travers le rendu
 * (markdown.test.jsx), et ce fichier n'expose qu'un composant.
 */
function parseBlocks(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let paragraph = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
      paragraph = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      continue
    }

    // Filet horizontal — testé avant le tableau, dont la ligne de séparation
    // commence par une barre verticale.
    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph()
      blocks.push({ type: 'hr' })
      continue
    }

    const conditional = COND_START.exec(trimmed)
    // Un bloc jamais refermé n'est PAS traité comme conditionnel : sa ligne
    // d'ouverture s'affiche alors telle quelle. Sans ce contrôle, un `:::`
    // oublié avalerait silencieusement toute la fin de l'article, et le
    // rédacteur ne verrait la disparition que sur la formule d'en face.
    if (conditional && hasTerminator(lines, i + 1)) {
      flushParagraph()
      const branches = { then: [], otherwise: [] }
      let target = branches.then
      i++

      while (i < lines.length) {
        const current = lines[i].trim()
        if (COND_END.test(current)) break
        if (COND_ELSE.test(current)) {
          target = branches.otherwise
          i++
          continue
        }
        target.push(lines[i])
        i++
      }

      blocks.push({
        type: 'conditional',
        feature: conditional[1],
        then: parseBlocks(branches.then.join('\n')),
        otherwise: parseBlocks(branches.otherwise.join('\n')),
      })
      continue
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph()
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      i-- // la boucle externe incrémente à son tour
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      flushParagraph()
      const items = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''))
        i++
      }
      i--
      blocks.push({ type: 'ol', items })
      continue
    }

    if (trimmed.startsWith('>')) {
      flushParagraph()
      const quoteLines = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      i--
      // Chaque ligne devient son propre paragraphe (d'où la ligne vide
      // intercalée) : dans un encadré, un retour à la ligne est voulu — la
      // première ligne sert de titre. Passer par parseBlocks lui donne malgré
      // tout accès aux listes et aux blocs conditionnels.
      blocks.push({
        type: 'quote',
        blocks: parseBlocks(quoteLines.filter(Boolean).join('\n\n')),
      })
      continue
    }

    if (trimmed.startsWith('|')) {
      flushParagraph()
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i].trim()))
        i++
      }
      i--

      // Un tableau sans ligne de séparation n'est pas un tableau : on préfère
      // afficher les lignes telles quelles plutôt que de deviner un en-tête.
      const isSeparator = (cells) => cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c))
      if (rows.length >= 2 && isSeparator(rows[1])) {
        blocks.push({ type: 'table', head: rows[0], rows: rows.slice(2) })
      } else {
        for (const row of rows) blocks.push({ type: 'paragraph', text: row.join(' | ') })
      }
      continue
    }

    const image = IMAGE_LINE.exec(trimmed)
    if (image) {
      flushParagraph()
      // `raw` : de quoi réafficher la ligne si la source est refusée au rendu.
      blocks.push({ type: 'image', alt: image[1], src: image[2], raw: trimmed })
      continue
    }

    paragraph.push(trimmed)
  }

  flushParagraph()
  return blocks
}

/**
 * Un bloc conditionnel ouvert à `from - 1` est-il refermé ?
 *
 * Une nouvelle ouverture rencontrée avant la fermeture répond non : les blocs
 * conditionnels ne s'imbriquent pas, et rattacher le `:::` d'un bloc suivant à
 * celui-ci produirait un découpage que personne n'a écrit.
 */
function hasTerminator(lines, from) {
  for (let i = from; i < lines.length; i++) {
    const line = lines[i].trim()
    if (COND_END.test(line)) return true
    if (COND_START.test(line)) return false
  }
  return false
}

/** « | a | b | » → ['a', 'b'] */
function splitRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * Rendu du texte d'une ligne : gras, italique, liens, images. Retourne un
 * tableau de noeuds React — jamais de chaîne HTML.
 */
function inline(text) {
  const nodes = []
  // Un seul balayage, avec une alternative ORDONNÉE : l'image (`![…](…)`) est
  // testée avant le lien, dont elle contient le motif — sans cela, `![x](y)`
  // rendrait un point d'exclamation suivi d'un lien. Le gras (`**`) est testé
  // avant l'italique (`*`) pour que `**mot**` ne soit pas vu comme un italique
  // vide suivi d'un mot.
  const pattern =
    /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g

  let last = 0
  let match
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))

    const [raw, imageAlt, imageHref, linkText, href, bold, italic] = match
    if (imageHref !== undefined) {
      // `imageHref` et non `imageAlt` : un texte alternatif vide est légitime
      // (image décorative), et `''` ne se distingue pas d'une absence.
      nodes.push(renderImage(imageAlt, imageHref, key++, raw))
    } else if (linkText !== undefined) {
      nodes.push(renderLink(linkText, href, key++, raw))
    } else if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>)
    } else {
      nodes.push(<em key={key++}>{italic}</em>)
    }

    last = match.index + raw.length
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/**
 * Lien d'article. Trois cas, et un seul non négociable :
 *  - `/route` → navigation interne (react-router), sans rechargement ;
 *  - `http(s)://…` → lien externe, nouvel onglet, `rel` complet ;
 *  - TOUT LE RESTE → affiché en texte brut. C'est ici que se joue la sûreté du
 *    contenu venu de la base : un `javascript:` ou un `data:` n'a aucune chance
 *    de devenir un href.
 */
function renderLink(label, href, key, raw) {
  if (href.startsWith('/')) {
    // Un `//` ouvrirait sur un autre domaine avec le protocole courant.
    if (href.startsWith('//')) return raw
    return (
      <Link key={key} to={href}>
        {label}
      </Link>
    )
  }

  if (/^https?:\/\//i.test(href)) {
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    )
  }

  return raw
}

/** Image en ligne. Source refusée → la syntaxe s'affiche en clair. */
function renderImage(alt, href, key, raw) {
  const src = imageSrc(href)
  if (!src) return raw
  return (
    <img key={key} className="article-inline-image" src={src} alt={alt} loading="lazy" />
  )
}

/**
 * Source d'une image, ou `null` si elle est refusée. Même arbitrage que
 * `renderLink`, avec une différence : le chemin racine n'est pas une route de
 * l'application mais un chemin de l'API.
 *
 *  - `/v1/articles/images/…` → résolu contre la racine de l'API. Les
 *    illustrations sont servies PAR le serveur (cf. article-images.ts), qui
 *    n'est pas toujours sur l'origine du front : en développement, le serveur
 *    Vite ne proxifie que `/api`. Résoudre ici plutôt qu'écrire une URL absolue
 *    en base garde les articles indépendants du domaine.
 *  - `http(s)://…` → gardé tel quel, pour une image hébergée ailleurs.
 *  - TOUT LE RESTE → refusé. `javascript:`, `data:` (un SVG encodé y passerait)
 *    et `//autre-domaine` n'ont aucune chance de devenir un `src`.
 */
function imageSrc(href) {
  if (href.startsWith('/') && !href.startsWith('//')) return `${getApiBase()}${href}`
  if (/^https?:\/\//i.test(href)) return href
  return null
}

export default ArticleMarkdown
