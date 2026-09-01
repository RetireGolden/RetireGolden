/**
 * TIPS-ladder purchase funding, planned without mutating the simulator's
 * ladder or balance state. The caller applies each `purchase` row in order.
 *
 * The private balance-and-basis overlay is indexed by `balances` position,
 * not account id. That preserves two observable details of the former inline
 * loop: funding resolution uses `Array.find` (the first duplicate id wins),
 * and a later ladder sharing that state sees every earlier ladder's debit and
 * basis sale. Rows are likewise keyed by ladder position so duplicate ladder
 * ids never collapse.
 */
import type { Account } from '../../model/plan.js'
import { isSpendableInYear } from '../../strategies/accountEligibility.js'
import { aggregateBasisSale } from '../../tax/aggregateBasisSale.js'
import type { RecordedTipsPurchase } from '../annualCashFlowYearSites.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'

export const TIPS_LADDER_PURCHASE_SHORTFALL_WARNING =
  'A TIPS ladder purchase exceeded its funding account balance; the ladder was scaled down to what the available money buys.'

type FundingAccount = Extract<
  Account,
  { type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa' }
>

/** Narrow, readonly structural view of one simulator ladder state. */
export interface TipsLadderPurchaseStateView {
  readonly id: string
  readonly costReal: number
  readonly purchase: Readonly<{ year: number; fundingAccountId: string }> | undefined
}

/** Narrow, readonly structural view of one simulator balance state. */
export interface TipsLadderPurchaseFundingBalanceView {
  readonly account: Readonly<FundingAccount>
  readonly balance: number
  readonly costBasis: number
}

export interface TipsLadderPurchaseFundingInput {
  /** Unsorted `ladderStates`; position and duplicate ids are load-bearing. */
  readonly ladderStates: readonly TipsLadderPurchaseStateView[]
  /** Unsorted `balances`; funding ids resolve to the first matching position. */
  readonly balances: readonly TipsLadderPurchaseFundingBalanceView[]
  readonly year: number
  /** The caller's `inflFactorFrom(startYear, year)`. */
  readonly inflFactor: number
}

export type TipsLadderPurchaseFundingRow =
  | {
      readonly kind: 'none'
      readonly ladderIndex: number
    }
  | {
      readonly kind: 'purchase'
      readonly ladderIndex: number
      readonly fundingIndex: number
      /** Null means the caller must leave the ladder's existing scale alone. */
      readonly scale: number | null
      readonly warning: typeof TIPS_LADDER_PURCHASE_SHORTFALL_WARNING | null
      readonly funded: number
      readonly capitalGainOrLoss: number
      readonly closingBalance: number
      readonly closingCostBasis: number
      /** Handed to the recorder unreconstructed, enabling an identity guard. */
      readonly record: RecordedTipsPurchase
      /** Null exactly when the former inline block did not publish a debit. */
      readonly debit: Readonly<{ accountId: string; amountPlanDollars: number }> | null
    }

/** One row per ladder, in ladder order. Never sums gains or debits. */
export function tipsLadderPurchaseFunding(
  input: TipsLadderPurchaseFundingInput,
): readonly TipsLadderPurchaseFundingRow[] {
  const { ladderStates, balances, year, inflFactor } = input
  const shadow = balances.map(({ balance, costBasis }) => ({ balance, costBasis }))
  const rows: TipsLadderPurchaseFundingRow[] = []

  for (const [ladderIndex, ladder] of ladderStates.entries()) {
    if (!ladder.purchase || ladder.purchase.year !== year) {
      rows.push({ kind: 'none', ladderIndex })
      continue
    }
    const fundingIndex = balances.findIndex(
      (candidate) => candidate.account.id === ladder.purchase!.fundingAccountId,
    )
    if (fundingIndex < 0) {
      rows.push({ kind: 'none', ladderIndex })
      continue
    }

    const funding = balances[fundingIndex]!
    const opening = shadow[fundingIndex]!
    const cost = ladder.costReal * inflFactor
    const spendable = isSpendableInYear(funding.account, year) ? opening.balance : 0
    const funded = Math.min(cost, spendable)
    const isShort = funded < cost - ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS
    const scale = isShort ? (cost > 0 ? funded / cost : 0) : null
    let capitalGainOrLoss = 0
    let closingCostBasis = opening.costBasis

    if (funding.account.type === 'taxable') {
      const sale = aggregateBasisSale({
        openingFairMarketValue: opening.balance,
        openingCostBasis: opening.costBasis,
        saleProceeds: funded,
      })
      capitalGainOrLoss = sale.realizedCapitalGainOrLoss
      closingCostBasis = sale.remainingCostBasis
    } else if (funding.account.type === 'equityComp' && opening.balance > 0) {
      const basisRatio = Math.min(1, opening.costBasis / opening.balance)
      capitalGainOrLoss = funded * (1 - basisRatio)
      closingCostBasis = Math.max(0, opening.costBasis - funded * basisRatio)
    }

    const closingBalance = opening.balance - funded
    shadow[fundingIndex] = { balance: closingBalance, costBasis: closingCostBasis }
    const record: RecordedTipsPurchase = {
      fundingAccountId: funding.account.id,
      ladderId: ladder.id,
      funded,
      capitalGainOrLoss,
    }
    rows.push({
      kind: 'purchase',
      ladderIndex,
      fundingIndex,
      scale,
      warning: isShort ? TIPS_LADDER_PURCHASE_SHORTFALL_WARNING : null,
      funded,
      capitalGainOrLoss,
      closingBalance,
      closingCostBasis,
      record,
      debit: funded > 0
        ? { accountId: funding.account.id, amountPlanDollars: funded }
        : null,
    })
  }

  return rows
}
