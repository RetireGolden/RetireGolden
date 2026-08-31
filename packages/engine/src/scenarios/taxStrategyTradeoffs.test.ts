import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import { maximizeAfterTaxEstate } from '../decisions/objectives.js'
import type { RankedDecision } from '../decisions/tournament.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import type { YearResult } from '../projection/types.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { compareScenarioPlans } from './comparison.js'
import {
  buildTaxStrategyEvaluation,
  parseTaxStrategyEvaluation,
  type TaxStrategyEvaluation,
} from './taxStrategyEvaluation.js'
import {
  buildTaxStrategyTradeoffs,
  canonicalTaxStrategyTradeoffsJson,
  CURRENT_TAX_STRATEGY_TRADEOFFS_VERSION,
  deriveAdverse,
  isTaxStrategyTradeoffsDocument,
  parseTaxStrategyTradeoffs,
  TAX_STRATEGY_TRADEOFFS_KIND,
  taxStrategyTradeoffsHash,
  verifyTaxStrategyTradeoffsBinding,
  type TradeoffMetric,
} from './taxStrategyTradeoffs.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026

function coupleWithCash(opts?: {
  p1PlanningAge?: number
  p2PlanningAge?: number
  hasQualifyingDependent?: boolean
}) {
  const plan = couplePlan({
    p1Dob: '1960-01-01',
    p2Dob: '1962-01-01',
    p1PlanningAge: opts?.p1PlanningAge ?? 75,
    p2PlanningAge: opts?.p2PlanningAge ?? 75,
    p1RetirementAge: 65,
    p2RetirementAge: 65,
  })
  plan.accounts = [cashAccount('cash', 600_000)]
  plan.accounts[0]!.ownerPersonId = 'p1'
  plan.expenses.baseAnnual = 40_000
  if (opts?.hasQualifyingDependent) {
    plan.household.hasQualifyingDependent = true
  }
  return validatePlan(plan)
}

function ordinaryWithdrawalAction(
  actionId: string,
  allocationId: string,
  year: number,
  cents: number,
) {
  return {
    actionId: asActionId(actionId),
    kind: 'ordinaryWithdrawal' as const,
    personId: asPersonId('p1'),
    year,
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(cents),
    allocations: [
      {
        allocationId: asAllocationId(allocationId),
        sourceAccountId: asAccountId('cash'),
        requestedAmount: asPositiveUsdCents(cents),
      },
    ],
    purpose: { kind: 'spending' as const },
    provenance: { source: 'manual' as const },
  }
}

function mockRanked(
  id: string,
  label: string,
  primaryValue: number,
  eligible: boolean,
  lossReason: string | null,
): RankedDecision {
  return {
    primaryValue,
    eligible,
    lossReason,
    constraintViolations: eligible ? [] : ['mock violation'],
    evaluation: {
      candidate: {
        id,
        source: 'heuristic',
        category: 'tax-cliff',
        label,
        explanation: 'test alternative',
      },
      baselineSummary: {} as RankedDecision['evaluation']['baselineSummary'],
      candidateSummary: {} as RankedDecision['evaluation']['candidateSummary'],
      candidateResult: {} as RankedDecision['evaluation']['candidateResult'],
      deltas: {
        endingAfterTaxEstate: 1_000,
        endingNetWorth: 500,
        lifetimeTax: -200,
        moneyLastsYears: 0,
      },
      conversionExecution: null,
      traditionalDepletionYear: null,
      diagnostics: [],
      recommendationState: eligible ? 'beneficial' : 'rejected',
    },
  }
}

function actionBearingPlans() {
  const baseline = coupleWithCash()
  baseline.strategies.retirementActions = [
    ordinaryWithdrawalAction('shared-action', 'shared-allocation', 2030, 12_345),
  ]
  const proposal = structuredClone(baseline)
  proposal.strategies.retirementActions = [
    ordinaryWithdrawalAction('shared-action', 'shared-allocation', 2031, 12_345),
  ]
  return {
    baseline: validatePlan(baseline),
    proposal: validatePlan(proposal),
  }
}

function buildEvaluationFromPlans(
  baseline: ReturnType<typeof validatePlan>,
  proposal: ReturnType<typeof validatePlan>,
  alternatives?: readonly RankedDecision[],
) {
  const comparison = compareScenarioPlans(baseline, proposal, {
    startYear: START_YEAR,
    taxCalculatorForPlan: () => noTax,
  })
  const evaluation = buildTaxStrategyEvaluation({
    comparison,
    objective: maximizeAfterTaxEstate,
    alternatives,
  })
  const baselineResult = simulatePlan(baseline, {
    startYear: START_YEAR,
    taxCalculator: noTax,
  })
  const proposalResult = simulatePlan(proposal, {
    startYear: START_YEAR,
    taxCalculator: noTax,
  })
  return {
    comparison,
    evaluation,
    baselineYears: baselineResult.years,
    proposalYears: proposalResult.years,
  }
}

function buildTradeoffsFromPlans(
  baseline: ReturnType<typeof validatePlan>,
  proposal: ReturnType<typeof validatePlan>,
  options?: {
    alternatives?: readonly RankedDecision[]
    withYears?: boolean
  },
) {
  const built = buildEvaluationFromPlans(baseline, proposal, options?.alternatives)
  const tradeoffs = buildTaxStrategyTradeoffs({
    evaluation: built.evaluation,
    ...(options?.withYears
      ? {
          baselineYears: built.baselineYears,
          proposalYears: built.proposalYears,
        }
      : {}),
  })
  return { ...built, tradeoffs }
}

function asRecord(value: unknown): Record<string, unknown> {
  return structuredClone(value) as Record<string, unknown>
}

function aliveCount(year: YearResult): number {
  return year.people.filter((p) => p.alive).length
}

/** First in-plan survivor transition year (mirrors production helper). */
function firstSurvivorTransitionYear(years: readonly YearResult[]): number | null {
  const ordered = [...years].sort((a, b) => a.year - b.year)
  for (let i = 1; i < ordered.length; i++) {
    if (aliveCount(ordered[i]!) === 1 && aliveCount(ordered[i - 1]!) >= 2) {
      return ordered[i]!.year
    }
  }
  return null
}

function handSumAnnual(
  evaluation: TaxStrategyEvaluation,
  firstSurvivorYear: number,
  field: 'tax' | 'spendingFunded' | 'shortfall' | 'requiredShortfall' | 'irmaaSurcharge' | 'magi',
  side: 'baseline' | 'proposal',
): number | null {
  let sum = 0
  for (const row of evaluation.comparison.annual) {
    if (row.year < firstSurvivorYear) continue
    const value = row.values[field][side]
    if (value === null) return null
    sum += value
  }
  return sum
}

describe('taxStrategyTradeoffs', () => {
  it('reconciles every dimension metric verbatim with its comparison source field', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { comparison, evaluation, tradeoffs } = buildTradeoffsFromPlans(
      baseline,
      proposal,
    )

    expect(tradeoffs.kind).toBe(TAX_STRATEGY_TRADEOFFS_KIND)
    expect(tradeoffs.version).toBe(CURRENT_TAX_STRATEGY_TRADEOFFS_VERSION)
    expect(tradeoffs.objective).toEqual({
      policyId: evaluation.objective.policyId,
      label: evaluation.objective.label,
      primaryMetricLabel: evaluation.objective.primaryMetricLabel,
      scope: 'single-objective',
    })
    expect(tradeoffs.dimensions.presentationContract).toBe(
      'all-dimensions-always-present-no-cross-dimension-ranking',
    )

    const dims = tradeoffs.dimensions
    const h = comparison.headline
    const s = comparison.spending
    const ir = comparison.irmaa
    const ac = comparison.aca
    const es = comparison.estate

    expect(dims.lifetimeTax.lifetimeTaxesAndPenalties).toMatchObject({
      baseline: h.lifetimeTaxesAndPenalties.baseline,
      proposal: h.lifetimeTaxesAndPenalties.proposal,
      delta: h.lifetimeTaxesAndPenalties.delta,
      betterDirection: 'lower',
    })
    expect(dims.lifetimeTax.lifetimeTax).toMatchObject({
      baseline: h.lifetimeTax.baseline,
      proposal: h.lifetimeTax.proposal,
      delta: h.lifetimeTax.delta,
      betterDirection: 'lower',
    })
    expect(dims.lifetimeTax.lifetimePenalties).toMatchObject({
      baseline: h.lifetimePenalties.baseline,
      proposal: h.lifetimePenalties.proposal,
      delta: h.lifetimePenalties.delta,
      betterDirection: 'lower',
    })
    expect(dims.lifetimeTax.depletionYear).toMatchObject({
      baseline: h.depletionYear.baseline,
      proposal: h.depletionYear.proposal,
      delta: h.depletionYear.delta,
      betterDirection: 'higher',
    })
    expect(dims.lifetimeTax.projectionEndYear).toMatchObject({
      baseline: h.projectionEndYear.baseline,
      proposal: h.projectionEndYear.proposal,
      delta: h.projectionEndYear.delta,
      betterDirection: 'contextual',
    })

    expect(dims.afterTaxSpending.funded).toMatchObject({
      baseline: s.funded.baseline,
      proposal: s.funded.proposal,
      delta: s.funded.delta,
      betterDirection: 'higher',
    })
    expect(dims.afterTaxSpending.intended).toMatchObject({
      baseline: s.intended.baseline,
      proposal: s.intended.proposal,
      delta: s.intended.delta,
      betterDirection: 'contextual',
    })
    expect(dims.afterTaxSpending.totalShortfall).toMatchObject({
      baseline: s.totalShortfall.baseline,
      proposal: s.totalShortfall.proposal,
      delta: s.totalShortfall.delta,
      betterDirection: 'lower',
    })
    expect(dims.afterTaxSpending.requiredShortfall).toMatchObject({
      baseline: s.requiredShortfall.baseline,
      proposal: s.requiredShortfall.proposal,
      delta: s.requiredShortfall.delta,
      betterDirection: 'lower',
    })
    expect(dims.afterTaxSpending.targetShortfall).toMatchObject({
      baseline: s.targetShortfall.baseline,
      proposal: s.targetShortfall.proposal,
      delta: s.targetShortfall.delta,
      betterDirection: 'lower',
    })
    // Default comparison has no spending-capacity solve.
    expect(dims.afterTaxSpending.capacity).toBeNull()

    expect(dims.medicareIrmaa.surcharge).toMatchObject({
      baseline: ir.surcharge.baseline,
      proposal: ir.surcharge.proposal,
      delta: ir.surcharge.delta,
      betterDirection: 'lower',
    })
    expect(dims.medicareIrmaa.totalMedicarePremiums).toMatchObject({
      baseline: ir.totalMedicarePremiums.baseline,
      proposal: ir.totalMedicarePremiums.proposal,
      delta: ir.totalMedicarePremiums.delta,
      betterDirection: 'lower',
    })
    expect(dims.medicareIrmaa.surchargeTierYears).toMatchObject({
      baseline: ir.surchargeTierYears.baseline,
      proposal: ir.surchargeTierYears.proposal,
      delta: ir.surchargeTierYears.delta,
      betterDirection: 'lower',
    })
    expect(dims.medicareIrmaa.maxTier).toMatchObject({
      baseline: ir.maxTier.baseline,
      proposal: ir.maxTier.proposal,
      delta: ir.maxTier.delta,
      betterDirection: 'lower',
    })

    expect(dims.acaPremiumTaxCredit.grossEnrollmentPremium).toMatchObject({
      baseline: ac.grossEnrollmentPremium.baseline,
      proposal: ac.grossEnrollmentPremium.proposal,
      delta: ac.grossEnrollmentPremium.delta,
      betterDirection: 'contextual',
    })
    expect(dims.acaPremiumTaxCredit.modeledAllowablePtc).toMatchObject({
      baseline: ac.modeledAllowablePtc.baseline,
      proposal: ac.modeledAllowablePtc.proposal,
      delta: ac.modeledAllowablePtc.delta,
      betterDirection: 'higher',
    })
    expect(dims.acaPremiumTaxCredit.economicNetPremium).toMatchObject({
      baseline: ac.economicNetPremium.baseline,
      proposal: ac.economicNetPremium.proposal,
      delta: ac.economicNetPremium.delta,
      betterDirection: 'lower',
    })
    expect(dims.acaPremiumTaxCredit.actionableYears).toMatchObject({
      baseline: ac.actionableYears.baseline,
      proposal: ac.actionableYears.proposal,
      delta: ac.actionableYears.delta,
      betterDirection: 'contextual',
    })
    expect(dims.acaPremiumTaxCredit.nonActionableYears).toMatchObject({
      baseline: ac.nonActionableYears.baseline,
      proposal: ac.nonActionableYears.proposal,
      delta: ac.nonActionableYears.delta,
      betterDirection: 'contextual',
    })

    expect(dims.estate.afterTaxEstate).toMatchObject({
      baseline: es.afterTaxEstate.baseline,
      proposal: es.afterTaxEstate.proposal,
      delta: es.afterTaxEstate.delta,
      betterDirection: 'higher',
    })
    expect(dims.estate.grossNetWorth).toMatchObject({
      baseline: es.grossNetWorth.baseline,
      proposal: es.grossNetWorth.proposal,
      delta: es.grossNetWorth.delta,
      betterDirection: 'higher',
    })
    expect(dims.estate.heirTax).toMatchObject({
      baseline: es.heirTax.baseline,
      proposal: es.heirTax.proposal,
      delta: es.heirTax.delta,
      betterDirection: 'lower',
    })
    expect(dims.estate.charity).toMatchObject({
      baseline: es.charity.baseline,
      proposal: es.charity.proposal,
      delta: es.charity.delta,
      betterDirection: 'contextual',
    })

    expect(() => verifyTaxStrategyTradeoffsBinding(tradeoffs, evaluation)).not.toThrow()
  })

  it('derives adverse from the sign rule for all three betterDirections; zero is not adverse', () => {
    expect(deriveAdverse(10, 'lower')).toBe(true)
    expect(deriveAdverse(-10, 'lower')).toBe(false)
    expect(deriveAdverse(0, 'lower')).toBe(false)

    expect(deriveAdverse(-5, 'higher')).toBe(true)
    expect(deriveAdverse(5, 'higher')).toBe(false)
    expect(deriveAdverse(0, 'higher')).toBe(false)

    expect(deriveAdverse(100, 'contextual')).toBeNull()
    expect(deriveAdverse(-100, 'contextual')).toBeNull()
    expect(deriveAdverse(0, 'contextual')).toBeNull()
    expect(deriveAdverse(null, 'lower')).toBeNull()
    expect(deriveAdverse(null, 'higher')).toBeNull()
    expect(deriveAdverse(null, 'contextual')).toBeNull()

    const { baseline, proposal } = actionBearingPlans()
    const { tradeoffs } = buildTradeoffsFromPlans(baseline, proposal)

    const check = (metric: TradeoffMetric) => {
      expect(metric.adverse).toBe(deriveAdverse(metric.delta, metric.betterDirection))
    }
    check(tradeoffs.dimensions.lifetimeTax.lifetimeTax)
    check(tradeoffs.dimensions.afterTaxSpending.funded)
    check(tradeoffs.dimensions.acaPremiumTaxCredit.grossEnrollmentPremium)
    check(tradeoffs.dimensions.estate.charity)
  })

  it('risk-null evaluation keeps successAdjustments and estate.percentiles null with all seven keys', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { comparison, tradeoffs } = buildTradeoffsFromPlans(baseline, proposal)

    expect(comparison.risk).toBeNull()
    expect(tradeoffs.dimensions.successAdjustments).toBeNull()
    expect(tradeoffs.dimensions.estate.percentiles).toBeNull()

    const keys = Object.keys(tradeoffs.dimensions).sort()
    expect(keys).toEqual(
      [
        'acaPremiumTaxCredit',
        'afterTaxSpending',
        'estate',
        'lifetimeTax',
        'medicareIrmaa',
        'presentationContract',
        'successAdjustments',
        'survivor',
      ].sort(),
    )
  })

  it('survivor: death mid-horizon yields evidence with matching firstSurvivorYear, sums, and QSS/single path', () => {
    // p1 dies after age 68 (last alive year 2028), p2 lives to 80; QSS for two years when dependent.
    const baseline = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 80,
      hasQualifyingDependent: true,
    })
    const proposal = structuredClone(baseline)
    proposal.strategies.retirementActions = [
      ordinaryWithdrawalAction('proposal-only', 'proposal-alloc', 2027, 5_000),
    ]
    const { evaluation, baselineYears, proposalYears, tradeoffs } =
      buildTradeoffsFromPlans(validatePlan(baseline), validatePlan(proposal), {
        withYears: true,
      })

    const expectedFirst = firstSurvivorTransitionYear(proposalYears)
    expect(expectedFirst).not.toBeNull()
    expect(firstSurvivorTransitionYear(baselineYears)).toBe(expectedFirst)

    expect(tradeoffs.dimensions.survivor.status).toBe('evidence')
    if (tradeoffs.dimensions.survivor.status !== 'evidence') return

    const survivor = tradeoffs.dimensions.survivor
    expect(survivor.firstSurvivorYear).toBe(expectedFirst)

    // QSS for years after death through death+2, then single.
    expect(survivor.filingStatusPath[0]).toBe('qualifyingSurvivingSpouse')
    expect(survivor.filingStatusPath).toContain('single')
    expect(survivor.filingStatusPath).toEqual(
      [...survivor.filingStatusPath].filter(
        (status, index, arr) => index === 0 || status !== arr[index - 1],
      ),
    )

    const first = survivor.firstSurvivorYear
    expect(survivor.tax.baseline).toBe(handSumAnnual(evaluation, first, 'tax', 'baseline'))
    expect(survivor.tax.proposal).toBe(handSumAnnual(evaluation, first, 'tax', 'proposal'))
    expect(survivor.tax.delta).toBe(
      (survivor.tax.proposal as number) - (survivor.tax.baseline as number),
    )
    expect(survivor.spendingFunded.baseline).toBe(
      handSumAnnual(evaluation, first, 'spendingFunded', 'baseline'),
    )
    expect(survivor.spendingFunded.proposal).toBe(
      handSumAnnual(evaluation, first, 'spendingFunded', 'proposal'),
    )
    expect(survivor.spendingShortfall.baseline).toBe(
      handSumAnnual(evaluation, first, 'shortfall', 'baseline'),
    )
    expect(survivor.spendingShortfall.proposal).toBe(
      handSumAnnual(evaluation, first, 'shortfall', 'proposal'),
    )
    expect(survivor.requiredShortfall.baseline).toBe(
      handSumAnnual(evaluation, first, 'requiredShortfall', 'baseline'),
    )
    expect(survivor.requiredShortfall.proposal).toBe(
      handSumAnnual(evaluation, first, 'requiredShortfall', 'proposal'),
    )
    expect(survivor.irmaaSurcharge.baseline).toBe(
      handSumAnnual(evaluation, first, 'irmaaSurcharge', 'baseline'),
    )
    expect(survivor.irmaaSurcharge.proposal).toBe(
      handSumAnnual(evaluation, first, 'irmaaSurcharge', 'proposal'),
    )
    expect(survivor.magi.baseline).toBe(handSumAnnual(evaluation, first, 'magi', 'baseline'))
    expect(survivor.magi.proposal).toBe(handSumAnnual(evaluation, first, 'magi', 'proposal'))
    expect(survivor.magi.betterDirection).toBe('contextual')
    expect(survivor.magi.adverse).toBeNull()

    expect(() => verifyTaxStrategyTradeoffsBinding(tradeoffs, evaluation)).not.toThrow()
  })

  it('survivor: no-death fixture → absent(no-survivor-phase)', () => {
    // Same DOB + planning age ⇒ both leave the ledger the same year, so no
    // calendar year ever has exactly one alive person.
    const baseline = couplePlan({
      p1Dob: '1960-01-01',
      p2Dob: '1960-01-01',
      p1PlanningAge: 75,
      p2PlanningAge: 75,
      p1RetirementAge: 65,
      p2RetirementAge: 65,
    })
    baseline.accounts = [cashAccount('cash', 600_000)]
    baseline.accounts[0]!.ownerPersonId = 'p1'
    baseline.expenses.baseAnnual = 40_000
    const proposal = structuredClone(baseline)
    proposal.strategies.retirementActions = [
      ordinaryWithdrawalAction('shared-action', 'shared-allocation', 2031, 12_345),
    ]
    const { tradeoffs, baselineYears, proposalYears } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      { withYears: true },
    )
    expect(firstSurvivorTransitionYear(baselineYears)).toBeNull()
    expect(firstSurvivorTransitionYear(proposalYears)).toBeNull()
    expect(tradeoffs.dimensions.survivor).toEqual({
      status: 'absent',
      reason: 'no-survivor-phase',
    })
  })

  it('survivor: single-person plan → absent(no-survivor-phase)', () => {
    const baseline = singlePersonPlan({
      dob: '1960-01-01',
      planningAge: 75,
      retirementAge: 65,
    })
    baseline.accounts = [cashAccount('cash', 600_000)]
    baseline.accounts[0]!.ownerPersonId = 'p1'
    baseline.expenses.baseAnnual = 40_000
    const proposal = structuredClone(baseline)
    proposal.strategies.retirementActions = [
      ordinaryWithdrawalAction('shared-action', 'shared-allocation', 2031, 12_345),
    ]
    const { tradeoffs, baselineYears, proposalYears } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      { withYears: true },
    )
    // Single-person: every year has aliveCount === 1; no i>0 transition from >=2.
    expect(baselineYears.every((y) => aliveCount(y) === 1)).toBe(true)
    expect(proposalYears.every((y) => aliveCount(y) === 1)).toBe(true)
    expect(firstSurvivorTransitionYear(baselineYears)).toBeNull()
    expect(firstSurvivorTransitionYear(proposalYears)).toBeNull()
    expect(tradeoffs.dimensions.survivor).toEqual({
      status: 'absent',
      reason: 'no-survivor-phase',
    })
  })

  it('survivor: couple already one-alive in first bound year → absent(no-survivor-phase)', () => {
    // p1 last alive year = 1960 + 65 = 2025; startYear 2026 ⇒ first bound year
    // already has only p2 alive (no in-horizon joint→survivor transition).
    const baseline = coupleWithCash({
      p1PlanningAge: 65,
      p2PlanningAge: 80,
    })
    const proposal = structuredClone(baseline)
    proposal.strategies.retirementActions = [
      ordinaryWithdrawalAction('shared-action', 'shared-allocation', 2031, 12_345),
    ]
    const { tradeoffs, baselineYears, proposalYears } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      { withYears: true },
    )
    expect(baselineYears.length).toBeGreaterThan(0)
    expect(aliveCount(baselineYears[0]!)).toBe(1)
    expect(aliveCount(proposalYears[0]!)).toBe(1)
    expect(firstSurvivorTransitionYear(baselineYears)).toBeNull()
    expect(firstSurvivorTransitionYear(proposalYears)).toBeNull()
    expect(tradeoffs.dimensions.survivor).toEqual({
      status: 'absent',
      reason: 'no-survivor-phase',
    })
  })

  it('survivor: years not supplied → absent(ledger-years-not-supplied)', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { tradeoffs } = buildTradeoffsFromPlans(baseline, proposal)
    expect(tradeoffs.dimensions.survivor).toEqual({
      status: 'absent',
      reason: 'ledger-years-not-supplied',
    })
  })

  it('survivor: one side supplied → throws', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { evaluation, proposalYears } = buildEvaluationFromPlans(baseline, proposal)

    expect(() =>
      buildTaxStrategyTradeoffs({
        evaluation,
        proposalYears,
      }),
    ).toThrow(/both be supplied or both omitted/)

    const { baselineYears } = buildEvaluationFromPlans(baseline, proposal)
    expect(() =>
      buildTaxStrategyTradeoffs({
        evaluation,
        baselineYears,
      }),
    ).toThrow(/both be supplied or both omitted/)
  })

  it('survivor: mismatched windows → absent(survivor-window-mismatch)', () => {
    const baseline = coupleWithCash({ p1PlanningAge: 68, p2PlanningAge: 80 })
    const proposal = coupleWithCash({ p1PlanningAge: 72, p2PlanningAge: 80 })
    proposal.accounts = [cashAccount('cash', 600_000)]
    proposal.accounts[0]!.ownerPersonId = 'p1'
    proposal.expenses.baseAnnual = 40_000

    const { evaluation, baselineYears, proposalYears } = buildEvaluationFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
    )

    const baselineFirst = firstSurvivorTransitionYear(baselineYears)
    const proposalFirst = firstSurvivorTransitionYear(proposalYears)
    expect(baselineFirst).not.toBeNull()
    expect(proposalFirst).not.toBeNull()
    expect(baselineFirst).not.toBe(proposalFirst)

    const tradeoffs = buildTaxStrategyTradeoffs({
      evaluation,
      baselineYears,
      proposalYears,
    })
    expect(tradeoffs.dimensions.survivor).toEqual({
      status: 'absent',
      reason: 'survivor-window-mismatch',
    })
  })

  it('survivor: one-sided annual row inside survivor window → absent(survivor-window-mismatch)', () => {
    // Same p1 death year on both sides; shorter proposal p2 horizon leaves
    // baseline-only comparison rows after firstSurvivorYear.
    const baseline = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 80,
      hasQualifyingDependent: true,
    })
    const proposal = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 72,
      hasQualifyingDependent: true,
    })
    const { evaluation, baselineYears, proposalYears, tradeoffs } =
      buildTradeoffsFromPlans(baseline, proposal, { withYears: true })

    const expectedFirst = firstSurvivorTransitionYear(proposalYears)
    expect(expectedFirst).not.toBeNull()
    expect(firstSurvivorTransitionYear(baselineYears)).toBe(expectedFirst)

    const exemptInWindow = evaluation.comparison.annual.filter(
      (row) =>
        row.year >= expectedFirst! &&
        (Object.values(row.values).every((comparison) => comparison.proposal === null) ||
          Object.values(row.values).every((comparison) => comparison.baseline === null)),
    )
    expect(exemptInWindow.length).toBeGreaterThan(0)

    expect(tradeoffs.dimensions.survivor).toEqual({
      status: 'absent',
      reason: 'survivor-window-mismatch',
    })
    expect(() =>
      verifyTaxStrategyTradeoffsBinding(tradeoffs, evaluation, {
        baselineYears,
        proposalYears,
      }),
    ).not.toThrow()
  })

  it('survivor: tampered year magi → throws naming year', () => {
    const baseline = coupleWithCash({ p1PlanningAge: 68, p2PlanningAge: 80 })
    const proposal = structuredClone(baseline)
    const { evaluation, baselineYears, proposalYears } = buildEvaluationFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
    )

    const tampered = proposalYears.map((year, index) =>
      index === 0
        ? ({ ...year, magi: year.magi + 1 } as YearResult)
        : year,
    )

    expect(() =>
      buildTaxStrategyTradeoffs({
        evaluation,
        baselineYears,
        proposalYears: tampered,
      }),
    ).toThrow(/year \d+ magi/)
  })

  it('anti-optimality: schema rejects unknown keys, tampered adverse, bad alternatives order, missing scope', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { tradeoffs } = buildTradeoffsFromPlans(baseline, proposal, {
      alternatives: [
        mockRanked('alt-b', 'B', 50, false, 'trails'),
        mockRanked('alt-a', 'A', 100, true, null),
      ],
    })

    const withWinner = asRecord(tradeoffs)
    withWinner.winner = 'proposal'
    expect(() => parseTaxStrategyTradeoffs(withWinner)).toThrow()
    expect(isTaxStrategyTradeoffsDocument(withWinner)).toBe(false)

    const withScore = asRecord(tradeoffs)
    const dims = withScore.dimensions as Record<string, unknown>
    dims.score = 99
    expect(() => parseTaxStrategyTradeoffs(withScore)).toThrow()

    const tamperedAdverse = asRecord(tradeoffs)
    const lifetimeTax = (tamperedAdverse.dimensions as Record<string, unknown>)
      .lifetimeTax as Record<string, unknown>
    const lifetimeTaxMetric = lifetimeTax.lifetimeTax as Record<string, unknown>
    // Flip adverse regardless of delta sign.
    lifetimeTaxMetric.adverse = !lifetimeTaxMetric.adverse
    expect(() => parseTaxStrategyTradeoffs(tamperedAdverse)).toThrow()

    const outOfOrder = asRecord(tradeoffs)
    outOfOrder.alternatives = [
      {
        candidateId: 'zzz',
        label: 'Z',
        source: 'heuristic',
        category: 'tax-cliff',
        recommendationState: 'beneficial',
        primaryValue: 1,
        eligible: true,
        lossReason: null,
        deltas: {
          endingAfterTaxEstate: 0,
          endingNetWorth: 0,
          lifetimeTax: 0,
          moneyLastsYears: 0,
        },
      },
      {
        candidateId: 'aaa',
        label: 'A',
        source: 'heuristic',
        category: 'tax-cliff',
        recommendationState: 'beneficial',
        primaryValue: 2,
        eligible: true,
        lossReason: null,
        deltas: {
          endingAfterTaxEstate: 0,
          endingNetWorth: 0,
          lifetimeTax: 0,
          moneyLastsYears: 0,
        },
      },
    ]
    expect(() => parseTaxStrategyTradeoffs(outOfOrder)).toThrow()

    const duplicated = asRecord(tradeoffs)
    const alt = {
      candidateId: 'dup',
      label: 'Dup',
      source: 'heuristic',
      category: 'tax-cliff',
      recommendationState: 'beneficial',
      primaryValue: 1,
      eligible: true,
      lossReason: null,
      deltas: {
        endingAfterTaxEstate: 0,
        endingNetWorth: 0,
        lifetimeTax: 0,
        moneyLastsYears: 0,
      },
    }
    duplicated.alternatives = [alt, { ...alt }]
    expect(() => parseTaxStrategyTradeoffs(duplicated)).toThrow()

    const missingScope = asRecord(tradeoffs)
    const objective = missingScope.objective as Record<string, unknown>
    delete objective.scope
    expect(() => parseTaxStrategyTradeoffs(missingScope)).toThrow()
  })

  it('verify binding: forged alternative primaryValue / edited metric / edited survivor sum fail', () => {
    const baseline = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 80,
      hasQualifyingDependent: true,
    })
    const proposal = structuredClone(baseline)
    const { evaluation, tradeoffs } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      {
        withYears: true,
        alternatives: [
          mockRanked('alt-b', 'B', 50, false, 'trails'),
          mockRanked('alt-a', 'A', 100, true, null),
        ],
      },
    )

    expect(() => verifyTaxStrategyTradeoffsBinding(tradeoffs, evaluation)).not.toThrow()

    // Coherent forgery: primaryValue change still parses (order/shape ok) but fails binding.
    const forgedAlt = asRecord(tradeoffs)
    const alts = forgedAlt.alternatives as Array<Record<string, unknown>>
    expect(alts.length).toBeGreaterThan(0)
    const target = alts.find((row) => row.candidateId === 'alt-a')!
    target.primaryValue = (target.primaryValue as number) + 999
    const parsedForged = parseTaxStrategyTradeoffs(forgedAlt)
    expect(() => verifyTaxStrategyTradeoffsBinding(parsedForged, evaluation)).toThrow(
      /candidate alt-a/,
    )

    const forgedMetric = asRecord(tradeoffs)
    const lifetimeTax = (forgedMetric.dimensions as Record<string, unknown>)
      .lifetimeTax as Record<string, unknown>
    const metric = lifetimeTax.lifetimeTax as Record<string, unknown>
    metric.baseline = (metric.baseline as number) + 1
    metric.delta = (metric.proposal as number) - (metric.baseline as number)
    metric.adverse = deriveAdverse(
      metric.delta as number,
      'lower',
    )
    const parsedMetric = parseTaxStrategyTradeoffs(forgedMetric)
    expect(() => verifyTaxStrategyTradeoffsBinding(parsedMetric, evaluation)).toThrow(
      /lifetimeTax\.lifetimeTax/,
    )

    expect(tradeoffs.dimensions.survivor.status).toBe('evidence')
    const forgedSurvivor = asRecord(tradeoffs)
    const survivor = (forgedSurvivor.dimensions as Record<string, unknown>)
      .survivor as Record<string, unknown>
    const taxMetric = survivor.tax as Record<string, unknown>
    taxMetric.proposal = (taxMetric.proposal as number) + 1
    taxMetric.delta =
      (taxMetric.proposal as number) - (taxMetric.baseline as number)
    taxMetric.adverse = deriveAdverse(taxMetric.delta as number, 'lower')
    const parsedSurvivor = parseTaxStrategyTradeoffs(forgedSurvivor)
    expect(() => verifyTaxStrategyTradeoffsBinding(parsedSurvivor, evaluation)).toThrow(
      /survivor\.tax/,
    )
  })

  it('determinism: canonical JSON key-order stable; hash stable across two builds', () => {
    const { baseline, proposal } = actionBearingPlans()
    const built = buildEvaluationFromPlans(baseline, proposal, [
      mockRanked('alt-b', 'B', 50, false, 'trails'),
      mockRanked('alt-a', 'A', 100, true, null),
    ])

    const first = buildTaxStrategyTradeoffs({ evaluation: built.evaluation })
    const second = buildTaxStrategyTradeoffs({ evaluation: built.evaluation })

    expect(canonicalTaxStrategyTradeoffsJson(first)).toBe(
      canonicalTaxStrategyTradeoffsJson(second),
    )
    expect(taxStrategyTradeoffsHash(first)).toBe(taxStrategyTradeoffsHash(second))
    expect(taxStrategyTradeoffsHash(first)).toMatch(/^fnv1a64:[0-9a-f]{16}$/)

    // Alternatives are canonical-ordered even when evaluation input was not.
    expect(first.alternatives.map((row) => row.candidateId)).toEqual(['alt-a', 'alt-b'])
  })

  it('deep-freezes the document, a dimension metric, alternatives array and one row', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { tradeoffs } = buildTradeoffsFromPlans(baseline, proposal, {
      alternatives: [mockRanked('alt-a', 'A', 100, true, null)],
    })

    expect(Object.isFrozen(tradeoffs)).toBe(true)
    expect(Object.isFrozen(tradeoffs.dimensions)).toBe(true)
    expect(Object.isFrozen(tradeoffs.dimensions.lifetimeTax.lifetimeTax)).toBe(true)
    expect(Object.isFrozen(tradeoffs.alternatives)).toBe(true)
    expect(tradeoffs.alternatives.length).toBe(1)
    expect(Object.isFrozen(tradeoffs.alternatives[0]!)).toBe(true)
    expect(Object.isFrozen(tradeoffs.alternatives[0]!.deltas)).toBe(true)
    expect(Object.isFrozen(tradeoffs.provenance.parameterBasis.standInYears)).toBe(true)
  })

  it('forged objective.label rejects at parse', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { tradeoffs } = buildTradeoffsFromPlans(baseline, proposal)
    const forged = asRecord(tradeoffs)
    const objective = forged.objective as Record<string, unknown>
    objective.label = 'Composite score'
    expect(() => parseTaxStrategyTradeoffs(forged)).toThrow()
    objective.label = maximizeAfterTaxEstate.label
    objective.primaryMetricLabel = 'Composite score'
    expect(() => parseTaxStrategyTradeoffs(forged)).toThrow()
  })

  it('verify binding: injected winner key or wrong kind fails binding (not just parse)', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { evaluation, tradeoffs } = buildTradeoffsFromPlans(baseline, proposal)

    const withWinner = asRecord(tradeoffs)
    withWinner.winner = 'proposal'
    expect(() => verifyTaxStrategyTradeoffsBinding(withWinner as never, evaluation)).toThrow()

    const wrongKind = asRecord(tradeoffs)
    wrongKind.kind = 'retiregolden.not-tradeoffs'
    expect(() => verifyTaxStrategyTradeoffsBinding(wrongKind as never, evaluation)).toThrow()

    const wrongContract = asRecord(tradeoffs)
    const dims = wrongContract.dimensions as Record<string, unknown>
    dims.presentationContract = 'all-dimensions-always-present-no-ranking'
    expect(() =>
      verifyTaxStrategyTradeoffsBinding(wrongContract as never, evaluation),
    ).toThrow()
  })

  it('survivor: fabricated proposal YearResult for a baseline-only year does not change survivor', () => {
    // Same-DOB couple, no single-alive year on either side. Higher planningAge is
    // last-alive age (endYear = dobYear + planningAge), so baseline outlives proposal
    // and comparison.annual has baseline-only tail years.
    const baseline = couplePlan({
      p1Dob: '1960-01-01',
      p2Dob: '1960-01-01',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
      p1RetirementAge: 65,
      p2RetirementAge: 65,
    })
    baseline.accounts = [cashAccount('cash', 600_000)]
    baseline.accounts[0]!.ownerPersonId = 'p1'
    baseline.expenses.baseAnnual = 40_000
    const proposal = couplePlan({
      p1Dob: '1960-01-01',
      p2Dob: '1960-01-01',
      p1PlanningAge: 72,
      p2PlanningAge: 72,
      p1RetirementAge: 65,
      p2RetirementAge: 65,
    })
    proposal.accounts = [cashAccount('cash', 600_000)]
    proposal.accounts[0]!.ownerPersonId = 'p1'
    proposal.expenses.baseAnnual = 40_000
    proposal.strategies.retirementActions = [
      ordinaryWithdrawalAction('proposal-only', 'proposal-alloc', 2027, 5_000),
    ]
    const { evaluation, baselineYears, proposalYears } = buildEvaluationFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
    )

    const baselineOnlyYears = evaluation.comparison.annual
      .filter((row) =>
        Object.values(row.values).every((comparison) => comparison.proposal === null),
      )
      .map((row) => row.year)
    expect(baselineOnlyYears.length).toBeGreaterThan(0)

    const honest = buildTaxStrategyTradeoffs({
      evaluation,
      baselineYears,
      proposalYears,
    })
    expect(honest.dimensions.survivor).toEqual({
      status: 'absent',
      reason: 'no-survivor-phase',
    })

    const fabricYear = baselineOnlyYears[0]!
    const template = proposalYears[proposalYears.length - 1]!
    // Pre-fix this would invent a survivor window from the exempt-side fabrication.
    const fabricatedProposalYears: YearResult[] = [
      ...proposalYears,
      {
        ...template,
        year: fabricYear,
        people: [{ personId: asPersonId('p1'), ageAttained: 90, alive: true }],
        filingStatus: 'single',
      } as YearResult,
    ]

    const attacked = buildTaxStrategyTradeoffs({
      evaluation,
      baselineYears,
      proposalYears: fabricatedProposalYears,
    })
    expect(attacked.dimensions.survivor).toEqual(honest.dimensions.survivor)
  })

  it('survivor: forged firstSurvivorYear fails evidence minimums at parse/binding', () => {
    const baseline = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 80,
      hasQualifyingDependent: true,
    })
    const proposal = structuredClone(baseline)
    const { evaluation, tradeoffs } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      { withYears: true },
    )
    expect(tradeoffs.dimensions.survivor.status).toBe('evidence')

    // Empty path is schema-invalid.
    const emptyPath = asRecord(tradeoffs)
    const survivorEmpty = (emptyPath.dimensions as Record<string, unknown>)
      .survivor as Record<string, unknown>
    survivorEmpty.filingStatusPath = []
    expect(() => parseTaxStrategyTradeoffs(emptyPath)).toThrow()

    // Year not in comparison.annual: coerce path non-empty, re-sum under forged year (zeros).
    const forgedYear = asRecord(tradeoffs)
    const survivorForged = (forgedYear.dimensions as Record<string, unknown>)
      .survivor as Record<string, unknown>
    survivorForged.firstSurvivorYear = 9999
    // Sums over empty window are zero with non-null annual fields — keep coherent metrics.
    for (const key of [
      'tax',
      'spendingFunded',
      'spendingShortfall',
      'requiredShortfall',
      'irmaaSurcharge',
      'magi',
    ] as const) {
      const metric = survivorForged[key] as Record<string, unknown>
      metric.baseline = 0
      metric.proposal = 0
      metric.delta = 0
      metric.adverse =
        key === 'magi' ? null : deriveAdverse(0, key === 'spendingFunded' ? 'higher' : 'lower')
    }
    const parsedForgedYear = parseTaxStrategyTradeoffs(forgedYear)
    expect(() => verifyTaxStrategyTradeoffsBinding(parsedForgedYear, evaluation)).toThrow(
      /firstSurvivorYear/,
    )
  })

  it('survivor: evidence-to-absent downgrade passes binding without years, fails with years', () => {
    const baseline = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 80,
      hasQualifyingDependent: true,
    })
    const proposal = structuredClone(baseline)
    const { evaluation, baselineYears, proposalYears, tradeoffs } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      { withYears: true },
    )
    expect(tradeoffs.dimensions.survivor.status).toBe('evidence')

    const downgraded = asRecord(tradeoffs)
    ;(downgraded.dimensions as Record<string, unknown>).survivor = {
      status: 'absent',
      reason: 'no-survivor-phase',
    }
    const parsedDowngrade = parseTaxStrategyTradeoffs(downgraded)

    expect(() => verifyTaxStrategyTradeoffsBinding(parsedDowngrade, evaluation)).not.toThrow()
    expect(() =>
      verifyTaxStrategyTradeoffsBinding(parsedDowngrade, evaluation, {
        baselineYears,
        proposalYears,
      }),
    ).toThrow(/survivor section diverges/)
  })

  it('risk-populated evaluation reconciles all seven successAdjustments metrics + estate.percentiles', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: START_YEAR,
      taxCalculatorForPlan: () => noTax,
      stochastic: {
        model: { type: 'lognormal', inflationMeanPct: 0 },
        pathCount: 8,
        seed: 731,
      },
    })
    expect(comparison.risk).not.toBeNull()
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const tradeoffs = buildTaxStrategyTradeoffs({ evaluation })
    const risk = comparison.risk!
    const sa = tradeoffs.dimensions.successAdjustments
    expect(sa).not.toBeNull()
    expect(sa!.successRate).toMatchObject({
      baseline: risk.successRate.baseline,
      proposal: risk.successRate.proposal,
      delta: risk.successRate.delta,
      betterDirection: 'higher',
    })
    expect(sa!.requiredFloorSuccessRate).toMatchObject({
      baseline: risk.requiredFloorSuccessRate.baseline,
      proposal: risk.requiredFloorSuccessRate.proposal,
      delta: risk.requiredFloorSuccessRate.delta,
    })
    expect(sa!.targetLifestyleSuccessRate).toMatchObject({
      baseline: risk.targetLifestyleSuccessRate.baseline,
      proposal: risk.targetLifestyleSuccessRate.proposal,
      delta: risk.targetLifestyleSuccessRate.delta,
    })
    expect(sa!.probabilityOfAdjustment).toMatchObject({
      baseline: risk.probabilityOfAdjustment.baseline,
      proposal: risk.probabilityOfAdjustment.proposal,
      delta: risk.probabilityOfAdjustment.delta,
      betterDirection: 'lower',
    })
    expect(sa!.medianMaxCutDepth).toMatchObject({
      baseline: risk.medianMaxCutDepth.baseline,
      proposal: risk.medianMaxCutDepth.proposal,
      delta: risk.medianMaxCutDepth.delta,
    })
    expect(sa!.p90MaxCutDepth).toMatchObject({
      baseline: risk.p90MaxCutDepth.baseline,
      proposal: risk.p90MaxCutDepth.proposal,
      delta: risk.p90MaxCutDepth.delta,
    })
    expect(sa!.expectedShortfallDollars).toMatchObject({
      baseline: risk.expectedShortfallDollars.baseline,
      proposal: risk.expectedShortfallDollars.proposal,
      delta: risk.expectedShortfallDollars.delta,
    })
    const pct = tradeoffs.dimensions.estate.percentiles
    expect(pct).not.toBeNull()
    expect(pct!.estateP10).toMatchObject({
      baseline: risk.estateP10.baseline,
      proposal: risk.estateP10.proposal,
      delta: risk.estateP10.delta,
    })
    expect(pct!.estateP50).toMatchObject({
      baseline: risk.estateP50.baseline,
      proposal: risk.estateP50.proposal,
      delta: risk.estateP50.delta,
    })
    expect(pct!.estateP90).toMatchObject({
      baseline: risk.estateP90.baseline,
      proposal: risk.estateP90.proposal,
      delta: risk.estateP90.delta,
    })
    expect(() => verifyTaxStrategyTradeoffsBinding(tradeoffs, evaluation)).not.toThrow()
  })

  it('spendingCapacity-populated evaluation reconciles capacity metrics including nullable maxBaseAnnual', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: START_YEAR,
      taxCalculatorForPlan: () => noTax,
      spendingCapacity: { maxSimulations: 8, resolutionDollars: 5_000 },
    })
    expect(comparison.spendingCapacity).not.toBeNull()
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const tradeoffs = buildTaxStrategyTradeoffs({ evaluation })
    const capacity = tradeoffs.dimensions.afterTaxSpending.capacity
    expect(capacity).not.toBeNull()
    expect(capacity!.maxBaseAnnual).toMatchObject({
      baseline: comparison.spendingCapacity!.maxBaseAnnual.baseline,
      proposal: comparison.spendingCapacity!.maxBaseAnnual.proposal,
      delta: comparison.spendingCapacity!.maxBaseAnnual.delta,
      betterDirection: 'higher',
    })
    expect(capacity!.spendingSlack).toMatchObject({
      baseline: comparison.spendingCapacity!.spendingSlack.baseline,
      proposal: comparison.spendingCapacity!.spendingSlack.proposal,
      delta: comparison.spendingCapacity!.spendingSlack.delta,
      betterDirection: 'higher',
    })
    expect(() => verifyTaxStrategyTradeoffsBinding(tradeoffs, evaluation)).not.toThrow()
  })

  it('survivor null-propagation: one null field on a shared annual row nulls that side sum and delta', () => {
    const baseline = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 80,
      hasQualifyingDependent: true,
    })
    const proposal = structuredClone(baseline)
    const { evaluation, baselineYears, proposalYears, tradeoffs } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      { withYears: true },
    )
    expect(tradeoffs.dimensions.survivor.status).toBe('evidence')
    if (tradeoffs.dimensions.survivor.status !== 'evidence') return

    const first = tradeoffs.dimensions.survivor.firstSurvivorYear
    const evalClone = JSON.parse(JSON.stringify(evaluation)) as TaxStrategyEvaluation
    const row = evalClone.comparison.annual.find((r) => r.year >= first)
    expect(row).toBeDefined()
    const nulledYear = row!.year
    // Partial null on a non-exempt row still null-propagates sums; exempt rows fail closed.
    row!.values.tax = {
      baseline: row!.values.tax.baseline,
      proposal: null,
      delta: null,
    }
    const patchedEvaluation = parseTaxStrategyEvaluation(evalClone)
    const patchedProposalYears = proposalYears.map((yearResult) =>
      yearResult.year === nulledYear
        ? ({ ...yearResult, tax: null as unknown as number } as YearResult)
        : yearResult,
    )
    const patchedTradeoffs = buildTaxStrategyTradeoffs({
      evaluation: patchedEvaluation,
      baselineYears,
      proposalYears: patchedProposalYears,
    })
    expect(patchedTradeoffs.dimensions.survivor.status).toBe('evidence')
    if (patchedTradeoffs.dimensions.survivor.status !== 'evidence') return
    expect(patchedTradeoffs.dimensions.survivor.tax.proposal).toBeNull()
    expect(patchedTradeoffs.dimensions.survivor.tax.delta).toBeNull()
    expect(patchedTradeoffs.dimensions.survivor.tax.adverse).toBeNull()
    expect(patchedTradeoffs.dimensions.survivor.tax.baseline).not.toBeNull()
  })

  it('verify binding: dropped alternative, duplicate candidateId, edited standInYears each fail', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { evaluation, tradeoffs } = buildTradeoffsFromPlans(baseline, proposal, {
      alternatives: [
        mockRanked('alt-b', 'B', 50, false, 'trails'),
        mockRanked('alt-a', 'A', 100, true, null),
      ],
    })

    const dropped = asRecord(tradeoffs)
    dropped.alternatives = (dropped.alternatives as unknown[]).slice(0, 1)
    const parsedDropped = parseTaxStrategyTradeoffs(dropped)
    expect(() => verifyTaxStrategyTradeoffsBinding(parsedDropped, evaluation)).toThrow(
      /alternatives/,
    )

    // Duplicate candidateId is schema-invalid (parse fails) and must fail binding via parse.
    const duplicated = asRecord(tradeoffs)
    const alts = duplicated.alternatives as Array<Record<string, unknown>>
    duplicated.alternatives = [alts[0]!, { ...alts[0]! }]
    expect(() =>
      verifyTaxStrategyTradeoffsBinding(duplicated as never, evaluation),
    ).toThrow()

    const editedYears = asRecord(tradeoffs)
    const paramBasis = (editedYears.provenance as Record<string, unknown>)
      .parameterBasis as Record<string, unknown>
    paramBasis.standInYears = [...(paramBasis.standInYears as number[]), 2099]
    const parsedEdited = parseTaxStrategyTradeoffs(editedYears)
    expect(() => verifyTaxStrategyTradeoffsBinding(parsedEdited, evaluation)).toThrow(
      /provenance/,
    )
  })

  it('unknown key at dimension level fails parse', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { tradeoffs } = buildTradeoffsFromPlans(baseline, proposal)
    const forged = asRecord(tradeoffs)
    const dims = forged.dimensions as Record<string, unknown>
    dims.compositeScore = 42
    expect(() => parseTaxStrategyTradeoffs(forged)).toThrow()
    const lifetimeTax = dims.lifetimeTax as Record<string, unknown>
    lifetimeTax.extra = 1
    delete dims.compositeScore
    expect(() => parseTaxStrategyTradeoffs(forged)).toThrow()
  })

  it('deep-freezes survivor evidence object, filingStatusPath, and standInYears', () => {
    const baseline = coupleWithCash({
      p1PlanningAge: 68,
      p2PlanningAge: 80,
      hasQualifyingDependent: true,
    })
    const proposal = structuredClone(baseline)
    const { tradeoffs } = buildTradeoffsFromPlans(
      validatePlan(baseline),
      validatePlan(proposal),
      { withYears: true },
    )
    expect(tradeoffs.dimensions.survivor.status).toBe('evidence')
    expect(Object.isFrozen(tradeoffs.dimensions.survivor)).toBe(true)
    if (tradeoffs.dimensions.survivor.status === 'evidence') {
      expect(Object.isFrozen(tradeoffs.dimensions.survivor.filingStatusPath)).toBe(true)
    }
    expect(Object.isFrozen(tradeoffs.provenance.parameterBasis.standInYears)).toBe(true)
  })

  it('canonical JSON is stable under key-reorder round-trip', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { tradeoffs } = buildTradeoffsFromPlans(baseline, proposal, {
      alternatives: [
        mockRanked('alt-b', 'B', 50, false, 'trails'),
        mockRanked('alt-a', 'A', 100, true, null),
      ],
    })
    const originalCanonical = canonicalTaxStrategyTradeoffsJson(tradeoffs)
    const parsed = JSON.parse(JSON.stringify(tradeoffs)) as Record<string, unknown>
    const reordered = {
      alternatives: parsed.alternatives,
      dimensions: parsed.dimensions,
      objective: parsed.objective,
      provenance: parsed.provenance,
      version: parsed.version,
      kind: parsed.kind,
    }
    const reparsed = parseTaxStrategyTradeoffs(reordered)
    expect(canonicalTaxStrategyTradeoffsJson(reparsed)).toBe(originalCanonical)
  })
})
