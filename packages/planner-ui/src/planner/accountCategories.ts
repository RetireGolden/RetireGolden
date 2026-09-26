/**
 * The account-category vocabulary the balance charts are drawn from: which
 * types are stacked, what each is called, and which chart slot it wears.
 *
 * One module because the screen (`ResultsPage`) and the printed report
 * (`ReportPage`) plot the same chart and used to carry byte-identical copies of
 * it. The palette assignment is a design decision, not an arbitrary one
 * (DESIGN.md pins gold at chart-1 and green at chart-3, and forbids pairing
 * gold with amber), so two copies of it could drift with nothing catching the
 * drift.
 *
 * No money math here: the per-year category balances are the engine's
 * `balancesByCategory` (one value per logical account), and the unassigned
 * cash band is the engine's `unassignedCash`. This module only names and
 * colours them.
 */

import type { YearResult } from '@retiregolden/engine/projection/types'
import { BALANCE_CATEGORIES, unassignedCash, type BalanceCategory } from '@retiregolden/engine/projection/yearFigures'

/** Account types the balance chart stacks, bottom to top (the engine's own order). */
export const ACCOUNT_CATEGORIES = BALANCE_CATEGORIES

export type AccountCategory = BalanceCategory

/** What each stacked category is called in a legend or a tooltip. */
export const ACCOUNT_CATEGORY_LABEL: Record<AccountCategory, string> = {
  cash: 'Cash',
  taxable: 'Taxable',
  equityComp: 'Equity comp',
  traditional: 'Traditional',
  roth: 'Roth',
  hsa: 'HSA',
}

/** The chart slot each category wears, in both themes. */
export const ACCOUNT_CATEGORY_COLOR: Record<AccountCategory, string> = {
  cash: 'var(--chart-5)',
  taxable: 'var(--chart-2)',
  equityComp: 'var(--chart-6)',
  traditional: 'var(--chart-3)',
  roth: 'var(--chart-1)',
  hsa: 'var(--chart-4)',
}

/**
 * The seventh band, stacked on top of the six categories: surplus cash the
 * ledger could not deposit because the plan has no cash or taxable account for
 * it. It is part of the investable total and of no category, so without it the
 * stack would fall short of the total with nothing on screen saying why.
 * Slot 7 is the one palette slot the six categories leave free (slot 8 is the
 * red the verdict colours use, which DESIGN.md keeps for computed outcomes).
 */
export const UNASSIGNED_CASH_KEY = 'unassigned'
export const UNASSIGNED_CASH_LABEL = 'Unassigned cash'
export const UNASSIGNED_CASH_COLOR = 'var(--chart-7)'

/**
 * The unassigned-cash band's display gate, shared by the screen chart, the
 * printed report and the report model: drawn (and listed in the legend) only
 * when some year holds more than $0.50 of the engine's `unassignedCash`. A row
 * that publishes none counts as nothing to draw.
 */
export function hasUnassignedCash(years: readonly Pick<YearResult, 'unassignedCash'>[]): boolean {
  return years.some((y) => (unassignedCash(y) ?? 0) > 0.5)
}
