/**
 * Pure annual property carrying-cost selection and arithmetic.
 *
 * Rows stay positional and in `accounts` order. In particular, account ids are
 * not used as keys: malformed/imported plans can contain duplicate ids, and
 * collapsing them here would change both the expense fold and cash-flow calls.
 * The caller folds each row and publishes its `record` object unchanged.
 */
import type { Account } from '../../model/plan.js'
import type { RecordedAccountAmount } from '../annualCashFlowYearSites.js'

type PropertyAccount = Extract<Account, { type: 'property' }>

export interface AnnualPropertyCarryingCostsInput {
  readonly accounts: readonly Readonly<Account>[]
  readonly year: number
  readonly anyAlive: boolean
  /** The caller's already-resolved general-inflation factor for this year. */
  readonly inflFactor: number
}

export interface AnnualPropertyCarryingCostRow {
  readonly account: Readonly<PropertyAccount>
  readonly amount: number
  readonly record: RecordedAccountAmount
}

export function annualPropertyCarryingCosts(
  input: AnnualPropertyCarryingCostsInput,
): readonly AnnualPropertyCarryingCostRow[] {
  if (!input.anyAlive) return []

  const rows: AnnualPropertyCarryingCostRow[] = []
  for (const account of input.accounts) {
    if (account.type !== 'property') continue
    if (account.plannedSaleYear !== null && input.year >= account.plannedSaleYear) continue

    const amount =
      ((account.propertyTaxAnnual ?? 0) + (account.insuranceAnnual ?? 0)) *
      input.inflFactor
    const record: RecordedAccountAmount = {
      accountId: account.id,
      ownerPersonId: account.ownerPersonId ?? null,
      amount,
    }
    rows.push({ account, amount, record })
  }
  return rows
}
