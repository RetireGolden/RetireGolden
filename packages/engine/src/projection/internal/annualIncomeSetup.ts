/**
 * Initialize and fold the annual income state that precedes the non-wage
 * streams. The row producers retain their own selection/arithmetic domains;
 * this boundary owns only the original source-ordered folds and fresh annual
 * containers.
 *
 * `incomes` and both maps are intentionally returned by identity. The caller
 * continues mutating the same incomes object through later annual phases and
 * passes the maps to their existing consumers. Caller-supplied commit hooks
 * forward ledger payloads unreconstructed at the original per-row transaction
 * points; when capture is disabled no hook is supplied and no record property
 * is read here.
 */
import type { YearIncomes } from '../types.js'
import {
  distributedTaxableYieldRows,
  type DistributedTaxableYieldInput,
  type DistributedTaxableYieldResultRow,
} from './distributedTaxableYieldRows.js'
import {
  wageIncomeStreams,
  type WageIncomeRow,
  type WageIncomeYearInput,
} from './wageIncomeStreams.js'

export interface AnnualIncomeSetupInput {
  readonly distributedYield: DistributedTaxableYieldInput
  readonly wages: WageIncomeYearInput
  /** Caller-owned effect, committed at the original per-row fold point. */
  readonly commitDistributedYield?: (
    row: Extract<DistributedTaxableYieldResultRow, { kind: 'yield' }>,
  ) => void
  /** Caller-owned effect, committed at the original per-row fold point. */
  readonly commitWage?: (row: WageIncomeRow) => void
}

export interface AnnualIncomeSetupResult {
  /** Fresh mutable annual publication object; later phases keep writing it. */
  readonly incomes: YearIncomes
  readonly ordinaryIncome: number
  readonly taxableYieldReinvested: number
  readonly distributedYieldByAccountId: ReadonlyMap<
    string,
    Readonly<{
      gross: number
      distributedYieldPct: number
      reinvest: boolean
    }>
  >
  readonly distributedYieldByBalanceIndex: ReadonlyMap<
    number,
    Readonly<{
      gross: number
      distributedYieldPct: number
      reinvest: boolean
    }>
  >
  readonly wagesByPerson: ReadonlyMap<string, number>
  /** Original producer arrays and record objects, unreconstructed. */
  readonly distributedYieldRows: readonly DistributedTaxableYieldResultRow[]
  readonly wageRows: readonly WageIncomeRow[]
}

/**
 * Fresh and deterministic with respect to the supplied state. The only
 * external effects are the explicit optional commit hooks.
 */
export function annualIncomeSetup(
  input: AnnualIncomeSetupInput,
): AnnualIncomeSetupResult {
  const incomes: YearIncomes = {
    wages: 0,
    socialSecurity: 0,
    pension: 0,
    annuity: 0,
    tipsLadder: 0,
    recurring: 0,
    oneTime: 0,
    taxableInterest: 0,
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    taxableYield: 0,
    taxExemptInterest: 0,
    total: 0,
  }
  let ordinaryIncome = 0
  let taxableYieldReinvested = 0
  const distributedYieldByAccountId = new Map<
    string,
    { gross: number; distributedYieldPct: number; reinvest: boolean }
  >()
  const distributedYieldByBalanceIndex = new Map<
    number,
    { gross: number; distributedYieldPct: number; reinvest: boolean }
  >()
  const wagesByPerson = new Map<string, number>()
  const distributedYieldRows = distributedTaxableYieldRows(
    input.distributedYield,
  )

  // The producer emits one row per balance state, including explicit `none`
  // rows. Each contributing field stays in account order: regrouping changes
  // IEEE-754 results. Duplicate account ids deliberately retain their first
  // map position. Physical rows retain their own yield facts by balance index;
  // the ID-keyed view aggregates only reinvested gross because its downstream
  // consumer commits one logical grouped credit.
  for (const row of distributedYieldRows) {
    if (row.kind === 'none') continue
    incomes.taxableInterest += row.interest
    incomes.ordinaryDividends += row.ordinaryDividends
    incomes.qualifiedDividends += row.qualified
    incomes.taxableYield += row.taxableGross
    incomes.taxExemptInterest += row.exempt
    ordinaryIncome += row.interest + row.ordinaryDividends
    if (row.reinvest) taxableYieldReinvested += row.gross
    distributedYieldByBalanceIndex.set(row.balanceIndex, {
      gross: row.gross,
      distributedYieldPct: row.distributedYieldPct,
      reinvest: row.reinvest,
    })
    const priorYield = distributedYieldByAccountId.get(row.accountId)
    const reinvestedGrossForId =
      (priorYield?.gross ?? 0) + (row.reinvest ? row.gross : 0)
    distributedYieldByAccountId.set(row.accountId, {
      gross: reinvestedGrossForId,
      distributedYieldPct: row.distributedYieldPct,
      reinvest: reinvestedGrossForId > 0,
    })
    input.commitDistributedYield?.(row)
  }

  // Produce wages only after the yield fold, matching the original eager
  // phase order even though both child producers are pure. `ordinaryIncome`
  // now has a live yield base, so wages must be added row-by-row rather than
  // pre-summed. `incomes.wages` and each person's map entry remain zero-based.
  const wageRows = wageIncomeStreams(input.wages)
  for (const row of wageRows) {
    incomes.wages += row.amount
    ordinaryIncome += row.amount
    wagesByPerson.set(
      row.personId,
      (wagesByPerson.get(row.personId) ?? 0) + row.amount,
    )
    input.commitWage?.(row)
  }

  return {
    incomes,
    ordinaryIncome,
    taxableYieldReinvested,
    distributedYieldByAccountId,
    distributedYieldByBalanceIndex,
    wagesByPerson,
    distributedYieldRows,
    wageRows,
  }
}
