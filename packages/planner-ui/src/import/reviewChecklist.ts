/**
 * Shared review-checklist model for every import mapper
 * (onboarding-import-and-migration). The rule that keeps mapping honest:
 * nothing imports silently — every value that lands in a draft plan, every
 * default the mapper had to invent, and every source item it could NOT map
 * becomes a visible review item.
 *
 * The structured provenance vocabulary lives in `provenance.ts` (the published
 * contract); this module imports it type-only. The dependency runs one way —
 * `provenance.ts` never imports from here — so there is no cycle.
 */

import type { ImportConfidence, ReviewerDecision, SourceLocator } from './provenance.ts'

export type ImportItemStatus = 'mapped' | 'defaulted' | 'unmapped' | 'skipped'

export interface ImportReviewItem {
  status: ImportItemStatus
  /** Where in the source this came from (file row, export field, 1040 line). */
  source: string
  /** What happened in the draft plan — or why nothing did and what to do instead. */
  detail: string
  /**
   * Structured provenance, additive over the human `source`/`detail` strings.
   * Optional so existing mappers stay valid; a mapper fills them in to feed the
   * `ImportProvenanceExport` envelope and the Pro/Advisor review workbench.
   */
  locator?: SourceLocator
  confidence?: ImportConfidence
  /** Left unset (i.e. `'pending'`) by the free planner; the workbench sets it. */
  decision?: ReviewerDecision
}

export const IMPORT_STATUS_LABEL: Record<ImportItemStatus, string> = {
  mapped: 'Imported',
  defaulted: 'Assumed — review',
  unmapped: 'Not imported — add by hand',
  skipped: 'Skipped',
}

/** Display order: what needs the user's eyes first. */
export const IMPORT_STATUS_ORDER: ImportItemStatus[] = ['unmapped', 'defaulted', 'mapped', 'skipped']

export function countByStatus(items: ImportReviewItem[]): Record<ImportItemStatus, number> {
  const counts: Record<ImportItemStatus, number> = { mapped: 0, defaulted: 0, unmapped: 0, skipped: 0 }
  for (const item of items) counts[item.status]++
  return counts
}
