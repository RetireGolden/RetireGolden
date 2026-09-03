/**
 * Annual taxable-account distributed-yield calculation, lifted from
 * `simulatePlan` as a pure row producer.
 *
 * The helper returns exactly one row per balance state, in balance order. It
 * deliberately does not fold income totals, update the last-wins
 * distributed-yield maps, reinvest anything, or publish ledger
 * entries. Those effects remain in the caller and are applied one row at a
 * time, preserving both IEEE-754 addition order and duplicate-account-id
 * behavior.
 *
 * `startOfYearBalances` and `allocationTrack` are supplied by the caller rather
 * than reconstructed here. Opening balances are positional so duplicate IDs
 * retain each physical row's own economic principal; allocation policy remains
 * positional too. A row is keyed by position, never
 * reconciled by account ID.
 */
import {
  blendedTaxableYield,
  DEFAULT_QUALIFIED_DIVIDEND_RATIO,
  type AssetClassParams,
} from '../../allocation/assetClasses.js'
import type { Account, AssetClassId } from '../../model/plan.js'
import type { RecordedDistributedYield } from '../annualCashFlowYearSites.js'

/** The portion of one balance state read by this annual phase. */
export interface DistributedTaxableYieldState {
  readonly account: Readonly<Account>
  readonly balance: number
}

/** The portion of an allocation-track entry used to derive class-blended yield. */
export interface DistributedTaxableYieldAllocationTrack {
  readonly weights: number[]
}

export interface DistributedTaxableYieldInput {
  /** Full `balances` array; output remains positional and has the same length. */
  readonly states: readonly DistributedTaxableYieldState[]
  /** One start-of-year value per physical state, in the same order. */
  readonly startOfYearBalances: readonly number[]
  /** Allocation tracks keyed by physical balance index. */
  readonly allocationTrack: ReadonlyMap<string, DistributedTaxableYieldAllocationTrack>
  /** Resolved class parameters for this projection. */
  readonly classParams: Record<AssetClassId, AssetClassParams>
}

/** No taxable distributed yield is produced for this balance position. */
export interface NoDistributedTaxableYieldRow {
  readonly kind: 'none'
}

/**
 * One taxable account's distributed yield.
 *
 * Each scalar is carried out separately so the caller can retain the original
 * accumulator operations verbatim. `record` is the exact object the caller
 * must publish, allowing delegation tests to distinguish use of this helper
 * from a byte-identical rebuild at the call site.
 */
export interface DistributedTaxableYieldRow {
  readonly kind: 'yield'
  readonly balanceIndex: number
  readonly accountId: string
  readonly interest: number
  readonly ordinaryDividends: number
  readonly qualified: number
  readonly taxableGross: number
  readonly exempt: number
  readonly gross: number
  readonly distributedYieldPct: number
  readonly reinvest: boolean
  readonly record: RecordedDistributedYield
}

export type DistributedTaxableYieldResultRow =
  | NoDistributedTaxableYieldRow
  | DistributedTaxableYieldRow

/** Exactly one fresh row per state, in state order. Mutates nothing. */
export function distributedTaxableYieldRows(
  input: DistributedTaxableYieldInput,
): readonly DistributedTaxableYieldResultRow[] {
  const { states, startOfYearBalances, allocationTrack, classParams } = input
  if (startOfYearBalances.length !== states.length) {
    throw new Error('distributed-yield opening balances lost positional cardinality')
  }
  const rows: DistributedTaxableYieldResultRow[] = []

  for (const [stateIndex, state] of states.entries()) {
    if (state.account.type !== 'taxable') {
      rows.push({ kind: 'none' })
      continue
    }

    const account = state.account
    const startBalance = Math.max(0, startOfYearBalances[stateIndex]!)
    if (startBalance <= 0) {
      rows.push({ kind: 'none' })
      continue
    }

    // An allocated brokerage account derives its yield fields from the class
    // blend; explicit account-level fields still override that blend.
    const track = allocationTrack.get(String(stateIndex))
    const blendedYield = track ? blendedTaxableYield(track.weights, classParams) : null
    const interestYieldPct = Math.max(0, account.interestYieldPct ?? blendedYield?.interestYieldPct ?? 0)
    const dividendYieldPct = Math.max(0, account.dividendYieldPct ?? blendedYield?.dividendYieldPct ?? 0)
    const taxExemptYieldPct = Math.max(0, account.taxExemptInterestYieldPct ?? 0)
    const totalTaxableYieldPct = interestYieldPct + dividendYieldPct
    const totalDistributedYieldPct = totalTaxableYieldPct + taxExemptYieldPct
    if (totalDistributedYieldPct <= 0) {
      rows.push({ kind: 'none' })
      continue
    }

    const interest = startBalance * (interestYieldPct / 100)
    const dividends = startBalance * (dividendYieldPct / 100)
    const exempt = startBalance * (taxExemptYieldPct / 100)
    const qualified = dividends * Math.min(1, Math.max(0, account.qualifiedRatio ?? blendedYield?.qualifiedRatio ?? DEFAULT_QUALIFIED_DIVIDEND_RATIO))
    const ordinaryDividends = dividends - qualified
    const taxableGross = interest + dividends
    const gross = taxableGross + exempt
    const reinvest = account.reinvestDividends ?? true
    const record: RecordedDistributedYield = {
      accountId: account.id,
      taxableGross,
      interest,
      ordinaryDividends,
      qualified,
      exempt,
      reinvest,
    }

    rows.push({
      kind: 'yield',
      balanceIndex: stateIndex,
      accountId: account.id,
      interest,
      ordinaryDividends,
      qualified,
      taxableGross,
      exempt,
      gross,
      distributedYieldPct: totalDistributedYieldPct,
      reinvest,
      record,
    })
  }

  return rows
}
