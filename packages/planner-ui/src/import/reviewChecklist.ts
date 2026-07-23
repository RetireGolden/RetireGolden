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

import type { ImportConfidence, ImportProvenanceEntry, ReviewerDecision, SourceLocator } from './provenance.ts'

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
  /** Engine plan path the value landed on (`accounts[3]`), when one field/record is addressable. */
  target?: string
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

/**
 * Split a review checklist into the `mappings`/`unresolved` halves of an
 * `ImportProvenanceExport`: `unmapped` and `skipped` items are the "add by
 * hand" unresolved list, everything that landed (`mapped`, `defaulted`) is a
 * mapping. Lives here — beside the status vocabulary the rule derives from —
 * so every envelope producer classifies items the same way.
 */
export function reviewToProvenance(items: ImportReviewItem[]): {
  mappings: ImportProvenanceEntry[]
  unresolved: ImportProvenanceEntry[]
} {
  const mappings: ImportProvenanceEntry[] = []
  const unresolved: ImportProvenanceEntry[] = []
  // Confidence fallback for items from producers predating the optional
  // fields: derived from the status so a landed value is never graded
  // 'unmapped' (which the contract defines as "nothing landed").
  const fallbackConfidence: Record<ImportItemStatus, ImportConfidence> = {
    mapped: 'exact',
    defaulted: 'assumed',
    unmapped: 'unmapped',
    skipped: 'unmapped',
  }
  for (const item of items) {
    const entry: ImportProvenanceEntry = {
      source: item.source,
      detail: item.detail,
      locator: item.locator ?? { kind: 'none', note: item.source },
      confidence: item.confidence ?? fallbackConfidence[item.status],
      ...(item.target ? { target: item.target } : {}),
      ...(item.decision ? { decision: item.decision } : {}),
    }
    if (item.status === 'unmapped' || item.status === 'skipped') unresolved.push(entry)
    else mappings.push(entry)
  }
  return { mappings, unresolved }
}
