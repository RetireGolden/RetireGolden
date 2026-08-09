/**
 * Cite-the-authority helper (trust-and-transparency-layer, step 5): turns a
 * `PARAMETER_PROVENANCE` entry into the `source` link a field's ⓘ bubble
 * shows, so key tax parameters cite their Rev. Proc. / statute / agency figure
 * right where the number is used — not only on the Disclaimer page.
 *
 * Also maps engine citation strings (Treas. Reg. §…, eCFR section form) to
 * eCFR URLs for inherited-IRA schedule surfaces. Unmapped citations stay plain
 * text — never a broken link.
 */

import { PARAMETER_PROVENANCE } from '@retiregolden/engine/params'
import type { SourceLink } from './fields'

const BY_ID = new Map(PARAMETER_PROVENANCE.map((s) => [s.id, s]))

/**
 * Source link for a provenance group id. Throws in dev if the id drifts; in
 * production a drifted id degrades to the full source table on the Disclaimer
 * page instead of crashing the screen the field lives on.
 */
export function provenanceSource(id: string): SourceLink {
  const entry = BY_ID.get(id)
  if (!entry) {
    if (import.meta.env.DEV) throw new Error(`Unknown provenance id "${id}", see engine/params/provenance.ts`)
    return { label: 'source list', url: '/disclaimer' }
  }
  return { label: entry.publisher, url: entry.url }
}

/**
 * Base eCFR section for a Treas. Reg. citation. Subparagraph suffixes
 * (e.g. `(d)(1)(i)–(ii)`) fall outside the section stem so the link targets
 * the published section page. Returns null when the string is not a mappable
 * Treasury regulation (IRC, Notices, internal docs stay unlinked).
 */
export function citationHref(citation: string): string | null {
  // Treas. Reg. §1.401(a)(9)-5(d)(1)(i)–(ii)  →  section-1.401(a)(9)-5
  // Treas. Reg. §1.408A-6, A-14(b)             →  section-1.408A-6
  // Treas. Reg. §1.408-8(c)(2)                 →  section-1.408-8
  // The stem is `1.<id>-<n>` before any trailing subparagraph suite.
  const treas = citation.match(/Treas\.?\s*Reg\.?\s*§?\s*(1\.[0-9A-Za-z()]+-\d+)/i)
  if (treas?.[1]) {
    return `https://www.ecfr.gov/current/title-26/section-${treas[1]}`
  }
  return null
}

/**
 * Map a citation string to a SourceLink when a URL is known; otherwise null
 * so callers render plain text instead of a dead href.
 */
export function citationSource(citation: string): SourceLink | null {
  const url = citationHref(citation)
  if (!url) return null
  return { label: citation, url }
}
