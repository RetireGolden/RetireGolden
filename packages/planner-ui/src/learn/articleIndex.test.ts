/**
 * The drift guard for the metadata/body split.
 *
 * An article is now two things in two places: an entry in articleIndex.ts and
 * a body module under content/ wired into articleBodies.ts. Nothing at build
 * time forces the two to agree — an index entry with no body would render an
 * article page with an empty body, and a body module with no index entry would
 * be dead weight nobody can reach. These tests are what catches either.
 */
import { describe, expect, it } from 'vitest'
import { ARTICLE_BODY_SLUGS, loadArticleBody } from './articleBodies'
import { ARTICLE_INDEX } from './articleIndex'
import type { ArticleBlock } from './learningRegistry'

type ContentModule = { blocks?: ArticleBlock[]; EXAMPLE_PLAN_BODIES?: Record<string, ArticleBlock[]> }

/** Body modules on disk, so an orphaned file is caught as well as an orphaned loader. */
const contentModules = import.meta.glob<ContentModule>('./content/*.ts')

describe('article index and bodies', () => {
  it('gives every index entry a body loader', () => {
    const loaders = new Set(ARTICLE_BODY_SLUGS)
    const missing = ARTICLE_INDEX.filter((a) => !loaders.has(a.slug)).map((a) => a.slug)
    expect(missing, 'index entries with no body loader in articleBodies.ts').toEqual([])
  })

  it('gives every body loader an index entry', () => {
    const indexed = new Set(ARTICLE_INDEX.map((a) => a.slug))
    const orphaned = ARTICLE_BODY_SLUGS.filter((slug) => !indexed.has(slug))
    expect(orphaned, 'body loaders with no entry in articleIndex.ts').toEqual([])
  })

  it('has unique slugs in the index', () => {
    const slugs = ARTICLE_INDEX.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('loads a non-empty body for every article', async () => {
    const empty: string[] = []
    for (const article of ARTICLE_INDEX) {
      const blocks = await loadArticleBody(article.slug)
      if (!blocks?.length) empty.push(article.slug)
    }
    expect(empty, 'articles whose body module resolved to nothing').toEqual([])
  })

  it('reaches every content module from a body loader', async () => {
    // A content file no loader names is dead weight nobody can read. Compared
    // by identity: the loaders and the glob resolve the same module instances,
    // so a body that ships is the very array the module exports.
    const shipped = new Set(await Promise.all(ARTICLE_INDEX.map((a) => loadArticleBody(a.slug))))

    const unreachable: string[] = []
    for (const [path, load] of Object.entries(contentModules)) {
      const module = await load()
      const bodies = module.EXAMPLE_PLAN_BODIES ? Object.values(module.EXAMPLE_PLAN_BODIES) : [module.blocks]
      if (bodies.length === 0 || !bodies.every((blocks) => blocks && shipped.has(blocks))) unreachable.push(path)
    }
    expect(unreachable, 'content modules no body loader imports').toEqual([])
  })
})
