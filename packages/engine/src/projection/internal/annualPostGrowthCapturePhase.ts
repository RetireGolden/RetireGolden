/**
 * Close the year's balances: capture the owned-non-Roth-IRA positions the
 * Form 8606 replay needs from *before* growth, apply this year's market growth
 * and its reinvested distributed yield, and capture the post-growth owner pools
 * that the replay reads on the other side.
 *
 * **Why this is its own sub-phase.** `annualFundingApplicationAndClosePhase`
 * takes a 91-field `Facts` record, a 32-field mutable `Ledger` and fifteen
 * callbacks, and until this extraction every block inside it could reach all of
 * them. This block needs fifteen of those values and nothing else, and saying
 * so in a type is the point: a future edit here cannot silently start reading
 * an ACA contract or an IRMAA tier.
 *
 * **What it owns and what it does not.** The growth arithmetic itself stays in
 * `annualPostSolveAccountGrowth`, which returns exactly one positional row per
 * physical balance; this block owns the two commit passes over those rows and
 * the order between them. That order is load-bearing: every market balance and
 * drifted weight is committed before the portfolio-return signal is published,
 * and reinvestment — which is a distribution, not growth — is credited in a
 * second pass afterwards, adding basis only to the taxable physical row whose
 * earlier yield calculation produced it.
 *
 * Move-only out of the funding phase: the expressions, the loop order, the two
 * `Object.freeze` capture shapes and their sort comparators are unchanged.
 */
import type { Account, AssetAllocationPolicy } from '../../model/plan.js'
import type { resolveAssetClassParams } from '../../allocation/assetClasses.js'
import { compareUtf16CodeUnits } from '../../actions/structuralId.js'
import type { AnnualIncomeSetupResult } from './annualIncomeSetup.js'
import { annualPostSolveAccountGrowth } from './annualPostSolveAccountGrowth.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'

export interface AnnualPostGrowthCapturePhaseInput {
  readonly planId: string
  readonly year: number
  /** Live physical rows; balances, weights and taxable basis are written. */
  readonly balances: PhysicalBalanceState[]
  /** The logical, id-keyed view the year publishes its pre-growth pool from. */
  readonly annualIdKeyedBalances: readonly PhysicalBalanceState[]
  readonly startOfYearPositionalBalances: readonly number[]
  readonly isAggregatedIraThisYear: (account: Account) => boolean
  /** Live allocation weights, rewritten in place for allocated rows. */
  readonly allocationTrack:
    Map<string, { policy: AssetAllocationPolicy; weights: number[] }>
  readonly distributedYieldByBalanceIndex:
    AnnualIncomeSetupResult['distributedYieldByBalanceIndex']
  readonly classParams: ReturnType<typeof resolveAssetClassParams>
  readonly defaultReturnPct: number
  readonly returnShockAt: (year: number) => number
  readonly classShockAt: (year: number, classIndex: number) => number
  readonly annuityStagingCandidates: readonly Readonly<{
    readonly contract: Account
    readonly funding: Account
    readonly ownerPersonId: string | null
  }>[]
  readonly annuityContractValue: ReadonlyMap<string, number>
  readonly startOfYearAnnuityContractValue: ReadonlyMap<string, number>
}

type OwnedNonRothIraPhysicalBalance = Readonly<{
  sourceAccountId: string
  balanceIndex: number
  balancePlanDollars: number
}>

export interface AnnualPostGrowthCapturePhaseResult {
  readonly ownedNonRothIraBalancesBeforeGrowth:
    Readonly<Record<string, number>>
  readonly ownedNonRothIraPhysicalBalancesBeforeGrowth:
    readonly OwnedNonRothIraPhysicalBalance[]
  readonly ownedNonRothIraPhysicalOpeningBalances:
    readonly OwnedNonRothIraPhysicalBalance[]
  /**
   * Wealth-weighted total return the ledger actually applies this year
   * (including distributed yield — interest, dividends, and tax-exempt
   * interest; a distribution, not a loss). Next year's coordinated HECM check
   * reads it, so the down-market signal is the realized portfolio return, not
   * the raw additive shock.
   */
  readonly priorYearPortfolioReturnPct: number
  readonly ownedNonRothIraPostGrowthSource: OwnedNonRothIraPostGrowthSource
}

type OwnedNonRothIraPostGrowthSource = Readonly<{
  status: 'postGrowthOwnedNonRothIraBalancesCaptured'
  captureBoundary:
    'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication'
  annualObservationValidation: 'notRun'
  planId: string
  taxYear: number
  ownerPools: readonly Readonly<{
    ownerPersonId: string | null
    accountBalances: readonly OwnedNonRothIraPhysicalBalance[]
    annuityContractValues: readonly Readonly<{
      annuityAccountId: string
      fundingAccountId: string
      contractValueOpeningPlanDollars: number
      contractValuePlanDollars: number
    }>[]
  }>[]
}>

export function annualPostGrowthCapturePhase(
  input: AnnualPostGrowthCapturePhaseInput,
): AnnualPostGrowthCapturePhaseResult {
  const {
    planId,
    year,
    balances,
    annualIdKeyedBalances,
    startOfYearPositionalBalances,
    isAggregatedIraThisYear,
    allocationTrack,
    distributedYieldByBalanceIndex,
    classParams,
    annuityStagingCandidates,
    annuityContractValue,
    startOfYearAnnuityContractValue,
  } = input

  const ownedNonRothIraBalancesBeforeGrowth = Object.freeze(
    Object.fromEntries(
      annualIdKeyedBalances
        .filter((state) => isAggregatedIraThisYear(state.account))
        .map((state) => [state.account.id, state.balance]),
    ),
  )
  const ownedNonRothIraPhysicalBalancesBeforeGrowth = Object.freeze(
    balances.flatMap((state, balanceIndex) =>
      isAggregatedIraThisYear(state.account)
        ? [Object.freeze({
            sourceAccountId: state.account.id,
            balanceIndex,
            balancePlanDollars: state.balance,
          })]
        : []),
  )
  const ownedNonRothIraPhysicalOpeningBalances = Object.freeze(
    balances.flatMap((state, balanceIndex) =>
      isAggregatedIraThisYear(state.account)
        ? [Object.freeze({
            sourceAccountId: state.account.id,
            balanceIndex,
            balancePlanDollars: startOfYearPositionalBalances[balanceIndex]!,
          })]
        : []),
  )

  const accountGrowth = annualPostSolveAccountGrowth({
    states: balances,
    allocationTrack,
    distributedYieldByBalanceIndex,
    classParams,
    defaultReturnPct: input.defaultReturnPct,
    shockPct: input.returnShockAt(year),
    year,
    classShockAt: input.classShockAt,
  })
  // Wealth-weighted total return the ledger actually applies this year
  // (including distributed yield — interest, dividends, and tax-exempt
  // interest; a distribution, not a loss). Next year's coordinated HECM
  // check reads it, so the down-market signal is the realized portfolio
  // return, not the raw additive shock. The coordinator returns exactly one
  // positional row per physical balance; this block commits every market
  // balance and drifted weight before publishing that signal, then commits
  // reinvestment in the original second pass below.
  for (let balanceIndex = 0; balanceIndex < balances.length; balanceIndex++) {
    const row = accountGrowth.rows[balanceIndex]!
    const state = balances[balanceIndex]!
    state.balance = row.marketClosingBalance
    if (row.kind === 'allocated') {
      allocationTrack.get(String(balanceIndex))!.weights = row.driftedWeights
    }
  }
  const priorYearPortfolioReturnPct = accountGrowth.priorYearPortfolioReturnPct

  // Distributed yield is credited only after every account's market growth.
  // Reinvestment is not growth and adds basis only to the taxable physical
  // row whose earlier yield calculation produced it.
  for (let balanceIndex = 0; balanceIndex < balances.length; balanceIndex++) {
    const row = accountGrowth.rows[balanceIndex]!
    if (row.reinvestedYield <= 0) continue
    const state = balances[balanceIndex]!
    state.balance += row.reinvestedYield
    if (state.account.type === 'taxable') state.costBasis += row.reinvestedYield
  }

  const ownedNonRothIraBalancesByOwner = new Map<
    string | null,
    Array<{ sourceAccountId: string; balanceIndex: number; balancePlanDollars: number }>
  >()
  for (const [balanceIndex, state] of balances.entries()) {
    if (!isAggregatedIraThisYear(state.account)) continue
    // A validated Plan always supplies an owner here. Preserve null on a
    // malformed direct simulatePlan call so this raw, not-yet-validated
    // source never invents ownership that later replay could mistake as fact.
    const ownerPersonId = state.account.ownerPersonId
    const accountBalances = ownedNonRothIraBalancesByOwner.get(ownerPersonId) ?? []
    accountBalances.push({
      sourceAccountId: state.account.id,
      balanceIndex,
      balancePlanDollars: state.balance,
    })
    ownedNonRothIraBalancesByOwner.set(ownerPersonId, accountBalances)
  }
  // The contract values that belong on line 6 beside those balances, read at
  // the same instant. Annuity accounts take no growth -- they hold no balance
  // the ledger could grow -- so reading the channel here rather than before
  // the growth loop changes no figure; it is read here so the two halves of
  // line 6 are captured at one boundary and the replay can say so.
  const annuityContractValuesByOwner = new Map<
    string | null,
    Array<{
      annuityAccountId: string
      fundingAccountId: string
      contractValueOpeningPlanDollars: number
      contractValuePlanDollars: number
    }>
  >()
  for (const { contract, funding, ownerPersonId } of annuityStagingCandidates) {
    const contractValuePlanDollars = annuityContractValue.get(contract.id)
    if (contractValuePlanDollars === undefined) continue
    const entries = annuityContractValuesByOwner.get(ownerPersonId) ?? []
    entries.push({
      annuityAccountId: contract.id,
      fundingAccountId: funding.id,
      contractValueOpeningPlanDollars:
        startOfYearAnnuityContractValue.get(contract.id) ?? 0,
      contractValuePlanDollars,
    })
    annuityContractValuesByOwner.set(ownerPersonId, entries)
  }
  const ownedNonRothIraPostGrowthSource = Object.freeze({
    status: 'postGrowthOwnedNonRothIraBalancesCaptured' as const,
    captureBoundary:
      'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication' as const,
    annualObservationValidation: 'notRun' as const,
    planId,
    taxYear: year,
    ownerPools: Object.freeze(
      [...ownedNonRothIraBalancesByOwner]
      .sort(([leftOwner], [rightOwner]) => {
        if (leftOwner === null) return rightOwner === null ? 0 : -1
        if (rightOwner === null) return 1
        return compareUtf16CodeUnits(leftOwner, rightOwner)
      })
      .map(([ownerPersonId, accountBalances]) => Object.freeze({
        ownerPersonId,
        accountBalances: Object.freeze(
          accountBalances
            .sort((left, right) =>
              compareUtf16CodeUnits(
                left.sourceAccountId,
                right.sourceAccountId,
              ) || left.balanceIndex - right.balanceIndex,
            )
            .map((balance) => Object.freeze({ ...balance })),
        ),
        annuityContractValues: Object.freeze(
          (annuityContractValuesByOwner.get(ownerPersonId) ?? [])
            .sort((left, right) => compareUtf16CodeUnits(
              left.annuityAccountId, right.annuityAccountId,
            ))
            .map((value) => Object.freeze({ ...value })),
        ),
      })),
    ),
  })

  return {
    ownedNonRothIraBalancesBeforeGrowth,
    ownedNonRothIraPhysicalBalancesBeforeGrowth,
    ownedNonRothIraPhysicalOpeningBalances,
    priorYearPortfolioReturnPct,
    ownedNonRothIraPostGrowthSource,
  }
}
