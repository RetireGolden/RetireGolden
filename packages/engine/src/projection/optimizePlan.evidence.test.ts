import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { socialSecurityClaimGenerator } from '../decisions/generators.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { socialSecurityIncome } from '../testing/planFixtures.js'
import type { OptimizedSchedule } from '../strategies/optimizer.js'
import { summarizeProjection } from './compare.js'
import * as simulation from './simulate.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'
import {
  evaluateExactLedgerSchedule,
  evaluateSimpleConversionCandidates,
  optimizePlanCoOptimizingClaimAge,
  postProcessExactLedgerSchedule,
  runExactLedgerTournament,
  withOptimizedConversions,
} from './optimizePlan.js'

/**
 * The smallest real `ProjectionResult` row: only the fields a worksheet names
 * carry a value and every other published field sits at zero, so nothing but
 * the worksheet's own figures can reach an assertion. The projection types are
 * the production ones, so a field the ledger adds later has to be given a
 * value here too.
 */
function ledgerYear(year: number, overrides: Partial<YearResult> = {}): YearResult {
  return {
    year,
    people: [],
    filingStatus: 'single',
    incomes: {
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
    },
    expenses: {
      baseSpending: 0,
      oneTimeGoals: 0,
      debtService: 0,
      propertyCosts: 0,
      healthcare: 0,
      insurancePremiums: 0,
      careCost: 0,
      ltcBenefit: 0,
      requiredSpending: 0,
      targetSpending: 0,
      idealSpending: 0,
      excessSpending: 0,
      intendedSpending: 0,
      guardrailFactor: 1,
      total: 0,
    },
    contributions: 0,
    employerMatch: 0,
    rmd: 0,
    sepp: 0,
    inheritedDistribution: 0,
    inheritedTraditionalDistribution: 0,
    qcd: 0,
    rothConversion: 0,
    penalties: 0,
    magi: 0,
    medicarePremiums: 0,
    irmaaSurcharge: 0,
    irmaaTier: 0,
    amt: 0,
    ltcgZeroHeadroom: 0,
    ssEarningsTestWithheld: 0,
    ssdiPaid: 0,
    tax: 0,
    withdrawals: { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, total: 0 },
    realizedGains: 0,
    taxableYield: 0,
    taxExemptInterest: 0,
    capitalLossUsedAgainstGains: 0,
    capitalLossUsedAgainstOrdinary: 0,
    capitalLossCarryforwardRemaining: 0,
    surplusInvested: 0,
    shortfall: 0,
    requiredShortfall: 0,
    targetShortfall: 0,
    idealShortfall: 0,
    excessShortfall: 0,
    guardrailAction: 'hold',
    flexibleGoals: {
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 0,
      fundedAmount: 0,
      unfundedAmount: 0,
    },
    balances: {},
    investableTotal: 0,
    insuranceCashValue: 0,
    ladderValue: 0,
    deathBenefit: 0,
    hecmDraw: 0,
    hecmLoanBalance: 0,
    netWorth: 0,
    netPortfolioNeed: 0,
    ...overrides,
  }
}

function projection(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    startYear: 2030,
    endYear: 2030,
    years: [],
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
    ...overrides,
  }
}

/** A validated plan: `parsePlan` is the production gate every real plan passes. */
function evidencePlan(mutate: (plan: Plan) => void): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `opt-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 75, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = 0
  mutate(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function ownTraditional(id: string, balance: number): Plan['accounts'][number] {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

describeCalculation(
  'exact-ledger-summary-comparison',
  {
    example: {
      inputs: {
        baselineEndingAfterTaxEstate: 500_000.0,
        baselineEndingNetWorth: 620_000.25,
        candidateEndingAfterTaxEstate: 535_500.25,
        candidateEndingNetWorth: 648_250.75,
      },
      expected: {
        baselineAfterTaxEstate: 500_000.0,
        candidateAfterTaxEstate: 535_500.25,
        endingNetWorthDelta: 28_250.5,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-summary-comparison.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-summary-comparison.mutation.md',
  },
  ({ example }) => {
    it('publishes 500000.00 and 535500.25 from their own results and 28250.50 of net worth', () => {
      // The worksheet names four summary figures. Each result's ending net
      // worth is given directly; the after-tax estate is that net worth less
      // the heir tax the real `summarizeProjection` charges on the plan's one
      // non-inherited traditional account at the plan's flat 25% heir rate, so
      // the summaries are composed rather than asserted into existence.
      const inputs = example.inputs as Record<string, number>
      const heirTaxRatePct = 25
      const baselineTraditional =
        (inputs.baselineEndingNetWorth - inputs.baselineEndingAfterTaxEstate) / (heirTaxRatePct / 100)
      const candidateTraditional =
        (inputs.candidateEndingNetWorth - inputs.candidateEndingAfterTaxEstate) / (heirTaxRatePct / 100)
      const plan = evidencePlan((draft) => {
        draft.assumptions.heirTaxRatePct = heirTaxRatePct
        draft.accounts = [ownTraditional('own-trad', baselineTraditional)]
      })
      const baselineResult = projection({
        endYear: 2035,
        years: [
          ledgerYear(2030),
          ledgerYear(2035, { balances: { 'own-trad': baselineTraditional }, netWorth: inputs.baselineEndingNetWorth }),
        ],
        endingNetWorth: inputs.baselineEndingNetWorth,
      })
      const candidateResult = projection({
        endYear: 2035,
        years: [
          ledgerYear(2030),
          ledgerYear(2035, { balances: { 'own-trad': candidateTraditional }, netWorth: inputs.candidateEndingNetWorth }),
        ],
        endingNetWorth: inputs.candidateEndingNetWorth,
      })

      const validation = evaluateExactLedgerSchedule(plan, [], baselineResult, candidateResult)

      const expectedBaseline = example.expected.baselineAfterTaxEstate as number
      const expectedCandidate = example.expected.candidateAfterTaxEstate as number
      const expectedDelta = example.expected.endingNetWorthDelta as number
      expect(
        withinTolerance(validation.baseline.endingAfterTaxEstate, expectedBaseline, example.tolerance),
        `baseline estate: actual ${validation.baseline.endingAfterTaxEstate}, worksheet ${expectedBaseline}`,
      ).toBe(true)
      expect(
        withinTolerance(validation.candidate.endingAfterTaxEstate, expectedCandidate, example.tolerance),
        `candidate estate: actual ${validation.candidate.endingAfterTaxEstate}, worksheet ${expectedCandidate}`,
      ).toBe(true)
      expect(
        withinTolerance(validation.endingNetWorthDelta, expectedDelta, example.tolerance),
        `endingNetWorthDelta: actual ${validation.endingNetWorthDelta}, worksheet ${expectedDelta}`,
      ).toBe(true)
      // The wrong readings the worksheet names: the reversed subtraction, the
      // after-tax-estate difference standing in for the net-worth delta, and
      // the shared baseline recomputed from the candidate result.
      expect(validation.endingNetWorthDelta).not.toBe(-expectedDelta)
      expect(validation.endingNetWorthDelta).not.toBe(expectedCandidate - expectedBaseline)
      expect(validation.baseline.endingAfterTaxEstate).not.toBe(validation.candidate.endingAfterTaxEstate)
    })
  },
)

describeCalculation(
  'exact-ledger-conversion-execution',
  {
    example: {
      inputs: {
        rows: [
          { year: 2030, requested: 40_000, executed: 30_000 },
          { year: 2031, requested: 20_000, executed: 19_000 },
          { year: 2032, requested: 10_000, executed: 10_000 },
        ],
        materialShortfallDollars: 1_000,
        materialShortfallPct: 0.05,
        insideMarginRow: { year: 2040, requested: 20_000, executed: 19_000 },
        overExecutedRow: { year: 2030, requested: 10_000, executed: 12_000 },
        ratioTolerance: { abs: 1e-9 },
      },
      expected: {
        requestedConversionTotal: 70_000,
        executedConversionRatio: 0.8428571428571429,
        firstMateriallyUnexecutedYear: 2030,
        insideMarginFirstYear: null,
        zeroRequestRatio: 1,
        overExecutedRatio: 1,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-conversion-execution.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-conversion-execution.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    type Row = { year: number; requested: number; executed: number }
    const plan = (): Plan =>
      evidencePlan((draft) => {
        draft.accounts = [ownTraditional('own-trad', 500_000)]
      })
    const baseline = (): ProjectionResult =>
      projection({ endYear: 2032, years: [ledgerYear(2030), ledgerYear(2031), ledgerYear(2032)] })
    const candidateOf = (rows: readonly Row[]): ProjectionResult =>
      projection({
        endYear: rows[rows.length - 1]!.year,
        years: rows.map((row) => ledgerYear(row.year, { rothConversion: row.executed })),
      })
    const requestedOf = (rows: readonly Row[]): { year: number; amount: number }[] =>
      rows.map((row) => ({ year: row.year, amount: row.requested }))

    it('sums 70000 requested, caps the ratio at 0.8428571428571429 and names 2030', () => {
      const rows = inputs.rows as Row[]
      const validation = evaluateExactLedgerSchedule(plan(), requestedOf(rows), baseline(), candidateOf(rows))
      const expectedTotal = example.expected.requestedConversionTotal as number
      const expectedRatio = example.expected.executedConversionRatio as number
      expect(
        withinTolerance(validation.requestedConversionTotal, expectedTotal, example.tolerance),
        `requestedConversionTotal: actual ${validation.requestedConversionTotal}, worksheet ${expectedTotal}`,
      ).toBe(true)
      expect(
        withinTolerance(
          validation.executedConversionRatio,
          expectedRatio,
          inputs.ratioTolerance as { abs: number },
        ),
        `executedConversionRatio: actual ${validation.executedConversionRatio}, worksheet ${expectedRatio}`,
      ).toBe(true)
      // The per-year margin is 2000 in 2030 and 1000 in 2031, so only 2030
      // clears it; the worksheet's wrong reading applies the 3500 margin of
      // the 70000 total to every year and finds no year at all.
      expect(validation.firstMateriallyUnexecutedYear).toBe(example.expected.firstMateriallyUnexecutedYear)
    })

    it('returns null when the only shortfall equals its own margin', () => {
      const row = inputs.insideMarginRow as Row
      const validation = evaluateExactLedgerSchedule(plan(), requestedOf([row]), baseline(), candidateOf([row]))
      // 20000 requested, 19000 executed: the shortfall is 1000 and the margin
      // is max(1000, 1000); "more than" is strict, so 2040 does not qualify.
      expect(validation.firstMateriallyUnexecutedYear).toBe(example.expected.insideMarginFirstYear)
    })

    it('publishes exactly 1 when nothing was requested, without dividing zero by zero', () => {
      const validation = evaluateExactLedgerSchedule(
        plan(),
        [],
        baseline(),
        projection({ years: [ledgerYear(2030)] }),
      )
      expect(validation.requestedConversionTotal).toBe(0)
      expect(validation.executedConversionRatio).toBe(example.expected.zeroRequestRatio)
      expect(Number.isNaN(validation.executedConversionRatio)).toBe(false)
    })

    it('caps an over-execution at 1 rather than publishing 1.2', () => {
      const row = inputs.overExecutedRow as Row
      const validation = evaluateExactLedgerSchedule(plan(), requestedOf([row]), baseline(), candidateOf([row]))
      expect(validation.executedConversionRatio).toBe(example.expected.overExecutedRatio)
      expect(validation.executedConversionRatio).not.toBe(row.executed / row.requested)
    })
  },
)

describeCalculation(
  'exact-ledger-traditional-depletion',
  {
    example: {
      inputs: {
        toleranceDollars: 1,
        rows: [
          { year: 2030, ownA: 800.0, ownB: 500.0, inheritedC: 25_000.0 },
          { year: 2031, ownA: 0.4, ownB: 0.5, inheritedC: 24_000.0 },
          { year: 2032, ownA: 0.0, ownB: 0.0, inheritedC: 23_000.0 },
        ],
        neverDepletedRows: [
          { year: 2030, ownA: 1.0, ownB: 1.0, inheritedC: 25_000.0 },
          { year: 2031, ownA: 0.51, ownB: 0.5, inheritedC: 24_000.0 },
          { year: 2032, ownA: 2.5, ownB: 2.5, inheritedC: 23_000.0 },
        ],
      },
      expected: { traditionalDepletionYear: 2031, neverDepletedYear: null },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-traditional-depletion.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-traditional-depletion.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    type Row = { year: number; ownA: number; ownB: number; inheritedC: number }
    // The worksheet's account classification is the plan's: `own-a` and
    // `own-b` are the plan's own traditional accounts, `inherited-c` is an
    // inherited traditional account, which the rule must leave out of the sum.
    const plan = (): Plan =>
      evidencePlan((draft) => {
        draft.accounts = [
          ownTraditional('own-a', 800),
          ownTraditional('own-b', 500),
          {
            type: 'traditional',
            id: 'inherited-c',
            name: 'inherited-c',
            ownerPersonId: 'p1',
            annualReturnPct: 0,
            kind: 'ira',
            balance: 25_000,
            annualContribution: 0,
            inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
          },
        ]
      })
    const candidateOf = (rows: readonly Row[]): ProjectionResult =>
      projection({
        endYear: rows[rows.length - 1]!.year,
        years: rows.map((row) =>
          ledgerYear(row.year, {
            balances: { 'own-a': row.ownA, 'own-b': row.ownB, 'inherited-c': row.inheritedC },
          }),
        ),
      })

    it('names 2031, where the owned balances sum to 0.90 and the inherited 24000 is excluded', () => {
      const validation = evaluateExactLedgerSchedule(
        plan(),
        [],
        projection({ years: [ledgerYear(2030)] }),
        candidateOf(inputs.rows as Row[]),
      )
      expect(validation.traditionalDepletionYear).toBe(example.expected.traditionalDepletionYear)
      // The wrong readings the worksheet names: including the inherited
      // balance finds no year at all, and requiring a zero balance postpones
      // the answer to 2032.
      expect(validation.traditionalDepletionYear).not.toBe(2032)
    })

    it('publishes null when the smallest owned sum, 1.01, is over the one-dollar tolerance', () => {
      const validation = evaluateExactLedgerSchedule(
        plan(),
        [],
        projection({ years: [ledgerYear(2030)] }),
        candidateOf(inputs.neverDepletedRows as Row[]),
      )
      expect(validation.traditionalDepletionYear).toBe(example.expected.neverDepletedYear)
    })
  },
)

describeCalculation(
  'simple-candidate-evaluation-comparison',
  {
    example: {
      inputs: {
        baselineEndingAfterTaxEstate: 500_000.0,
        candidateEndingAfterTaxEstate: 525_250.25,
        baselineLifetimeTaxesAndPenalties: 120_000.0,
        candidateLifetimeTaxesAndPenalties: 127_500.75,
        baselineDepletionYear: 2034,
        candidateDepletionYear: null,
        baselineEndYear: 2035,
        candidateEndYear: 2035,
        candidateConversions: [
          { year: 2030, amount: 12_500.25 },
          { year: 2031, amount: 7_500.5 },
        ],
        baselineIncompleteTaxYear: 2031,
        candidateIncompleteHecmYear: 2030,
        candidateIncompleteTaxYear: 2031,
      },
      expected: {
        executedConversionTotal: 20_000.75,
        afterTaxEstateDelta: 25_250.25,
        lifetimeTaxDelta: 7_500.75,
        moneyLastsYearsDelta: 2,
        incompleteComputationYears: [2030, 2031],
        noIncompleteComputationYears: [],
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/simple-candidate-evaluation-comparison.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/simple-candidate-evaluation-comparison.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const HEIR_TAX_RATE_PCT = 20
    const CANDIDATE_ID = 'bracket-22'

    // Each result's ending net worth is set so the real `summarizeProjection`
    // composes the worksheet's after-tax estate out of it, charging the flat
    // 20% heir rate on the plan's one non-inherited traditional account.
    function netWorthFor(estate: number, traditionalBalance: number): number {
      return estate + traditionalBalance * (HEIR_TAX_RATE_PCT / 100)
    }

    function plan(): Plan {
      return evidencePlan((draft) => {
        draft.assumptions.heirTaxRatePct = HEIR_TAX_RATE_PCT
        draft.accounts = [ownTraditional('own-trad', 400_000)]
      })
    }

    function simOptions(): SimulateOptions {
      return { startYear: 2030, taxCalculator: createFlatTaxCalculator(0) }
    }

    const BASELINE_TRADITIONAL = 100_000
    const CANDIDATE_TRADITIONAL = 60_000

    function baselineResult(incomplete: boolean): ProjectionResult {
      const estate = inputs.baselineEndingAfterTaxEstate as number
      const netWorth = netWorthFor(estate, BASELINE_TRADITIONAL)
      return projection({
        endYear: inputs.baselineEndYear as number,
        depletionYear: inputs.baselineDepletionYear as number,
        years: [
          ledgerYear(2030, { tax: inputs.baselineLifetimeTaxesAndPenalties as number }),
          ledgerYear(inputs.baselineIncompleteTaxYear as number, {
            ...(incomplete
              ? { taxComputation: { amount: 0, status: 'incomplete' as const, issues: [] } }
              : {}),
          }),
          ledgerYear(inputs.baselineEndYear as number, {
            balances: { 'own-trad': BASELINE_TRADITIONAL },
            netWorth,
          }),
        ],
        endingNetWorth: netWorth,
      })
    }

    function candidateResult(incomplete: boolean): ProjectionResult {
      const estate = inputs.candidateEndingAfterTaxEstate as number
      const netWorth = netWorthFor(estate, CANDIDATE_TRADITIONAL)
      const conversions = inputs.candidateConversions as { year: number; amount: number }[]
      return projection({
        endYear: inputs.candidateEndYear as number,
        depletionYear: inputs.candidateDepletionYear as null,
        years: [
          ledgerYear(conversions[0]!.year, {
            rothConversion: conversions[0]!.amount,
            tax: inputs.candidateLifetimeTaxesAndPenalties as number,
            ...(incomplete ? { hecmComputation: { status: 'incomplete' as const, issues: [] } } : {}),
          }),
          ledgerYear(conversions[1]!.year, {
            rothConversion: conversions[1]!.amount,
            ...(incomplete
              ? { taxComputation: { amount: 0, status: 'incomplete' as const, issues: [] } }
              : {}),
          }),
          ledgerYear(inputs.candidateEndYear as number, {
            balances: { 'own-trad': CANDIDATE_TRADITIONAL },
            netWorth,
          }),
        ],
        endingNetWorth: netWorth,
      })
    }

    // `evaluateSimpleConversionCandidates` is the smallest exported entry that
    // publishes a `SimpleCandidateEvaluation`; it generates its own fixed set
    // of fill-to-target candidates and runs each through the ledger, so the
    // worksheet's candidate result is supplied at the simulate seam and its
    // baseline result is passed in directly.
    function evaluateWith(incomplete: boolean) {
      const spy = vi.spyOn(simulation, 'simulatePlan').mockReturnValue(candidateResult(incomplete))
      try {
        const rows = evaluateSimpleConversionCandidates(plan(), baselineResult(incomplete), simOptions())
        const row = rows.find((candidate) => candidate.id === CANDIDATE_ID)
        if (row === undefined) throw new Error(`no ${CANDIDATE_ID} candidate among ${rows.map((r) => r.id).join(', ')}`)
        return row
      } finally {
        spy.mockRestore()
      }
    }

    it('sums 20000.75 of candidate conversions and publishes 25250.25, 7500.75 and 2 years', () => {
      const row = evaluateWith(true)
      const expectedConversions = example.expected.executedConversionTotal as number
      const expectedEstate = example.expected.afterTaxEstateDelta as number
      const expectedTax = example.expected.lifetimeTaxDelta as number
      expect(
        withinTolerance(row.executedConversionTotal, expectedConversions, example.tolerance),
        `executedConversionTotal: actual ${row.executedConversionTotal}, worksheet ${expectedConversions}`,
      ).toBe(true)
      expect(
        withinTolerance(row.afterTaxEstateDelta, expectedEstate, example.tolerance),
        `afterTaxEstateDelta: actual ${row.afterTaxEstateDelta}, worksheet ${expectedEstate}`,
      ).toBe(true)
      expect(
        withinTolerance(row.lifetimeTaxDelta, expectedTax, example.tolerance),
        `lifetimeTaxDelta: actual ${row.lifetimeTaxDelta}, worksheet ${expectedTax}`,
      ).toBe(true)
      // The candidate never depletes, so it lasts through endYear + 1 = 2036
      // against the baseline's 2034 depletion year; using endYear itself, the
      // worksheet's wrong reading, would publish 1.
      expect(row.moneyLastsYearsDelta).toBe(example.expected.moneyLastsYearsDelta)
      // The reversed-subtraction wrong readings.
      expect(row.afterTaxEstateDelta).not.toBe(-expectedEstate)
      expect(row.lifetimeTaxDelta).not.toBe(-expectedTax)
    })

    it('unions the baseline 2031 with the candidate 2030 and 2031 into [2030, 2031]', () => {
      const row = evaluateWith(true)
      expect(row.incompleteComputationYears).toEqual(example.expected.incompleteComputationYears)
      // Concatenating without a set union would give [2031, 2030, 2031].
      expect(row.incompleteComputationYears).not.toEqual([2031, 2030, 2031])
    })

    it('carries no incomplete years when every status is complete or absent', () => {
      const row = evaluateWith(false)
      // The published field is optional: production omits the key entirely
      // when the union is empty, as the worksheet states since its revision.
      // The omission is asserted as itself, and the empty union it stands for
      // is asserted as well.
      expect('incompleteComputationYears' in row).toBe(false)
      expect(row.incompleteComputationYears ?? []).toEqual(example.expected.noIncompleteComputationYears)
    })
  },
)

/**
 * The production federal tax calculator and the 2026 start year every
 * tournament, post-processing and co-optimization fixture below runs on. These
 * three worksheets describe the optimizer's own published figures, so their
 * fixtures drive the real ledger end to end rather than supplying a
 * `ProjectionResult` at a seam.
 */
function federalOptions(): SimulateOptions {
  return { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
}

/**
 * A raw solver schedule carrying only its conversions: every other
 * `OptimizedYear` field is stubbed at 0, so nothing but the requested
 * conversion can reach the post-processor.
 */
function rawOptimizedSchedule(conversions: { year: number; amount: number }[]): OptimizedSchedule {
  return {
    status: 'optimal',
    endingAfterTax: 0,
    lifetimeTax: 0,
    schedule: conversions.map((conversion) => ({
      year: conversion.year,
      conversion: conversion.amount,
      withdrawTraditional: 0,
      withdrawInheritedTraditional: 0,
      withdrawOther: 0,
      withdrawTaxable: 0,
      taxableGainRealized: 0,
      taxableOrdinary: 0,
      irmaaTier: 0,
      endTrad: 0,
      endInheritedTrad: 0,
      endOther: 0,
      endTaxable: 0,
    })),
    conversions,
    solveMs: 0,
  }
}

function cashAccount(id: string, balance: number): Plan['accounts'][number] {
  return { type: 'cash', id, name: id, ownerPersonId: null, annualReturnPct: 0, balance, annualContribution: 0 }
}

describeCalculation(
  'exact-ledger-tournament-margin',
  {
    example: {
      inputs: {
        firstYear: 2026,
        switchMarginDollars: 1_000,
        // "a plan with no traditional balance and no applied conversions; no
        // MILP result is supplied to runExactLedgerTournament"
        noneFixture: { traditionalBalance: 0, appliedConversions: [], milpPostProcessing: null },
        // "an owned traditional balance of at least $20,000, one applied
        // conversion of $20,000 in year Y1, and no MILP result"
        incumbentFixture: {
          traditionalBalance: 800_000,
          appliedConversions: [{ year: 2026, amount: 20_000 }],
          milpPostProcessing: null,
        },
      },
      expected: {
        noneMarginOverMilpDollars: 0,
        noneWinnerSource: 'none',
        noneWinnerConversions: [],
        incumbentMarginOverMilpDollars: 0,
        incumbentWinnerSource: 'incumbent',
        incumbentWinnerConversions: [{ year: 2026, amount: 20_000 }],
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-tournament-margin.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-tournament-margin.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<
      string,
      { traditionalBalance: number; appliedConversions: { year: number; amount: number }[] }
    >

    /** No traditional balance: every conversion candidate executes $0. */
    function noTraditionalPlan(): Plan {
      return evidencePlan((draft) => {
        draft.accounts = [cashAccount('cash', 30_000)]
      })
    }

    /** A retiree whose owned traditional balance is well over the worksheet's $20,000 floor. */
    function ownedTraditionalPlan(): Plan {
      return evidencePlan((draft) => {
        draft.household.people[0] = {
          id: 'p1',
          name: 'Pat',
          dob: '1958-06-15',
          sex: 'average',
          retirementAge: 65,
          longevity: { planningAge: 85, source: 'manual' },
        }
        draft.assumptions.defaultReturnPct = 4
        draft.assumptions.heirTaxRatePct = 25
        draft.expenses.baseAnnual = 45_000
        draft.accounts = [
          {
            type: 'traditional',
            id: 'own-trad',
            name: 'own-trad',
            ownerPersonId: 'p1',
            annualReturnPct: null,
            kind: 'ira',
            balance: inputs.incumbentFixture.traditionalBalance,
            annualContribution: 0,
          },
          { type: 'roth', id: 'own-roth', name: 'own-roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
          { type: 'taxable', id: 'brokerage', name: 'brokerage', ownerPersonId: null, annualReturnPct: null, balance: 150_000, costBasis: 150_000, annualContribution: 0 },
          { type: 'cash', id: 'cash', name: 'cash', ownerPersonId: null, annualReturnPct: null, balance: 60_000, annualContribution: 0 },
        ]
      })
    }

    it('publishes $0 with source none and an empty schedule when nothing can be converted', () => {
      const options = federalOptions()
      const plan = noTraditionalPlan()
      const baselineResult = simulatePlan(plan, options)

      const tournament = runExactLedgerTournament(plan, baselineResult, null, options)

      expect(tournament.winnerSource).toBe(example.expected.noneWinnerSource)
      expect(tournament.winnerConversions).toEqual(example.expected.noneWinnerConversions)
      const expectedMargin = example.expected.noneMarginOverMilpDollars as number
      expect(
        withinTolerance(tournament.marginOverMilpDollars, expectedMargin, example.tolerance),
        `none marginOverMilpDollars: actual ${tournament.marginOverMilpDollars}, worksheet ${expectedMargin}`,
      ).toBe(true)
      // No MILP comparison was made, so there is no displaced schedule to
      // price a margin against.
      expect(tournament.winnerValidation).toBeNull()
    })

    it('publishes $0 and the executed $20,000 when the applied schedule holds', () => {
      const options = federalOptions()
      const plan = withOptimizedConversions(ownedTraditionalPlan(), inputs.incumbentFixture.appliedConversions)
      const baselineResult = simulatePlan(plan, options)

      const tournament = runExactLedgerTournament(plan, baselineResult, null, options)

      expect(tournament.winnerSource).toBe(example.expected.incumbentWinnerSource)
      // The incumbent schedule is the ledger's EXECUTED amount, which is the
      // applied $20,000 request in Y1 and nothing else.
      expect(tournament.winnerConversions).toEqual(example.expected.incumbentWinnerConversions)
      const expectedMargin = example.expected.incumbentMarginOverMilpDollars as number
      expect(
        withinTolerance(tournament.marginOverMilpDollars, expectedMargin, example.tolerance),
        `incumbent marginOverMilpDollars: actual ${tournament.marginOverMilpDollars}, worksheet ${expectedMargin}`,
      ).toBe(true)
      // The worksheet's first wrong reading: candidates on this plan DO carry
      // nonzero estate deltas, and publishing one of them as the margin would
      // report a candidate-versus-incumbent difference. No MILP comparison was
      // made, so the published figure is $0 regardless.
      expect(tournament.candidates.some((candidate) => Math.abs(candidate.afterTaxEstateDelta) > 1)).toBe(true)
      expect(tournament.winnerValidation).toBeNull()
    })
  },
)

describeCalculation(
  'exact-ledger-cleaned-schedule',
  {
    example: {
      inputs: {
        traditionalBalance: 20_000,
        firstYear: 2026,
        secondYear: 2027,
        rawSchedule: [
          { year: 2026, amount: 15_000 },
          { year: 2027, amount: 15_000 },
        ],
        statedExecutions: [
          { year: 2026, amount: 15_000 },
          { year: 2027, amount: 5_000 },
        ],
        liveReasons: ['ledger-capped', 'dropped-zero', 'estate-pruned'],
        declaredButNeverAssignedReason: 'rounding',
      },
      expected: {
        cleanedConversions: [
          { year: 2026, amount: 15_000 },
          { year: 2027, amount: 5_000 },
        ],
        secondYearAdjustment: { year: 2027, requested: 15_000, executed: 5_000, cleaned: 5_000, reason: 'ledger-capped' },
        cleanedRequestedTotal: 20_000,
        cleanedExecutedTotal: 20_000,
        cleanedExecutedRatio: 1,
        rawRequestedTotal: 30_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-cleaned-schedule.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/exact-ledger-cleaned-schedule.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>

    /** The worksheet's one-person plan: $20,000 owned traditional and nothing that grows. */
    function limitedTraditionalPlan(): Plan {
      return evidencePlan((draft) => {
        draft.household.people[0] = {
          id: 'p1',
          name: 'Pat',
          dob: '1960-01-01',
          sex: 'average',
          retirementAge: 65,
          longevity: { planningAge: 67, source: 'manual' },
        }
        draft.assumptions.heirTaxRatePct = 0
        draft.accounts = [
          ownTraditional('own-trad', inputs.traditionalBalance as number),
          { type: 'roth', id: 'own-roth', name: 'own-roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
          cashAccount('cash', 10_000),
        ]
      })
    }

    function postProcess() {
      const options = federalOptions()
      const plan = limitedTraditionalPlan()
      const baselineResult = simulatePlan(plan, options)
      const rawSchedule = rawOptimizedSchedule(inputs.rawSchedule as { year: number; amount: number }[])
      return { rawSchedule, processed: postProcessExactLedgerSchedule(plan, rawSchedule, baselineResult, options) }
    }

    it('cleans $15,000 and $15,000 to $15,000 and $5,000, totalling $20,000 at a ratio of 1', () => {
      const { rawSchedule, processed } = postProcess()

      expect(processed.cleanedSchedule.conversions).toEqual(example.expected.cleanedConversions)
      // The wrong reading that sets cleaned equal to requested keeps $15,000 in
      // Y2 — the ledger only had $5,000 of traditional balance left.
      expect(processed.cleanedSchedule.conversions).not.toEqual(rawSchedule.conversions)

      const expectedRequested = example.expected.cleanedRequestedTotal as number
      const expectedExecuted = example.expected.cleanedExecutedTotal as number
      expect(
        withinTolerance(processed.cleanedValidation.requestedConversionTotal, expectedRequested, example.tolerance),
        `cleaned requestedConversionTotal: actual ${processed.cleanedValidation.requestedConversionTotal}, worksheet ${expectedRequested}`,
      ).toBe(true)
      expect(
        withinTolerance(processed.cleanedValidation.executedConversionTotal, expectedExecuted, example.tolerance),
        `cleaned executedConversionTotal: actual ${processed.cleanedValidation.executedConversionTotal}, worksheet ${expectedExecuted}`,
      ).toBe(true)
      // Summing the raw requests is the worksheet's second wrong reading.
      expect(processed.cleanedValidation.requestedConversionTotal).not.toBe(example.expected.rawRequestedTotal)
      expect(processed.cleanedValidation.executedConversionRatio).toBe(example.expected.cleanedExecutedRatio)
    })

    it('records Y2 as ledger-capped, never the declared-but-never-assigned rounding', () => {
      const { processed } = postProcess()

      expect(processed.adjustments).toContainEqual(example.expected.secondYearAdjustment)
      const reasons = processed.adjustments.map((adjustment) => adjustment.reason)
      // Every reason this run assigned is one of the three live values, and
      // `rounding` — declared on the union but never assigned, decision
      // D-ADJUSTMENT-ROUNDING-REASON — is not among them. The other two live
      // reasons, `dropped-zero` and `estate-pruned`, need a raw schedule and a
      // plan the worksheet does not state, so they are not constructed here.
      for (const reason of reasons) expect(inputs.liveReasons as string[]).toContain(reason)
      expect(reasons).not.toContain(inputs.declaredButNeverAssignedReason)
    })
  },
)

describeCalculation(
  'claim-age-co-optimization',
  {
    example: {
      inputs: {
        canonicalClaimAges: ['62y0m', '66y2m (FRA)', '70y0m'],
        oneStreamFixture: { streams: 1, currentClaimAgeYears: 70 },
        noStreamFixture: { streams: 0 },
        currentClaimWinsFixture: { traditionalBalance: 0, currentClaimAgeYears: 70, planningAge: 70 },
        claimSwitchMarginDollars: 1_000,
      },
      expected: {
        oneStreamGeneratedCandidates: 2,
        oneStreamCombinationsEvaluated: 3,
        noStreamGeneratedCandidates: 0,
        noStreamCombinationsEvaluated: 1,
        winningClaimLabel: null,
        winningClaimPatch: null,
        // RUN-PINNED, not derived. The worksheet leaves both estates
        // unnumbered because the extract does not state the optimizer's full
        // inputs; this is the value one execution of the co-optimizer produced
        // on the stated plan, and the derived claim is that the two are equal.
        currentClaimExactEstate: 238_333.2,
        jointExactEstate: 238_333.2,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/claim-age-co-optimization.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/claim-age-co-optimization.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<
      string,
      { streams: number; currentClaimAgeYears?: number; planningAge?: number }
    >

    /** One person turning 70 in the start year, with nothing to convert. */
    function claimPlan(streams: number): Plan {
      return evidencePlan((draft) => {
        draft.household.people[0] = {
          id: 'p1',
          name: 'Pat',
          dob: '1956-01-01',
          sex: 'average',
          retirementAge: 65,
          longevity: { planningAge: inputs.currentClaimWinsFixture.planningAge as number, source: 'manual' },
        }
        draft.accounts = [cashAccount('cash', 200_000)]
        draft.incomes =
          streams === 0
            ? []
            : [socialSecurityIncome('ss', 2_600, inputs.oneStreamFixture.currentClaimAgeYears as number)]
      })
    }

    function generatedCandidates(streams: number) {
      const options = federalOptions()
      const plan = claimPlan(streams)
      const baselineResult = simulatePlan(plan, options)
      return socialSecurityClaimGenerator.generate({
        plan,
        baselineResult,
        baselineSummary: summarizeProjection(plan, baselineResult),
        simulateOptions: options,
      })
    }

    it('generates 2 candidates for a stream already claiming at 70y0m, so 3 combinations are evaluated', () => {
      const candidates = generatedCandidates(inputs.oneStreamFixture.streams)

      // The canonical grid is {62y0m, the person's FRA, 70y0m}; born 1956-01-01
      // (effective birth year 1955) the FRA is 66y2m. The stream's own
      // current 70y0m age is skipped, so 3 - 1 = 2 candidates are generated.
      expect(candidates.length).toBe(example.expected.oneStreamGeneratedCandidates)
      expect(candidates.map((candidate) => candidate.label).sort()).toEqual([
        'Pat claims Social Security at 62',
        'Pat claims Social Security at 66 and 2 months (FRA)',
      ])
      // Including the current claim is the published count. Counting the
      // stream's own 70y0m age as a candidate would give 4; omitting the
      // current claim would give 2.
      expect(1 + candidates.length).toBe(example.expected.oneStreamCombinationsEvaluated)
    })

    it('generates 0 candidates with no stream, so 1 combination is evaluated', () => {
      const candidates = generatedCandidates(inputs.noStreamFixture.streams)

      expect(candidates.length).toBe(example.expected.noStreamGeneratedCandidates)
      // Omitting the current claim from the count would publish 0 here.
      expect(1 + candidates.length).toBe(example.expected.noStreamCombinationsEvaluated)
    })

    it('holds the current claim, so the joint estate IS the current-claim estate', async () => {
      const plan = claimPlan(inputs.oneStreamFixture.streams)

      const joint = await optimizePlanCoOptimizingClaimAge(plan, federalOptions())

      expect(joint.claimAge.combinationsEvaluated).toBe(example.expected.oneStreamCombinationsEvaluated)
      // No traditional balance, so every conversion schedule is empty and no
      // claim candidate clears the $1,000 switch margin.
      expect(joint.claimAge.winningClaimLabel).toBe(example.expected.winningClaimLabel)
      expect(joint.claimAge.winningClaimPatch).toBe(example.expected.winningClaimPatch)
      // The derived claim: the two estates are the same number.
      expect(joint.claimAge.jointExactEstate).toBe(joint.claimAge.currentClaimExactEstate)
      // …and the run-pinned dollar figure that one execution produced.
      const expectedCurrent = example.expected.currentClaimExactEstate as number
      const expectedJoint = example.expected.jointExactEstate as number
      expect(
        withinTolerance(joint.claimAge.currentClaimExactEstate, expectedCurrent, example.tolerance),
        `currentClaimExactEstate: actual ${joint.claimAge.currentClaimExactEstate}, run-pinned ${expectedCurrent}`,
      ).toBe(true)
      expect(
        withinTolerance(joint.claimAge.jointExactEstate, expectedJoint, example.tolerance),
        `jointExactEstate: actual ${joint.claimAge.jointExactEstate}, run-pinned ${expectedJoint}`,
      ).toBe(true)
    })
  },
)
