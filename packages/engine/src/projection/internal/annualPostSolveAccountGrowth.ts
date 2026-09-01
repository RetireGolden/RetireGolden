/**
 * Calculate the post-solve liquid-account growth phase without mutating the
 * caller's live balance states or allocation tracks.
 *
 * The phase is deliberately positional. Compatible duplicate account IDs keep
 * separate physical balances, allocation tracks, and distributed-yield rows,
 * so every input and output is keyed by balance index rather than account ID.
 *
 * WHAT IT TAKES: the closing pre-growth balance states, positional allocation
 * tracks, positional distributed-yield facts assembled earlier in the year,
 * the resolved return assumptions, and the caller's market-shock readers.
 *
 * WHAT IT PRODUCES: exactly one row per state in state order. Each row carries
 * the price-growth closing balance, any drifted class weights, and the yield
 * amount the caller must reinvest in the later reinvestment pass. The result
 * also carries the wealth-weighted total return used by next year's coordinated
 * HECM decision.
 *
 * ALLOCATION TRADE: extraction adds one lightweight result row per physical
 * balance and one result array per year. Allocated rows already needed a fresh
 * class-rate array and drifted-weight array in the inline implementation; this
 * coordinator does not clone ledger state or allocation tracks.
 *
 * WHAT IT REFUSES: it does not write balances, basis, allocation tracks, or the
 * prior-return scalar. `simulatePlan` commits price growth and weight drift for
 * every row first, writes the return scalar second, and only then commits yield
 * reinvestment and taxable basis, preserving the original phase order.
 */
import {
  driftWeights,
  type AssetClassParams,
} from '../../allocation/assetClasses.js'
import {
  ASSET_CLASS_IDS,
  type AssetClassId,
} from '../../model/plan.js'
import type { PhysicalBalanceAccount } from './annualLogicalBalanceLedger.js'

export interface AnnualPostSolveAccountGrowthState {
  readonly account: Readonly<Pick<PhysicalBalanceAccount, 'type' | 'annualReturnPct'>>
  readonly balance: number
}

export interface AnnualPostSolveAccountGrowthTrack {
  readonly weights: number[]
}

export interface AnnualPostSolveDistributedYield {
  readonly gross: number
  readonly distributedYieldPct: number
  readonly reinvest: boolean
}

export interface AnnualPostSolveAccountGrowthInput {
  /** Full physical `balances` array; output retains the same cardinality. */
  readonly states: readonly AnnualPostSolveAccountGrowthState[]
  /** Allocation tracks keyed by stringified physical balance index. */
  readonly allocationTrack: ReadonlyMap<string, AnnualPostSolveAccountGrowthTrack>
  /** Distributed-yield facts keyed by physical balance index. */
  readonly distributedYieldByBalanceIndex: ReadonlyMap<number, AnnualPostSolveDistributedYield>
  readonly classParams: Readonly<Record<AssetClassId, Readonly<AssetClassParams>>>
  readonly defaultReturnPct: number
  /** Single-return additive shock for invested accounts; cash ignores it. */
  readonly shockPct: number
  readonly year: number
  /** Preserves the caller's per-account, per-class shock-read order. */
  readonly classShockAt: (year: number, classIndex: number) => number
}

interface AnnualPostSolveAccountGrowthRowBase {
  readonly marketClosingBalance: number
  /** Applied by the caller only after every market-growth row is committed. */
  readonly reinvestedYield: number
}

export type AnnualPostSolveAccountGrowthRow =
  | (AnnualPostSolveAccountGrowthRowBase & {
      readonly kind: 'allocated'
      readonly driftedWeights: number[]
    })
  | (AnnualPostSolveAccountGrowthRowBase & {
      readonly kind: 'singleReturn'
    })

export interface AnnualPostSolveAccountGrowthResult {
  readonly rows: readonly AnnualPostSolveAccountGrowthRow[]
  readonly priorYearPortfolioReturnPct: number
}

/** Pure with respect to every caller-owned state, map, map value, and array. */
export function annualPostSolveAccountGrowth(
  input: AnnualPostSolveAccountGrowthInput,
): AnnualPostSolveAccountGrowthResult {
  let returnWeightedSum = 0
  let returnWeightBase = 0
  const rows: AnnualPostSolveAccountGrowthRow[] = []

  for (const [balanceIndex, state] of input.states.entries()) {
    const distributedYieldPct = state.account.type === 'taxable'
      ? (input.distributedYieldByBalanceIndex.get(balanceIndex)?.distributedYieldPct ?? 0)
      : 0
    const distributedYield = input.distributedYieldByBalanceIndex.get(balanceIndex)
    const reinvestedYield = distributedYield?.reinvest === true && distributedYield.gross > 0
      ? distributedYield.gross
      : 0
    const track = input.allocationTrack.get(String(balanceIndex))

    if (track) {
      const classRates = ASSET_CLASS_IDS.map(
        (id, classIndex) => input.classParams[id].returnPct + input.classShockAt(input.year, classIndex),
      )
      const blendedPct = classRates.reduce(
        (sum, ratePct, classIndex) => sum + ratePct * (track.weights[classIndex] ?? 0),
        0,
      )
      returnWeightedSum += state.balance * blendedPct
      returnWeightBase += state.balance
      rows.push({
        kind: 'allocated',
        marketClosingBalance:
          state.balance * Math.max(0, 1 + (blendedPct - distributedYieldPct) / 100),
        driftedWeights: driftWeights(track.weights, classRates),
        reinvestedYield,
      })
      continue
    }

    const expectedPct = state.account.annualReturnPct ?? input.defaultReturnPct
    const totalReturnPct = state.account.type === 'cash'
      ? expectedPct
      : expectedPct + input.shockPct
    const priceReturnPct = totalReturnPct - distributedYieldPct
    returnWeightedSum += state.balance * totalReturnPct
    returnWeightBase += state.balance
    rows.push({
      kind: 'singleReturn',
      marketClosingBalance: state.balance * Math.max(0, 1 + priceReturnPct / 100),
      reinvestedYield,
    })
  }

  return {
    rows,
    priorYearPortfolioReturnPct:
      returnWeightBase > 0 ? returnWeightedSum / returnWeightBase : 0,
  }
}
