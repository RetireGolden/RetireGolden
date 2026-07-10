/**
 * Display-layer completeness: a plan with no income sources and nothing that
 * can actually fund spending is still being set up, so verdict framing (red
 * "portfolio depletes") would just read as doom while the user types.
 * Debts never count as funding (their balance is money owed), and
 * payment/value account types must carry a positive amount.
 */

import type { Account, Plan } from '../engine/model/plan'

function accountProvidesFunding(account: Account): boolean {
  switch (account.type) {
    case 'debt':
      return false
    case 'pension':
    case 'annuity':
      return account.monthlyAmount > 0
    case 'property':
      return account.value > 0
    default:
      return account.balance > 0
  }
}

export function isPlanIncomplete(plan: Pick<Plan, 'incomes' | 'accounts'>): boolean {
  return plan.incomes.length === 0 && !plan.accounts.some(accountProvidesFunding)
}
