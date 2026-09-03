/**
 * The account-category vocabulary the balance charts are drawn from: which
 * types are stacked, what each is called, which chart slot it wears, and the
 * per-year roll-up of balances into those buckets.
 *
 * One module because the screen (`ResultsPage`) and the printed report
 * (`ReportPage`) plot the same chart and used to carry byte-identical copies of
 * all four. The palette assignment is a design decision, not an arbitrary one
 * (DESIGN.md pins gold at chart-1 and green at chart-3, and forbids pairing
 * gold with amber), so two copies of it could drift with nothing catching the
 * drift.
 *
 * No money math here: `categoryBalances` only sums balances the engine already
 * computed for the year into the bucket each account's type belongs to.
 */

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import type { YearResult } from '@retiregolden/engine/projection/types'

/** Account types the balance chart stacks, bottom to top. */
export const ACCOUNT_CATEGORIES = ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'] as const

export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number]

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

const isCategory = (type: Account['type']): type is AccountCategory =>
  (ACCOUNT_CATEGORIES as readonly string[]).includes(type)

/**
 * One year's engine balances, summed into the stacked categories. An account
 * whose type is not stacked (a property, a debt, a pension) contributes to no
 * bucket, and a category with no accounts stays 0 so the stack keeps its shape
 * across every year.
 */
export function categoryBalances(plan: Plan, year: YearResult): Record<AccountCategory, number> {
  const out: Record<AccountCategory, number> = { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0 }
  for (const account of plan.accounts) {
    if (isCategory(account.type)) out[account.type] += year.balances[account.id] ?? 0
  }
  return out
}
