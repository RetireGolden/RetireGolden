import { describe, expect, it } from 'vitest'

import { ARTICLE_EDITORIAL } from '../testSupport/articleEditorial'
import { ARTICLE_INDEX } from './articleIndex'

/**
 * Editorial review metadata (audience, review cadence, current-year
 * sensitivity) lives in the test-only sidecar ../testSupport/articleEditorial.ts
 * rather than in the index, which ships to every visitor on the landing path
 * and carries only what pages read. These keep the two in step.
 */

const EDITORIAL_FIELDS = ['audience', 'reviewCadence', 'currentYearSensitive'] as const

describe('Learning Center editorial sidecar', () => {
  it('has an editorial entry for every index slug, and none for a slug the index lacks', () => {
    const indexSlugs = ARTICLE_INDEX.map((article) => article.slug)
    const editorialSlugs = Object.keys(ARTICLE_EDITORIAL)
    expect(indexSlugs.filter((slug) => !(slug in ARTICLE_EDITORIAL))).toEqual([])
    expect(editorialSlugs.filter((slug) => !indexSlugs.includes(slug))).toEqual([])
    // Same order as the index, so a reviewer reads both lists the same way.
    expect(editorialSlugs).toEqual(indexSlugs)
  })

  it('keeps every editorial field out of the index', () => {
    const carriers = ARTICLE_INDEX.flatMap((article) =>
      EDITORIAL_FIELDS.filter((field) => field in article).map((field) => `${article.slug}.${field}`),
    )
    expect(carriers).toEqual([])
  })

  it('gives every entry all three fields with a known value', () => {
    for (const [slug, editorial] of Object.entries(ARTICLE_EDITORIAL)) {
      expect(['beginner', 'intermediate'], slug).toContain(editorial.audience)
      expect(['annual', 'rule-change', 'stable'], slug).toContain(editorial.reviewCadence)
      expect(typeof editorial.currentYearSensitive, slug).toBe('boolean')
    }
  })
})
