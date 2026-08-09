/**
 * Baseline-versus-proposal scenario comparison.
 *
 * All monetary arithmetic lives here so every consumer renders the same
 * proposal-minus-baseline result. Deterministic ledger amounts are nominal;
 * sustainable-spending capacity is explicitly today's dollars.
 */

import { createDecisionContext } from '../decisions/evaluateCandidate.js'
import {
  solveMaxSustainableSpending,
  type SustainableSpendingOptions,
  type SustainableSpendingResult,
} from '../decisions/spendingSolver.js'
import type { Plan } from '../model/plan.js'
import type { LtcShockParams } from '../montecarlo/ltcShock.js'
import type { MarketModelConfig } from '../montecarlo/marketModels.js'
import {
  comparePlansOnSharedMarketPaths,
  type SharedPathComparisonOptions,
} from '../montecarlo/sharedPaths.js'
import type { MonteCarloSummary } from '../montecarlo/run.js'
import { summarizeProjection } from '../projection/compare.js'
import { simulatePlan } from '../projection/simulate.js'
import type { ProjectionResult, TaxCalculator, YearResult } from '../projection/types.js'
import {
  compareScenarioActionRows,
  type ScenarioActionComparisonRow,
} from './actionRows.js'
import { scenarioPlanSnapshotHash } from './patch.js'

export interface ScalarComparison {
  baseline: number
  proposal: number
  /** Proposal minus baseline. */
  delta: number
}

export interface NullableScalarComparison {
  baseline: number | null
  proposal: number | null
  /** Null when either side has no comparable value. */
  delta: number | null
}

export interface ComparisonMoneyBasis {
  deterministic: 'nominal'
  annualLedger: 'nominal'
  stochastic: 'nominal'
  spendingCapacity: 'today'
  deltaConvention: 'proposal-minus-baseline'
}

export interface ScenarioPlanComparisonOptions {
  startYear: number
  /** Builds each side's tax stack from that side's own plan. */
  taxCalculatorForPlan: (plan: Plan) => TaxCalculator
  stochastic?: {
    model: MarketModelConfig
    pathCount: number
    seed: number
    stochasticLongevity?: boolean
    ltcShock?: LtcShockParams | null
    /**
     * Reports actual completed plan-path simulations across baseline and
     * proposal. The total is always `2 * pathCount`.
     */
    onProgress?: (completed: number, total: number) => void
  }
  /**
   * Optional because the exact-ledger bisection is intentionally much more
   * expensive than the ordinary comparison.
   */
  spendingCapacity?: Omit<SustainableSpendingOptions, 'basePatch'>
}

export interface ComparisonProvenance {
  startYear: number
  baselineSnapshotHash: string
  proposalSnapshotHash: string
}

export interface ScenarioHeadlineComparison {
  endingInvestable: ScalarComparison
  endingNetWorth: ScalarComparison
  endingAfterTaxEstate: ScalarComparison
  lifetimeTax: ScalarComparison
  lifetimePenalties: ScalarComparison
  lifetimeTaxesAndPenalties: ScalarComparison
  depletionYear: NullableScalarComparison
  /** Explicit simulation horizon; do not interpret a shorter horizon as earlier depletion. */
  projectionEndYear: ScalarComparison
}

export interface ScenarioSpendingComparison {
  intended: ScalarComparison
  funded: ScalarComparison
  totalShortfall: ScalarComparison
  requiredShortfall: ScalarComparison
  targetShortfall: ScalarComparison
  idealShortfall: ScalarComparison
  excessShortfall: ScalarComparison
}

export interface ScenarioIncomeComparison {
  wages: ScalarComparison
  socialSecurity: ScalarComparison
  pension: ScalarComparison
  annuity: ScalarComparison
  tipsLadder: ScalarComparison
  recurring: ScalarComparison
  oneTime: ScalarComparison
  taxableInterest: ScalarComparison
  ordinaryDividends: ScalarComparison
  qualifiedDividends: ScalarComparison
  taxableYield: ScalarComparison
  taxExemptInterest: ScalarComparison
  total: ScalarComparison
}

export interface ScenarioWithdrawalComparison {
  cash: ScalarComparison
  taxable: ScalarComparison
  traditional: ScalarComparison
  roth: ScalarComparison
  hsa: ScalarComparison
  total: ScalarComparison
  rothConversions: ScalarComparison
  rmd: ScalarComparison
  /** Forced inherited distribution only (voluntary draws are `inheritedVoluntary` annually). */
  inherited: ScalarComparison
  qcd: ScalarComparison
}

export interface ScenarioIrmaaComparison {
  surcharge: ScalarComparison
  totalMedicarePremiums: ScalarComparison
  surchargeTierYears: ScalarComparison
  maxTier: ScalarComparison
}

export interface ScenarioAcaComparison {
  grossEnrollmentPremium: ScalarComparison
  modeledAllowablePtc: ScalarComparison
  economicNetPremium: ScalarComparison
  actionableYears: ScalarComparison
  nonActionableYears: ScalarComparison
}

export interface ScenarioEstateComparison {
  grossNetWorth: ScalarComparison
  afterTaxEstate: ScalarComparison
  heirTax: ScalarComparison
  charity: ScalarComparison
  byCategory: {
    cash: ScalarComparison
    taxable: ScalarComparison
    traditional: ScalarComparison
    roth: ScalarComparison
    hsa: ScalarComparison
  }
}

export interface ScenarioSpendingCapacityComparison {
  maxBaseAnnual: NullableScalarComparison
  spendingSlack: NullableScalarComparison
  baselineConverged: boolean
  proposalConverged: boolean
  baselineSimulationCount: number
  proposalSimulationCount: number
  baselineLimitingConstraint: 'depletion' | 'estate-floor' | null
  proposalLimitingConstraint: 'depletion' | 'estate-floor' | null
  baselineDiagnostics: string[]
  proposalDiagnostics: string[]
}

export type ScenarioSpendingCapacityResult = Pick<
  SustainableSpendingResult,
  | 'maxBaseAnnual'
  | 'spendingSlackDollars'
  | 'converged'
  | 'simulationCount'
  | 'limitingConstraint'
  | 'diagnostics'
>

export interface AnnualComparisonValues {
  income: number
  spendingIntended: number
  spendingFunded: number
  tax: number
  penalties: number
  medicarePremiums: number
  irmaaSurcharge: number
  irmaaTier: number
  magi: number
  shortfall: number
  requiredShortfall: number
  targetShortfall: number
  investable: number
  netWorth: number
  withdrawals: number
  traditionalWithdrawals: number
  rothWithdrawals: number
  rothConversion: number
  rmd: number
  inheritedDistribution: number
  inheritedRequired: number
  /** Sum of evidence-row `voluntaryAmount` for the year (planner draws beyond forced). */
  inheritedVoluntary: number
  qcd: number
  acaGrossEnrollmentPremium: number
  acaModeledAllowablePtc: number
  acaEconomicNetPremium: number
  taxExemptInterest: number
}

export type AnnualComparisonValue = {
  [K in keyof AnnualComparisonValues]: NullableScalarComparison
}

export interface AnnualScenarioComparisonRow {
  year: number
  values: AnnualComparisonValue
}

export const ANNUAL_VALUE_KEYS = [
  'income',
  'spendingIntended',
  'spendingFunded',
  'tax',
  'penalties',
  'medicarePremiums',
  'irmaaSurcharge',
  'irmaaTier',
  'magi',
  'shortfall',
  'requiredShortfall',
  'targetShortfall',
  'investable',
  'netWorth',
  'withdrawals',
  'traditionalWithdrawals',
  'rothWithdrawals',
  'rothConversion',
  'rmd',
  'inheritedDistribution',
  'inheritedRequired',
  'inheritedVoluntary',
  'qcd',
  'acaGrossEnrollmentPremium',
  'acaModeledAllowablePtc',
  'acaEconomicNetPremium',
  'taxExemptInterest',
] as const satisfies readonly (keyof AnnualComparisonValues)[]

export interface ScenarioRiskComparison {
  provenance: {
    seed: number
    pathCount: number
    model: MarketModelConfig
    stochasticLongevity: boolean
    ltcShock: LtcShockParams | null
  }
  successRate: ScalarComparison
  requiredFloorSuccessRate: ScalarComparison
  targetLifestyleSuccessRate: ScalarComparison
  targetAttainmentP50: ScalarComparison
  expectedShortfallDollars: ScalarComparison
  expectedRequiredShortfallDollars: ScalarComparison
  expectedTargetShortfallDollars: ScalarComparison
  averageTotalShortfallDollars: ScalarComparison
  averageRequiredShortfallDollars: ScalarComparison
  averageTargetShortfallDollars: ScalarComparison
  probabilityOfAdjustment: ScalarComparison
  medianMaxCutDepth: ScalarComparison
  p90MaxCutDepth: ScalarComparison
  estateP10: ScalarComparison
  estateP50: ScalarComparison
  estateP90: ScalarComparison
  depletionProbabilityByYear: Array<{
    year: number
    cumulativeProbability: ScalarComparison
  }>
}

export interface ScenarioPlanComparison {
  moneyBasis: ComparisonMoneyBasis
  provenance: ComparisonProvenance
  headline: ScenarioHeadlineComparison
  spending: ScenarioSpendingComparison
  income: ScenarioIncomeComparison
  withdrawals: ScenarioWithdrawalComparison
  irmaa: ScenarioIrmaaComparison
  aca: ScenarioAcaComparison
  estate: ScenarioEstateComparison
  annual: AnnualScenarioComparisonRow[]
  actionRows: readonly Readonly<ScenarioActionComparisonRow>[]
  spendingCapacity: ScenarioSpendingCapacityComparison | null
  risk: ScenarioRiskComparison | null
}

const MONEY_BASIS: ComparisonMoneyBasis = {
  deterministic: 'nominal',
  annualLedger: 'nominal',
  stochastic: 'nominal',
  spendingCapacity: 'today',
  deltaConvention: 'proposal-minus-baseline',
}

function safeNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error('scenario comparison produced a non-finite number')
  return Object.is(value, -0) ? 0 : value
}

function scalar(baseline: number, proposal: number): ScalarComparison {
  const left = safeNumber(baseline)
  const right = safeNumber(proposal)
  return { baseline: left, proposal: right, delta: safeNumber(right - left) }
}

function nullableScalar(baseline: number | null, proposal: number | null): NullableScalarComparison {
  if (baseline === null || proposal === null) {
    return {
      baseline: baseline === null ? null : safeNumber(baseline),
      proposal: proposal === null ? null : safeNumber(proposal),
      delta: null,
    }
  }
  return scalar(baseline, proposal)
}

/** Compare two independently solved capacity results without moving dollar arithmetic into a UI. */
export function compareScenarioSpendingCapacityResults(
  baseline: ScenarioSpendingCapacityResult,
  proposal: ScenarioSpendingCapacityResult,
): ScenarioSpendingCapacityComparison {
  return {
    maxBaseAnnual: nullableScalar(baseline.maxBaseAnnual, proposal.maxBaseAnnual),
    spendingSlack: nullableScalar(baseline.spendingSlackDollars, proposal.spendingSlackDollars),
    baselineConverged: baseline.converged,
    proposalConverged: proposal.converged,
    baselineSimulationCount: baseline.simulationCount,
    proposalSimulationCount: proposal.simulationCount,
    baselineLimitingConstraint: baseline.limitingConstraint,
    proposalLimitingConstraint: proposal.limitingConstraint,
    baselineDiagnostics: [...baseline.diagnostics],
    proposalDiagnostics: [...proposal.diagnostics],
  }
}

function sum(years: YearResult[], read: (year: YearResult) => number): number {
  return safeNumber(years.reduce((total, year) => total + read(year), 0))
}

function aggregateIncome(years: YearResult[]) {
  return {
    wages: sum(years, (y) => y.incomes.wages),
    socialSecurity: sum(years, (y) => y.incomes.socialSecurity),
    pension: sum(years, (y) => y.incomes.pension),
    annuity: sum(years, (y) => y.incomes.annuity),
    tipsLadder: sum(years, (y) => y.incomes.tipsLadder),
    recurring: sum(years, (y) => y.incomes.recurring),
    oneTime: sum(years, (y) => y.incomes.oneTime),
    taxableInterest: sum(years, (y) => y.incomes.taxableInterest),
    ordinaryDividends: sum(years, (y) => y.incomes.ordinaryDividends),
    qualifiedDividends: sum(years, (y) => y.incomes.qualifiedDividends),
    taxableYield: sum(years, (y) => y.incomes.taxableYield),
    taxExemptInterest: sum(years, (y) => y.incomes.taxExemptInterest),
    total: sum(years, (y) => y.incomes.total),
  }
}

function aggregateWithdrawals(years: YearResult[]) {
  return {
    cash: sum(years, (y) => y.withdrawals.cash),
    taxable: sum(years, (y) => y.withdrawals.taxable),
    traditional: sum(years, (y) => y.withdrawals.traditional),
    roth: sum(years, (y) => y.withdrawals.roth),
    hsa: sum(years, (y) => y.withdrawals.hsa),
    total: sum(years, (y) => y.withdrawals.total),
    rothConversions: sum(years, (y) => y.rothConversion),
    rmd: sum(years, (y) => y.rmd),
    qcd: sum(years, (y) => y.qcd),
  }
}

function endingByCategory(plan: Plan, result: ProjectionResult) {
  const values = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0 }
  const last = result.years.at(-1)
  if (!last) return values
  for (const account of plan.accounts) {
    const category = account.type === 'equityComp' ? 'taxable' : account.type
    if (category in values) {
      values[category as keyof typeof values] += last.balances[account.id] ?? 0
    }
  }
  return values
}

function compareRecord<T extends Record<string, number>>(baseline: T, proposal: T): { [K in keyof T]: ScalarComparison } {
  return Object.fromEntries(
    Object.keys(baseline).map((key) => [key, scalar(baseline[key]!, proposal[key]!)]),
  ) as { [K in keyof T]: ScalarComparison }
}

function annualValues(year: YearResult): AnnualComparisonValues {
  return {
    income: year.incomes.total,
    spendingIntended: year.expenses.intendedSpending,
    spendingFunded: year.expenses.total,
    tax: year.tax,
    penalties: year.penalties,
    medicarePremiums: year.medicarePremiums,
    irmaaSurcharge: year.irmaaSurcharge,
    irmaaTier: year.irmaaTier,
    magi: year.magi,
    shortfall: year.shortfall,
    requiredShortfall: year.requiredShortfall,
    targetShortfall: year.targetShortfall,
    investable: year.investableTotal,
    netWorth: year.netWorth,
    withdrawals: year.withdrawals.total,
    traditionalWithdrawals: year.withdrawals.traditional,
    rothWithdrawals: year.withdrawals.roth,
    rothConversion: year.rothConversion,
    rmd: year.rmd,
    inheritedDistribution: year.inheritedDistribution,
    inheritedRequired: year.inheritedAccounts?.reduce(
      (total, account) => total + account.executedRequiredAmount,
      0,
    ) ?? 0,
    inheritedVoluntary: year.inheritedAccounts?.reduce(
      (total, account) => total + account.voluntaryAmount,
      0,
    ) ?? 0,
    qcd: year.qcd,
    acaGrossEnrollmentPremium: year.aca?.grossEnrollmentPremium ?? 0,
    acaModeledAllowablePtc: year.aca?.modeledAllowablePtc ?? 0,
    acaEconomicNetPremium: year.aca?.economicNetPremium ?? 0,
    taxExemptInterest: year.incomes.taxExemptInterest,
  }
}

function annualComparison(baseline: ProjectionResult, proposal: ProjectionResult): AnnualScenarioComparisonRow[] {
  const baselineByYear = new Map(baseline.years.map((year) => [year.year, annualValues(year)]))
  const proposalByYear = new Map(proposal.years.map((year) => [year.year, annualValues(year)]))
  const years = [...new Set([...baselineByYear.keys(), ...proposalByYear.keys()])].sort((a, b) => a - b)
  return years.map((year) => {
    const left = baselineByYear.get(year)
    const right = proposalByYear.get(year)
    const values = Object.fromEntries(
      ANNUAL_VALUE_KEYS.map((key) => [key, nullableScalar(left?.[key] ?? null, right?.[key] ?? null)]),
    ) as AnnualComparisonValue
    return { year, values }
  })
}

function sumAnnualValue(
  annual: AnnualScenarioComparisonRow[],
  key: keyof AnnualComparisonValues,
  side: 'baseline' | 'proposal',
): number {
  return safeNumber(annual.reduce((total, row) => total + (row.values[key][side] ?? 0), 0))
}

function cumulativeAt(summary: MonteCarloSummary, year: number): number {
  let cumulative = 0
  for (const row of summary.depletionProbabilityByYear) {
    if (row.year > year) break
    cumulative = row.cumulativeProbability
  }
  return cumulative
}

function riskComparison(
  baseline: MonteCarloSummary,
  proposal: MonteCarloSummary,
  options: NonNullable<ScenarioPlanComparisonOptions['stochastic']>,
): ScenarioRiskComparison {
  const years = [
    ...new Set([
      ...baseline.depletionProbabilityByYear.map((row) => row.year),
      ...proposal.depletionProbabilityByYear.map((row) => row.year),
    ]),
  ].sort((a, b) => a - b)
  return {
    provenance: {
      seed: options.seed,
      pathCount: options.pathCount,
      model: structuredClone(options.model),
      stochasticLongevity: options.stochasticLongevity ?? false,
      ltcShock: options.ltcShock ? structuredClone(options.ltcShock) : null,
    },
    successRate: scalar(baseline.successRate, proposal.successRate),
    requiredFloorSuccessRate: scalar(baseline.requiredFloorSuccessRate, proposal.requiredFloorSuccessRate),
    targetLifestyleSuccessRate: scalar(baseline.targetLifestyleSuccessRate, proposal.targetLifestyleSuccessRate),
    targetAttainmentP50: scalar(baseline.targetAttainmentPct.p50, proposal.targetAttainmentPct.p50),
    expectedShortfallDollars: scalar(
      baseline.downsideRisk.expectedShortfallDollars,
      proposal.downsideRisk.expectedShortfallDollars,
    ),
    expectedRequiredShortfallDollars: scalar(
      baseline.downsideRisk.expectedRequiredShortfallDollars,
      proposal.downsideRisk.expectedRequiredShortfallDollars,
    ),
    expectedTargetShortfallDollars: scalar(
      baseline.downsideRisk.expectedTargetShortfallDollars,
      proposal.downsideRisk.expectedTargetShortfallDollars,
    ),
    averageTotalShortfallDollars: scalar(
      baseline.spendingShortfall.averageTotalShortfallDollars,
      proposal.spendingShortfall.averageTotalShortfallDollars,
    ),
    averageRequiredShortfallDollars: scalar(
      baseline.spendingShortfall.averageRequiredShortfallDollars,
      proposal.spendingShortfall.averageRequiredShortfallDollars,
    ),
    averageTargetShortfallDollars: scalar(
      baseline.spendingShortfall.averageTargetShortfallDollars,
      proposal.spendingShortfall.averageTargetShortfallDollars,
    ),
    probabilityOfAdjustment: scalar(baseline.adjustments.pathsWithCut, proposal.adjustments.pathsWithCut),
    medianMaxCutDepth: scalar(baseline.adjustments.medianMaxCutDepth, proposal.adjustments.medianMaxCutDepth),
    p90MaxCutDepth: scalar(baseline.adjustments.p90MaxCutDepth, proposal.adjustments.p90MaxCutDepth),
    estateP10: scalar(
      baseline.endingAfterTaxEstate.percentiles.p10,
      proposal.endingAfterTaxEstate.percentiles.p10,
    ),
    estateP50: scalar(
      baseline.endingAfterTaxEstate.percentiles.p50,
      proposal.endingAfterTaxEstate.percentiles.p50,
    ),
    estateP90: scalar(
      baseline.endingAfterTaxEstate.percentiles.p90,
      proposal.endingAfterTaxEstate.percentiles.p90,
    ),
    depletionProbabilityByYear: years.map((year) => ({
      year,
      cumulativeProbability: scalar(cumulativeAt(baseline, year), cumulativeAt(proposal, year)),
    })),
  }
}

function validateOptions(options: ScenarioPlanComparisonOptions): void {
  if (!Number.isInteger(options.startYear)) throw new Error('startYear must be an integer')
  if (options.stochastic) {
    if (!Number.isInteger(options.stochastic.pathCount) || options.stochastic.pathCount <= 0) {
      throw new Error('stochastic pathCount must be a positive integer')
    }
    if (!Number.isFinite(options.stochastic.seed)) throw new Error('stochastic seed must be finite')
  }
}

/**
 * Compare two complete, validated plans. Inputs are never patched or mutated.
 */
export function compareScenarioPlans(
  baselinePlan: Plan,
  proposalPlan: Plan,
  options: ScenarioPlanComparisonOptions,
): ScenarioPlanComparison {
  validateOptions(options)
  const baselineTax = options.taxCalculatorForPlan(baselinePlan)
  const proposalTax = options.taxCalculatorForPlan(proposalPlan)
  const baselineResult = simulatePlan(baselinePlan, { startYear: options.startYear, taxCalculator: baselineTax })
  const proposalResult = simulatePlan(proposalPlan, { startYear: options.startYear, taxCalculator: proposalTax })
  const baselineSummary = summarizeProjection(baselinePlan, baselineResult)
  const proposalSummary = summarizeProjection(proposalPlan, proposalResult)
  const annual = annualComparison(baselineResult, proposalResult)
  const baselineIncome = aggregateIncome(baselineResult.years)
  const proposalIncome = aggregateIncome(proposalResult.years)
  const baselineWithdrawals = aggregateWithdrawals(baselineResult.years)
  const proposalWithdrawals = aggregateWithdrawals(proposalResult.years)
  const withdrawals: ScenarioWithdrawalComparison = {
    ...compareRecord(baselineWithdrawals, proposalWithdrawals),
    inherited: scalar(
      sumAnnualValue(annual, 'inheritedDistribution', 'baseline'),
      sumAnnualValue(annual, 'inheritedDistribution', 'proposal'),
    ),
  }
  const baselineEndingByCategory = endingByCategory(baselinePlan, baselineResult)
  const proposalEndingByCategory = endingByCategory(proposalPlan, proposalResult)

  const spending = {
    intended: scalar(
      sum(baselineResult.years, (y) => y.expenses.intendedSpending),
      sum(proposalResult.years, (y) => y.expenses.intendedSpending),
    ),
    funded: scalar(
      sum(baselineResult.years, (y) => y.expenses.total),
      sum(proposalResult.years, (y) => y.expenses.total),
    ),
    totalShortfall: scalar(
      sum(baselineResult.years, (y) => y.shortfall),
      sum(proposalResult.years, (y) => y.shortfall),
    ),
    requiredShortfall: scalar(
      sum(baselineResult.years, (y) => y.requiredShortfall),
      sum(proposalResult.years, (y) => y.requiredShortfall),
    ),
    targetShortfall: scalar(
      sum(baselineResult.years, (y) => y.targetShortfall),
      sum(proposalResult.years, (y) => y.targetShortfall),
    ),
    idealShortfall: scalar(
      sum(baselineResult.years, (y) => y.idealShortfall),
      sum(proposalResult.years, (y) => y.idealShortfall),
    ),
    excessShortfall: scalar(
      sum(baselineResult.years, (y) => y.excessShortfall),
      sum(proposalResult.years, (y) => y.excessShortfall),
    ),
  }

  let spendingCapacity: ScenarioSpendingCapacityComparison | null = null
  if (options.spendingCapacity) {
    const capacityOptionsFor = (plan: Plan): Omit<SustainableSpendingOptions, 'basePatch'> => ({
      ...options.spendingCapacity,
      estateFloorTodayDollars:
        options.spendingCapacity?.estateFloorTodayDollars ?? plan.expenses.bequestTargetDollars ?? 0,
    })
    const baselineSolved = solveMaxSustainableSpending(
      createDecisionContext(
        baselinePlan,
        { startYear: options.startYear, taxCalculator: baselineTax },
        { result: baselineResult, summary: baselineSummary },
        options.taxCalculatorForPlan,
      ),
      capacityOptionsFor(baselinePlan),
    )
    const proposalSolved = solveMaxSustainableSpending(
      createDecisionContext(
        proposalPlan,
        { startYear: options.startYear, taxCalculator: proposalTax },
        { result: proposalResult, summary: proposalSummary },
        options.taxCalculatorForPlan,
      ),
      capacityOptionsFor(proposalPlan),
    )
    spendingCapacity = compareScenarioSpendingCapacityResults(baselineSolved, proposalSolved)
  }

  let risk: ScenarioRiskComparison | null = null
  if (options.stochastic) {
    const stochasticOptions: SharedPathComparisonOptions = {
      startYear: options.startYear,
      taxCalculator: baselineTax,
      model: options.stochastic.model,
      pathCount: options.stochastic.pathCount,
      seed: options.stochastic.seed,
      stochasticLongevity: options.stochastic.stochasticLongevity,
      ltcShock: options.stochastic.ltcShock,
      onProgress: options.stochastic.onProgress,
    }
    const shared = comparePlansOnSharedMarketPaths(
      [
        { id: 'baseline', label: 'Baseline', plan: baselinePlan, taxCalculator: baselineTax },
        { id: 'proposal', label: 'Proposal', plan: proposalPlan, taxCalculator: proposalTax },
      ],
      stochasticOptions,
    )
    risk = riskComparison(shared.rows[0]!.summary, shared.rows[1]!.summary, options.stochastic)
  }

  return {
    moneyBasis: MONEY_BASIS,
    provenance: {
      startYear: options.startYear,
      baselineSnapshotHash: scenarioPlanSnapshotHash(baselinePlan),
      proposalSnapshotHash: scenarioPlanSnapshotHash(proposalPlan),
    },
    headline: {
      endingInvestable: scalar(baselineSummary.endingInvestable, proposalSummary.endingInvestable),
      endingNetWorth: scalar(baselineSummary.endingNetWorth, proposalSummary.endingNetWorth),
      endingAfterTaxEstate: scalar(baselineSummary.endingAfterTaxEstate, proposalSummary.endingAfterTaxEstate),
      lifetimeTax: scalar(
        sum(baselineResult.years, (y) => y.tax),
        sum(proposalResult.years, (y) => y.tax),
      ),
      lifetimePenalties: scalar(
        sum(baselineResult.years, (y) => y.penalties),
        sum(proposalResult.years, (y) => y.penalties),
      ),
      lifetimeTaxesAndPenalties: scalar(
        baselineSummary.lifetimeTaxesAndPenalties,
        proposalSummary.lifetimeTaxesAndPenalties,
      ),
      depletionYear: nullableScalar(baselineResult.depletionYear, proposalResult.depletionYear),
      projectionEndYear: scalar(baselineResult.endYear, proposalResult.endYear),
    },
    spending,
    income: compareRecord(baselineIncome, proposalIncome),
    withdrawals,
    irmaa: {
      surcharge: scalar(
        sum(baselineResult.years, (y) => y.irmaaSurcharge),
        sum(proposalResult.years, (y) => y.irmaaSurcharge),
      ),
      totalMedicarePremiums: scalar(
        sum(baselineResult.years, (y) => y.medicarePremiums),
        sum(proposalResult.years, (y) => y.medicarePremiums),
      ),
      surchargeTierYears: scalar(
        baselineResult.years.filter((y) => y.irmaaTier > 0).length,
        proposalResult.years.filter((y) => y.irmaaTier > 0).length,
      ),
      maxTier: scalar(
        Math.max(0, ...baselineResult.years.map((y) => y.irmaaTier)),
        Math.max(0, ...proposalResult.years.map((y) => y.irmaaTier)),
      ),
    },
    aca: {
      grossEnrollmentPremium: scalar(
        sum(baselineResult.years, (y) => y.aca?.grossEnrollmentPremium ?? 0),
        sum(proposalResult.years, (y) => y.aca?.grossEnrollmentPremium ?? 0),
      ),
      modeledAllowablePtc: scalar(
        sum(baselineResult.years, (y) => y.aca?.modeledAllowablePtc ?? 0),
        sum(proposalResult.years, (y) => y.aca?.modeledAllowablePtc ?? 0),
      ),
      economicNetPremium: scalar(
        sum(baselineResult.years, (y) => y.aca?.economicNetPremium ?? 0),
        sum(proposalResult.years, (y) => y.aca?.economicNetPremium ?? 0),
      ),
      actionableYears: scalar(
        baselineResult.years.filter((y) => y.aca?.readiness === 'actionable').length,
        proposalResult.years.filter((y) => y.aca?.readiness === 'actionable').length,
      ),
      nonActionableYears: scalar(
        baselineResult.years.filter((y) => y.aca?.readiness === 'nonActionable').length,
        proposalResult.years.filter((y) => y.aca?.readiness === 'nonActionable').length,
      ),
    },
    estate: {
      grossNetWorth: scalar(baselineSummary.endingNetWorth, proposalSummary.endingNetWorth),
      afterTaxEstate: scalar(baselineSummary.endingAfterTaxEstate, proposalSummary.endingAfterTaxEstate),
      heirTax: scalar(baselineSummary.endingEstateHeirTax, proposalSummary.endingEstateHeirTax),
      charity: scalar(baselineSummary.endingEstateToCharity, proposalSummary.endingEstateToCharity),
      byCategory: {
        cash: scalar(baselineEndingByCategory.cash, proposalEndingByCategory.cash),
        taxable: scalar(baselineEndingByCategory.taxable, proposalEndingByCategory.taxable),
        traditional: scalar(baselineEndingByCategory.traditional, proposalEndingByCategory.traditional),
        roth: scalar(baselineEndingByCategory.roth, proposalEndingByCategory.roth),
        hsa: scalar(baselineEndingByCategory.hsa, proposalEndingByCategory.hsa),
      },
    },
    annual,
    actionRows: compareScenarioActionRows(baselineResult.years, proposalResult.years),
    spendingCapacity,
    risk,
  }
}
