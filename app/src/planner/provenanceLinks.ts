/**
 * Cite-the-authority helper (trust-and-transparency-layer, step 5): turns a
 * `PARAMETER_PROVENANCE` entry into the `source` link a field's ⓘ bubble
 * shows, so key tax parameters cite their Rev. Proc. / statute / agency figure
 * right where the number is used — not only on the Disclaimer page.
 */

import { PARAMETER_PROVENANCE } from '../engine/params'
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
    if (import.meta.env.DEV) throw new Error(`Unknown provenance id "${id}" — see engine/params/provenance.ts`)
    return { label: 'source list', url: '/disclaimer' }
  }
  return { label: entry.publisher, url: entry.url }
}
