/**
 * The plan's balance sheet as entered (B2-P1, the household map's "As
 * entered" line): sums of the figures the plan stores today, with no growth,
 * no year and no deflation. The projection's net worth
 * (`YearResult.netWorth`) is a different quantity: the same accounts at the
 * end of a projected year.
 *
 * - investable: the entered `balance` of every cash, taxable, equityComp,
 *   traditional, Roth and HSA account, the six types the ledger draws from
 *   (the same set and order as `montecarlo/riskBasedGuardrails.ts#startingInvestableOf`);
 * - property: the entered `value` of every property;
 * - liabilities: the entered `balance` owed on every debt;
 * - assets = investable + property; netWorth = assets − liabilities.
 *
 * Pensions and annuities carry a monthly amount, not a balance, and are not
 * lines of this sheet. Each sum adds its accounts in the order given, from 0,
 * so the same accounts in the same order always give the same doubles.
 *
 * A leaf module (its one import is a type), so a page that prints the sheet
 * does not load the ledger.
 *
 * @see DOCS/calculations/accounts-and-growth/household-map-entered-totals.md
 */
import type { Account } from './plan.js'

export interface EnteredBalanceSheet {
  /** Σ entered balances of the cash, taxable, equityComp, traditional, Roth and HSA accounts. */
  readonly investable: number
  /** Σ entered property values. */
  readonly property: number
  /** investable + property. */
  readonly assets: number
  /** Σ entered debt balances (the amount owed). */
  readonly liabilities: number
  /** assets − liabilities. */
  readonly netWorth: number
}

/**
 * The balance sheet of `accounts` as entered: pass the plan's accounts for the
 * household, or the ones a view shows for that view. Refuses a non-finite
 * entered figure with a RangeError, which the plan schema never admits.
 */
export function enteredBalanceSheet(accounts: Iterable<Account>): EnteredBalanceSheet {
  let investable = 0
  let property = 0
  let liabilities = 0
  for (const account of accounts) {
    switch (account.type) {
      case 'cash':
      case 'taxable':
      case 'equityComp':
      case 'traditional':
      case 'roth':
      case 'hsa':
        investable += finiteFigure(account.balance, account.id)
        break
      case 'property':
        property += finiteFigure(account.value, account.id)
        break
      case 'debt':
        liabilities += finiteFigure(account.balance, account.id)
        break
      case 'pension':
      case 'annuity':
        break
    }
  }
  const assets = investable + property
  return { investable, property, assets, liabilities, netWorth: assets - liabilities }
}

function finiteFigure(figure: number, accountId: string): number {
  if (!Number.isFinite(figure)) {
    throw new RangeError(`Account ${accountId}'s entered figure must be finite; got ${String(figure)}`)
  }
  return figure
}
