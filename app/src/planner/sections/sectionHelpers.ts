/**
 * Non-component helpers shared by the plan entry sections (kept out of the
 * component files so react-refresh sees component-only modules).
 */

import type { Account, AllocationWeights } from '../../engine/model/plan'

export const newId = () => crypto.randomUUID()

export const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, i) => ({ value: String(i + 1), label }))

export function isIndividuallyOwnedAccount(type: Account['type']): boolean {
  return type === 'traditional' || type === 'roth' || type === 'hsa'
}

export const ACCOUNT_LABEL: Record<Account['type'], string> = {
  cash: 'Cash',
  taxable: 'Brokerage',
  equityComp: 'Equity comp',
  traditional: 'Traditional',
  roth: 'Roth',
  hsa: 'HSA',
  pension: 'Pension',
  annuity: 'Annuity',
  property: 'Property',
  debt: 'Debt',
}

export type AllocatableAccount = Extract<Account, { type: 'taxable' | 'traditional' | 'roth' | 'hsa' }>

export const EVEN_START_WEIGHTS: AllocationWeights = { usStocks: 60, intlStocks: 10, bonds: 25, cash: 5 }

export function isAllocatable(account: Account): account is AllocatableAccount {
  return account.type === 'taxable' || account.type === 'traditional' || account.type === 'roth' || account.type === 'hsa'
}
