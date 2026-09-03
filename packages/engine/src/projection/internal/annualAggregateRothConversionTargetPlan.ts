/**
 * Pure annual target planning for the legacy aggregate Roth-conversion path.
 *
 * The caller supplies annual scalars and lazy readers of then-current state
 * after forced/named actions. This coordinator owns strategy selection,
 * taxable/gross translation, fill-to-target sizing, and safety-net trimming.
 * It never mutates balances or publishes warnings; `simulatePlan` retains the
 * ordered debit, credit, basis, runtime-journal, and warning commits.
 */
import type { Plan } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import {
  sizeRothConversion,
  type ConversionSizingInput,
} from '../../strategies/rothConversion.js'
import {
  AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS,
  ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS,
} from '../moneyTolerance.js'

const EPSILON = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS

type RothConversionStrategy = Plan['strategies']['rothConversion']
type AcaContract = NonNullable<
  Plan['expenses']['healthcare']['acaYears']
>[number]

export interface AnnualAggregateRothConversionTargetSource {
  /** Snapshot balance in the controlling annual conversion-source order. */
  readonly balancePlanDollars: number
  readonly convertible: boolean
  /** Taxable share of a gross conversion from this source, clamped by caller. */
  readonly taxableFraction: number
}

export interface AnnualAggregateRothConversionTargetSizingInput {
  readonly pack: ParameterPack
  readonly filingStatus: ConversionSizingInput['filingStatus']
  readonly ordinaryIncomeBase: number
  readonly capitalGains: number
  readonly qualifiedDividends: number
  readonly ssBenefits: number
  readonly peopleAged65Plus: number
  readonly householdSize: number
  readonly taxExemptInterest: number
  readonly inflationScale: number
  readonly itemizedDeductions: ConversionSizingInput['itemizedDeductions']
  readonly aca: Readonly<{
    readonly active: boolean
    readonly contract: AcaContract | undefined
    readonly initialSupportCodeCount: number
    readonly generatedTaxExemptInterest: number
    readonly planDerivedTaxExemptInterest: boolean
    readonly fallbackTaxFamilySize: number
  }>
}

export interface AnnualAggregateRothConversionSafetyNetInput {
  readonly floorTodayPlanDollars: number
  readonly inflationFactor: number
  /** Read one spendable value per liquid account, in Plan balance order. */
  readonly readSpendableLiquidBalances: () => readonly number[]
  readonly preConversionInflows: number
  readonly totalExpenses: number
  readonly contributions: number
  /** Price the annual tax at one additional taxable conversion amount. */
  readonly computeTaxForTaxableConversion: (
    taxableConversionPlanDollars: number,
  ) => number
}

export interface AnnualAggregateRothConversionTargetPlanInput {
  readonly strategy: RothConversionStrategy
  /** Named conversions suppress the legacy aggregate strategy for this year. */
  readonly namedConversionActionCount: number
  readonly anyAlive: boolean
  readonly year: number
  /** Read lazily: manual, optimized, suppressed, and out-of-window modes do not need it. */
  readonly readSources: () => readonly AnnualAggregateRothConversionTargetSource[]
  readonly sizing: Readonly<AnnualAggregateRothConversionTargetSizingInput>
  readonly safetyNet: Readonly<AnnualAggregateRothConversionSafetyNetInput>
}

interface AnnualAggregateRothConversionTargetDecision {
  readonly desiredPlanDollars: number
  /** Caller inserts these at the original warning-order boundary. */
  readonly warnings: readonly string[]
}

export interface AnnualAggregateRothConversionTargetPlanResult
  extends AnnualAggregateRothConversionTargetDecision {
  /** Reused by the downstream bracket-targeted withdrawal sizing pass. */
  readonly acaSizingInput: ConversionSizingInput['aca']
  /** Whether the unsuppressed aggregate strategy selected fill-to-target. */
  readonly fillToTargetSelected: boolean
  /** Reads the caller's then-current source snapshots when invoked. */
  readonly taxableAmountForGross: (grossPlanDollars: number) => number
}

function acaSizingInput(
  input: AnnualAggregateRothConversionTargetSizingInput['aca'],
): ConversionSizingInput['aca'] {
  if (!input.active) return undefined
  const contract = input.contract
  if (contract === undefined) {
    return {
      actionable: false,
      taxFamilySize: input.fallbackTaxFamilySize,
      fplRegion: 'contiguous',
      fixedMagiAddbacks: 0,
      taxExemptInterest: 0,
      foreignExclusionAddback: 0,
    }
  }
  return {
    actionable: input.initialSupportCodeCount === 0,
    taxFamilySize: contract.taxFamilyMembers.length,
    fplRegion: contract.fplRegion,
    fixedMagiAddbacks:
      (contract.foreignExclusionAddback.state === 'known'
        ? (contract.foreignExclusionAddback.amount ?? 0)
        : 0) +
      contract.taxFamilyMembers
        .filter(
          (member) =>
            member.relationship === 'dependent' &&
            member.requiredToFile === 'required',
        )
        .reduce((sum, member) => sum + member.magi, 0),
    taxExemptInterest:
      contract.taxExemptInterest.state === 'known'
        ? Math.max(
            Math.max(0, contract.taxExemptInterest.amount ?? 0),
            input.generatedTaxExemptInterest,
          )
        : input.planDerivedTaxExemptInterest
          ? input.generatedTaxExemptInterest
          : 0,
    foreignExclusionAddback:
      contract.foreignExclusionAddback.state === 'known'
        ? (contract.foreignExclusionAddback.amount ?? 0)
        : 0,
  }
}

function taxableAmountForGross(
  sources: readonly AnnualAggregateRothConversionTargetSource[],
  grossTarget: number,
): number {
  let remainingGross = Math.max(0, grossTarget)
  let taxable = 0
  for (const source of sources) {
    if (!source.convertible || remainingGross <= 0) continue
    const gross = Math.min(source.balancePlanDollars, remainingGross)
    taxable += gross * source.taxableFraction
    remainingGross -= gross
  }
  return taxable
}

function grossAmountForTaxable(
  sources: readonly AnnualAggregateRothConversionTargetSource[],
  taxableTarget: number,
): number {
  let remainingTaxable = Math.max(0, taxableTarget)
  let gross = 0
  for (const source of sources) {
    if (!source.convertible) continue
    if (source.taxableFraction <= 0) {
      gross += source.balancePlanDollars
      continue
    }
    const take = Math.min(
      source.balancePlanDollars,
      remainingTaxable / source.taxableFraction,
    )
    gross += take
    remainingTaxable -= take * source.taxableFraction
    if (remainingTaxable <= EPSILON) break
  }
  // Preserve the requested-above-capacity signal so execution retains its
  // existing reduced-conversion warning.
  return remainingTaxable > EPSILON ? gross + remainingTaxable : gross
}

function trimForSafetyNet(
  desiredPlanDollars: number,
  sources: readonly AnnualAggregateRothConversionTargetSource[],
  input: AnnualAggregateRothConversionSafetyNetInput,
): AnnualAggregateRothConversionTargetDecision {
  const floorNominal = input.floorTodayPlanDollars * input.inflationFactor
  let liquid = 0
  for (const balance of input.readSpendableLiquidBalances()) liquid += balance
  const netLiquid =
    liquid + input.preConversionInflows - input.totalExpenses - input.contributions
  const headroom = Math.max(0, netLiquid - floorNominal)
  const taxOf = (grossConversion: number): number =>
    input.computeTaxForTaxableConversion(
      taxableAmountForGross(sources, grossConversion),
    )
  const baseTax = taxOf(0)
  let trimmed = desiredPlanDollars
  for (let index = 0; index < 3; index += 1) {
    const conversionTax = Math.max(0, taxOf(trimmed) - baseTax)
    if (conversionTax <= headroom + EPSILON) break
    trimmed = conversionTax > 0
      ? Math.max(0, trimmed * (headroom / conversionTax))
      : 0
    if (trimmed <= AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS) {
      trimmed = 0
      break
    }
  }
  return {
    desiredPlanDollars: trimmed,
    warnings: trimmed < desiredPlanDollars - AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS
      ? ['Roth conversions were trimmed so their tax bill stays payable without breaching the taxable safety-net floor.']
      : [],
  }
}

/** Select and size this year's legacy aggregate Roth-conversion target. */
export function annualAggregateRothConversionTargetPlan(
  input: Readonly<AnnualAggregateRothConversionTargetPlanInput>,
): AnnualAggregateRothConversionTargetPlanResult {
  const strategy: RothConversionStrategy =
    input.namedConversionActionCount > 0 ? { mode: 'none' } : input.strategy
  const annualAcaSizingInput = acaSizingInput(input.sizing.aca)
  const result = (
    decision: AnnualAggregateRothConversionTargetDecision,
  ): AnnualAggregateRothConversionTargetPlanResult => ({
    ...decision,
    acaSizingInput: annualAcaSizingInput,
    fillToTargetSelected: strategy.mode === 'fillToTarget',
    taxableAmountForGross: (grossPlanDollars) =>
      taxableAmountForGross(input.readSources(), grossPlanDollars),
  })
  if (strategy.mode === 'none' || !input.anyAlive) {
    return result({ desiredPlanDollars: 0, warnings: [] })
  }

  if (strategy.mode === 'manual' || strategy.mode === 'optimized') {
    let desiredPlanDollars = 0
    for (const conversion of strategy.conversions) {
      if (conversion.year === input.year) {
        desiredPlanDollars += conversion.amount
      }
    }
    return result({ desiredPlanDollars, warnings: [] })
  }

  if (input.year < strategy.startYear || input.year > strategy.endYear) {
    return result({ desiredPlanDollars: 0, warnings: [] })
  }
  const sizing = input.sizing
  const sized = sizeRothConversion(strategy, {
    year: input.year,
    pack: sizing.pack,
    filingStatus: sizing.filingStatus,
    ordinaryIncomeBase: sizing.ordinaryIncomeBase,
    capitalGains: sizing.capitalGains,
    qualifiedDividends: sizing.qualifiedDividends,
    ssBenefits: sizing.ssBenefits,
    peopleAged65Plus: sizing.peopleAged65Plus,
    householdSize: sizing.householdSize,
    taxExemptInterest: sizing.taxExemptInterest,
    aca: annualAcaSizingInput,
    inflationScale: sizing.inflationScale,
    itemizedDeductions: sizing.itemizedDeductions,
  })
  if (!sized.ok) {
    // Kept after #495 D6 made the two everyday routes here parse errors (an
    // unpublished or open-ended bracket rate, a fixed MAGI of 0 or less are
    // refused by `planSchema` now, so a stored plan cannot carry one). This is
    // still reachable, and removing it would turn the remaining case from a
    // reported no-op into a silent one: `planSchema` validates the target
    // against the pack for the window's FIRST year, while sizing looks it up in
    // the pack for the year being simulated. A window that outlives a pack
    // whose rate ladder or IRMAA tier count changed can therefore hold a target
    // that was valid when it was authored and names no ceiling by the time it
    // is priced. `annualAggregateRothConversionTargetPlan.test.ts` covers it.
    if (sized.reason === 'bad_target') {
      return result({
        desiredPlanDollars: 0,
        warnings: ['The Roth-conversion target is invalid for this plan (unknown bracket or tier); no conversion made.'],
      })
    }
    if (sized.reason === 'aca_nonactionable') {
      return result({
        desiredPlanDollars: 0,
        warnings: ['The ACA-cliff Roth-conversion target was skipped because current-year ACA evidence is non-actionable.'],
      })
    }
    return result({ desiredPlanDollars: 0, warnings: [] })
  }

  const sources = input.readSources()
  const desiredPlanDollars = grossAmountForTaxable(sources, sized.amount)
  if (
    desiredPlanDollars <= AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS ||
    input.safetyNet.floorTodayPlanDollars <= 0
  ) {
    return result({ desiredPlanDollars, warnings: [] })
  }
  return result(trimForSafetyNet(desiredPlanDollars, sources, input.safetyNet))
}
