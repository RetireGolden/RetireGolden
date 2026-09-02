/**
 * Pure policy for resolving and planning the year's need-based withdrawals.
 * The annual ledger retains every live balance, basis, warning, and journal
 * write after the fixed-point solver selects one of these plans.
 */
import type { Plan } from '../../model/plan.js'
import {
  isSpendableInYear,
} from '../../strategies/accountEligibility.js'
import {
  sizeRothConversion,
  type ConversionSizingInput,
} from '../../strategies/rothConversion.js'
import {
  aggregateBasisSale,
  type AggregateBasisSaleResult,
} from '../../tax/aggregateBasisSale.js'
import { planDollarsMoveNoLedgerCent } from '../../actions/planBalanceAdapter.js'
import type { YearWithdrawals } from '../types.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'

export type AnnualWithdrawalOrder = Plan['strategies']['withdrawalOrder']

/** Strategy with year-specific parameters resolved to planning dollars. */
export type ResolvedAnnualWithdrawalStrategy =
  | { readonly mode: 'sequential' }
  | { readonly mode: 'proportional' }
  | {
      readonly mode: 'bracketTargeted'
      readonly traditionalCap: number
    }

export interface AnnualWithdrawalStrategyInput {
  readonly withdrawalOrder: AnnualWithdrawalOrder
  readonly year: number
  /** Federal-law sizing facts for the same year and pre-withdrawal ledger. */
  readonly readSizing: () => Readonly<ConversionSizingInput>
}

export interface AnnualWithdrawalStrategyResult {
  readonly strategy: ResolvedAnnualWithdrawalStrategy
  readonly warning: string | null
}

export interface AnnualWithdrawalPlanInput {
  readonly needPlanDollars: number
  readonly states: readonly PhysicalBalanceState[]
  readonly strategy: ResolvedAnnualWithdrawalStrategy
  readonly year: number
  readonly liquidReservePlanDollars: number
}

export interface AnnualWithdrawalPlanResult {
  readonly byCategory: Readonly<YearWithdrawals>
  readonly byAccountId: ReadonlyMap<string, number>
  readonly realizedGains: number
  readonly taxableSales: ReadonlyMap<
    string,
    Readonly<AggregateBasisSaleResult>
  >
  readonly shortfall: number
  /** Dollars taken out of the taxable safety-net reserve as a last resort. */
  readonly reserveUsed: number
}

const SEQUENTIAL_ORDER = [
  'cash',
  'taxable',
  'equityComp',
  'traditional',
  'roth',
  'hsa',
] as const
const PROPORTIONAL_POOL = [
  'cash',
  'taxable',
  'equityComp',
  'traditional',
  'roth',
] as const

const BAD_BRACKET_WARNING =
  'The bracket-targeted withdrawal strategy names an unknown bracket; sequential order was used.'
const EPSILON = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS

/** Resolve the configured withdrawal order once for the current annual pass. */
export function annualWithdrawalStrategy(
  input: Readonly<AnnualWithdrawalStrategyInput>,
): AnnualWithdrawalStrategyResult {
  const configured = input.withdrawalOrder
  if (configured.mode === 'proportional') {
    return { strategy: { mode: 'proportional' }, warning: null }
  }
  if (configured.mode !== 'bracketTargeted') {
    return { strategy: { mode: 'sequential' }, warning: null }
  }

  const sized = sizeRothConversion(
    {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: configured.bracketPct,
      startYear: input.year,
      endYear: input.year,
    },
    input.readSizing(),
  )
  if (!sized.ok && sized.reason === 'bad_target') {
    return {
      strategy: { mode: 'sequential' },
      warning: BAD_BRACKET_WARNING,
    }
  }
  return {
    strategy: {
      mode: 'bracketTargeted',
      traditionalCap: sized.ok ? sized.amount : 0,
    },
    warning: null,
  }
}

function spendableBalance(state: PhysicalBalanceState, year: number): number {
  return isSpendableInYear(state.account, year) ? state.balance : 0
}

/**
 * Plan one candidate drain over private availability snapshots. The supplied
 * balance states and their account basis remain untouched.
 */
export function annualWithdrawalPlan(
  input: Readonly<AnnualWithdrawalPlanInput>,
): AnnualWithdrawalPlanResult {
  const {
    needPlanDollars: amount,
    states,
    strategy,
    year,
    liquidReservePlanDollars: liquidReserve,
  } = input
  const byCategory: YearWithdrawals = {
    cash: 0,
    taxable: 0,
    traditional: 0,
    roth: 0,
    hsa: 0,
    total: 0,
  }
  const byAccountId = new Map<string, number>()
  const taxableSales = new Map<
    string,
    Readonly<AggregateBasisSaleResult>
  >()
  const available = new Map(
    states.map((state) => [state.account.id, spendableBalance(state, year)]),
  )
  let realizedGains = 0
  let remaining = amount

  // Hold the liquid safety-net floor back so other account types fund spending
  // first. Protection is released only when every unreserved source falls short.
  const reservedByAccount = new Map<string, number>()
  if (liquidReserve > 0) {
    let toReserve = liquidReserve
    for (const type of ['equityComp', 'taxable', 'cash'] as const) {
      for (let index = states.length - 1;
        index >= 0 && toReserve > EPSILON;
        index--) {
        const state = states[index]!
        if (state.account.type !== type) continue
        const availableBalance = available.get(state.account.id) ?? 0
        const hold = Math.min(availableBalance, toReserve)
        if (hold <= 0) continue
        available.set(state.account.id, availableBalance - hold)
        reservedByAccount.set(state.account.id, hold)
        toReserve -= hold
      }
    }
  }

  const takeFrom = (state: PhysicalBalanceState, wanted: number): number => {
    const take = Math.min(
      available.get(state.account.id) ?? 0,
      wanted,
      remaining,
    )
    if (take <= 0) return 0

    // The exact-cent retirement ledger cannot express a sub-cent traditional
    // debit. Discharge that quantum from both availability and need without
    // publishing a withdrawal the runtime journal cannot explain.
    if (
      state.account.type === 'traditional' &&
      planDollarsMoveNoLedgerCent(take)
    ) {
      available.set(
        state.account.id,
        (available.get(state.account.id) ?? 0) - take,
      )
      remaining -= take
      return 0
    }
    if (state.account.type === 'equityComp' && state.balance > 0) {
      const basisRatio = Math.min(1, state.costBasis / state.balance)
      realizedGains += take * (1 - basisRatio)
    }
    const category =
      state.account.type === 'equityComp'
        ? 'taxable'
        : state.account.type
    byCategory[category as keyof Omit<YearWithdrawals, 'total'>] += take
    byAccountId.set(
      state.account.id,
      (byAccountId.get(state.account.id) ?? 0) + take,
    )
    available.set(
      state.account.id,
      (available.get(state.account.id) ?? 0) - take,
    )
    remaining -= take
    return take
  }

  const drainCategory = (
    category: PhysicalBalanceState['account']['type'],
    cap = Infinity,
  ): void => {
    let capLeft = cap
    for (const state of states) {
      if (state.account.type !== category) continue
      if (remaining <= EPSILON || capLeft <= EPSILON) break
      capLeft -= takeFrom(state, capLeft)
    }
  }

  if (strategy.mode === 'proportional') {
    // Pro-rata passes; accounts that empty shift their share to the rest.
    for (let pass = 0; pass < 6 && remaining > EPSILON; pass++) {
      const poolStates = states.filter(
        (state) =>
          (PROPORTIONAL_POOL as readonly string[]).includes(
            state.account.type,
          ) && (available.get(state.account.id) ?? 0) > 0,
      )
      const poolTotal = poolStates.reduce(
        (sum, state) => sum + (available.get(state.account.id) ?? 0),
        0,
      )
      if (poolTotal <= 0) break
      const target = remaining
      for (const state of poolStates) {
        takeFrom(
          state,
          (target * (available.get(state.account.id) ?? 0)) / poolTotal,
        )
      }
    }
    for (const category of PROPORTIONAL_POOL) drainCategory(category)
    drainCategory('hsa')
  } else if (strategy.mode === 'bracketTargeted') {
    drainCategory('traditional', strategy.traditionalCap)
    drainCategory('cash')
    drainCategory('taxable')
    drainCategory('equityComp')
    drainCategory('roth')
    drainCategory('traditional')
    drainCategory('hsa')
  } else {
    for (const category of SEQUENTIAL_ORDER) drainCategory(category)
  }

  // Release the safety-net reserve as a last resort.
  let reserveUsed = 0
  if (remaining > EPSILON && reservedByAccount.size > 0) {
    const before = remaining
    for (const [accountId, hold] of reservedByAccount) {
      available.set(accountId, (available.get(accountId) ?? 0) + hold)
    }
    for (const category of ['cash', 'taxable', 'equityComp'] as const) {
      drainCategory(category)
    }
    reserveUsed = before - remaining
  }

  // Proportional planning may visit one taxable account more than once. Settle
  // its final aggregate sale once so the later commit uses identical basis math.
  for (const state of states) {
    if (state.account.type !== 'taxable') continue
    const saleProceeds = Math.min(
      state.balance,
      Math.max(0, byAccountId.get(state.account.id) ?? 0),
    )
    const sale = aggregateBasisSale({
      openingFairMarketValue: state.balance,
      openingCostBasis: state.costBasis,
      saleProceeds,
    })
    taxableSales.set(state.account.id, sale)
    realizedGains += sale.realizedCapitalGainOrLoss
  }

  byCategory.total =
    byCategory.cash +
    byCategory.taxable +
    byCategory.traditional +
    byCategory.roth +
    byCategory.hsa
  return {
    byCategory,
    byAccountId,
    realizedGains,
    taxableSales,
    shortfall: Math.max(0, remaining),
    reserveUsed,
  }
}
