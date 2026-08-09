import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import { maximizeAfterTaxEstate } from '../decisions/objectives.js'
import {
  indexFederalTaxPack,
  packForYear,
} from '../params/index.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import {
  taxParameterFilingStatus,
  type TaxYearInput,
  type YearResult,
} from '../projection/types.js'
import { computeFederalTax } from '../tax/federalTax.js'
import {
  cashAccount,
  couplePlan,
  setAcaYearContract,
  validatePlan,
} from '../testing/planFixtures.js'
import { compareScenarioPlans } from './comparison.js'
import {
  buildTaxStrategyEvaluation,
  parseTaxStrategyEvaluation,
  taxStrategyEvaluationHash,
  type TaxStrategyLimitationRef,
} from './taxStrategyEvaluation.js'
import {
  buildTaxOpportunityView,
  canonicalTaxOpportunityViewJson,
  CURRENT_TAX_OPPORTUNITY_VIEW_VERSION,
  EFFECTIVE_MARGINAL_RATE_PROBE_DOLLARS,
  parseTaxOpportunityView,
  TAX_OPPORTUNITY_VIEW_KIND,
  taxOpportunityViewHash,
  verifyTaxOpportunityViewBinding,
} from './taxOpportunityView.js'

const noTax = createFlatTaxCalculator(0)

/** Real approximated PAB-AMT registry record used as a plan-wide limitation example. */
const PAB_AMT_RULE_ID = 'irc-57-a-5-private-activity-bond-interest-amt-preference' as const

const pabAmtLimitation: TaxStrategyLimitationRef = {
  ruleId: PAB_AMT_RULE_ID,
  classification: 'approximated',
  errorDirection: 'understatesTax',
  note: 'Private-activity-bond AMT preference is not issue-level modelled.',
}

function coupleWithCash() {
  const plan = couplePlan({
    p1Dob: '1960-01-01',
    p2Dob: '1962-01-01',
    p1PlanningAge: 75,
    p2PlanningAge: 75,
    p1RetirementAge: 65,
    p2RetirementAge: 65,
  })
  plan.accounts = [
    cashAccount('cash', 600_000),
  ]
  plan.accounts[0]!.ownerPersonId = 'p1'
  plan.expenses.baseAnnual = 40_000
  return validatePlan(plan)
}

function ordinaryWithdrawalAction(
  actionId: string,
  allocationId: string,
  year: number,
  cents: number,
  executionSequence = 1,
  executionDate?: string,
) {
  return {
    actionId: asActionId(actionId),
    kind: 'ordinaryWithdrawal' as const,
    personId: asPersonId('p1'),
    year,
    ...(executionDate === undefined ? {} : { executionDate }),
    executionSequence,
    requestedAmount: asPositiveUsdCents(cents),
    allocations: [{
      allocationId: asAllocationId(allocationId),
      sourceAccountId: asAccountId('cash'),
      requestedAmount: asPositiveUsdCents(cents),
    }],
    purpose: { kind: 'spending' as const },
    provenance: { source: 'manual' as const },
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

function refusedActionPlans() {
  const baseline = coupleWithCash()
  const scheduled = (
    actionId: string,
    allocationId: string,
    executionDate: string,
    executionSequence: number,
  ) => ordinaryWithdrawalAction(actionId, allocationId, 2030, 100, executionSequence, executionDate)
  baseline.strategies.retirementActions = [
    scheduled('collision-b', 'allocation-b', '2030-06-01', 1),
    scheduled('independent', 'allocation-independent', '2030-07-01', 1),
    scheduled('collision-a', 'allocation-a', '2030-06-01', 1),
  ]
  const proposal = structuredClone(baseline)
  return {
    baseline: validatePlan(baseline),
    proposal: validatePlan(proposal),
  }
}

function buildViewFromPlans(
  baseline: ReturnType<typeof validatePlan>,
  proposal: ReturnType<typeof validatePlan>,
) {
  const comparison = compareScenarioPlans(baseline, proposal, {
    startYear: 2026,
    taxCalculatorForPlan: () => noTax,
  })
  const evaluation = buildTaxStrategyEvaluation({
    comparison,
    objective: maximizeAfterTaxEstate,
  })
  const proposalResult = simulatePlan(proposal, {
    startYear: 2026,
    taxCalculator: noTax,
  })
  const view = buildTaxOpportunityView({
    evaluation,
    proposalYears: proposalResult.years,
  })
  return { comparison, evaluation, proposalResult, view }
}

function asRecord(value: unknown): Record<string, unknown> {
  return structuredClone(value) as Record<string, unknown>
}

describe('taxOpportunityView', () => {
  it('reconciles year rows 1:1 with comparison.annual proposal values', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { comparison, view } = buildViewFromPlans(baseline, proposal)

    expect(view.kind).toBe(TAX_OPPORTUNITY_VIEW_KIND)
    expect(view.version).toBe(CURRENT_TAX_OPPORTUNITY_VIEW_VERSION)
    expect(view.years).toHaveLength(comparison.annual.length)
    expect(view.years.map((row) => row.year)).toEqual(
      comparison.annual.map((row) => row.year),
    )

    for (let index = 0; index < comparison.annual.length; index++) {
      const annual = comparison.annual[index]!
      const yearRow = view.years[index]!
      expect(yearRow.year).toBe(annual.year)
      expect(yearRow.ledger).toEqual({
        tax: annual.values.tax.proposal,
        magi: annual.values.magi.proposal,
        irmaaTier: annual.values.irmaaTier.proposal,
        irmaaSurcharge: annual.values.irmaaSurcharge.proposal,
        rmd: annual.values.rmd.proposal,
        qcd: annual.values.qcd.proposal,
        rothConversion: annual.values.rothConversion.proposal,
        traditionalWithdrawals: annual.values.traditionalWithdrawals.proposal,
        withdrawals: annual.values.withdrawals.proposal,
        inheritedRequired: annual.values.inheritedRequired.proposal,
        taxExemptInterest: annual.values.taxExemptInterest.proposal,
        acaGrossEnrollmentPremium: annual.values.acaGrossEnrollmentPremium.proposal,
        acaModeledAllowablePtc: annual.values.acaModeledAllowablePtc.proposal,
        acaEconomicNetPremium: annual.values.acaEconomicNetPremium.proposal,
      })
      expect(yearRow.rmdPressure).toEqual({
        required: annual.values.rmd.proposal,
        inheritedRequired: annual.values.inheritedRequired.proposal,
        traditionalWithdrawals: annual.values.traditionalWithdrawals.proposal,
        qcd: annual.values.qcd.proposal,
      })
    }
  })

  it('links every action row to a ledger year with verbatim sourceAllocations', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { evaluation, view } = buildViewFromPlans(baseline, proposal)

    const yearSet = new Set(view.years.map((row) => row.year))
    expect(view.actions.length).toBe(evaluation.actions.length)
    expect(view.actions.map((action) => action.actionId).sort()).toEqual(
      [...evaluation.actions.map((action) => action.actionId)].sort(),
    )

    for (const action of view.actions) {
      expect(yearSet.has(action.year)).toBe(true)
      const source = evaluation.actions.find((row) => row.actionId === action.actionId)!
      expect(action.sourceAllocations).toEqual(source.sourceAllocations)
      expect(action.readiness).toBe(source.readiness)
      expect(action.outcome).toBe(source.outcome)
      expect(action.reasons).toEqual(source.reasons)
      expect(action.limitations).toEqual(source.limitations)
      expect(action.requestedAmountCents).toBe(source.requestedAmountCents)
      expect(action.executedAmountCents).toBe(source.executedAmountCents)
      expect(action.unexecutedAmountCents).toBe(source.unexecutedAmountCents)
    }

    for (let i = 1; i < view.actions.length; i++) {
      const prev = view.actions[i - 1]!
      const next = view.actions[i]!
      expect(
        prev.year < next.year ||
          (prev.year === next.year && prev.actionId <= next.actionId),
      ).toBe(true)
    }
  })

  it('deep-freezes the parsed document, action rows, allocations, and year ledgers', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { view } = buildViewFromPlans(baseline, proposal)

    expect(Object.isFrozen(view)).toBe(true)
    expect(view.actions.length).toBeGreaterThan(0)
    const action = view.actions[0]!
    expect(Object.isFrozen(action)).toBe(true)
    expect(Object.isFrozen(action.sourceAllocations)).toBe(true)
    expect(action.sourceAllocations.length).toBeGreaterThan(0)
    expect(Object.isFrozen(action.sourceAllocations[0]!)).toBe(true)
    expect(view.years.length).toBeGreaterThan(0)
    expect(Object.isFrozen(view.years[0]!.ledger)).toBe(true)
  })

  it('builds bracket sections from indexed pack tables and the $1,000 probe', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { proposalResult, view } = buildViewFromPlans(baseline, proposal)

    const withAdvisory = view.years.find((row) => row.bracket !== null)
    expect(withAdvisory).toBeDefined()
    const yearResult = proposalResult.years.find((row) => row.year === withAdvisory!.year)!
    expect(yearResult.advisoryFederalTax).toBeDefined()

    const { input, detail } = yearResult.advisoryFederalTax!
    const { pack } = packForYear(yearResult.year)
    const brackets = indexFederalTaxPack(pack, input.inflationScale ?? 1).federalTax
      .brackets[taxParameterFilingStatus(input.filingStatus)]
    let currentIndex = 0
    for (let i = 0; i < brackets.length; i++) {
      if (brackets[i]!.lowerBound <= detail.ordinaryTaxable) currentIndex = i
      else break
    }
    const current = brackets[currentIndex]!
    const next = brackets[currentIndex + 1]
    const bracketCeiling = next === undefined ? null : next.lowerBound

    expect(withAdvisory!.bracket).toEqual({
      taxableIncome: detail.taxableIncome,
      ordinaryTaxable: detail.ordinaryTaxable,
      statutoryRatePct: current.ratePct,
      bracketCeiling,
      ordinarySpaceRemaining:
        bracketCeiling === null ? null : bracketCeiling - detail.ordinaryTaxable,
      federalIncomeTaxMarginalRatePct:
        ((computeFederalTax({
          ...input,
          ordinaryIncome: input.ordinaryIncome + EFFECTIVE_MARGINAL_RATE_PROBE_DOLLARS,
        }).totalTax - detail.totalTax) /
          EFFECTIVE_MARGINAL_RATE_PROBE_DOLLARS) *
        100,
      excludes: ['irmaaSurcharge', 'acaPremiumTaxCredit', 'stateAndLocalTax'],
      zeroRateLtcgHeadroom: detail.zeroRateLtcgHeadroom,
    })
  })

  // Pack-year literals pin to the 2026 federal single table
  // (12_400 / 50_400 / … / 640_600). Hand-authored inputs; detail from
  // computeFederalTax so the builder's drift gate passes.
  it('fixture-driven bracket: ordinaryTaxable exactly on a 2026 single lowerBound', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })
    const targetYear = proposalResult.years[0]!
    // 2026 single: standard deduction 16_100; ordinaryTaxable 50_400 is the 22% lowerBound.
    const input: TaxYearInput = {
      year: targetYear.year,
      filingStatus: 'single',
      ordinaryIncome: 50_400 + 16_100,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 0,
    }
    const detail = computeFederalTax(input)
    expect(detail.ordinaryTaxable).toBe(50_400)

    const view = buildTaxOpportunityView({
      evaluation,
      proposalYears: proposalResult.years.map((year) =>
        year.year === targetYear.year
          ? {
              ...year,
              filingStatus: input.filingStatus,
              ltcgZeroHeadroom: detail.zeroRateLtcgHeadroom,
              amt: detail.alternativeMinimumTax,
              advisoryFederalTax: { input, detail },
            }
          : year,
      ),
    })
    const yearRow = view.years.find((row) => row.year === targetYear.year)!
    expect(yearRow.bracket).toMatchObject({
      ordinaryTaxable: 50_400,
      statutoryRatePct: 22,
      bracketCeiling: 105_700,
      ordinarySpaceRemaining: 105_700 - 50_400,
      excludes: ['irmaaSurcharge', 'acaPremiumTaxCredit', 'stateAndLocalTax'],
    })
  })

  it('fixture-driven bracket: open top 2026 single bracket leaves ceiling/space null', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })
    const targetYear = proposalResult.years[0]!
    // 2026 single: 640_600 opens the 37% bracket (no next lowerBound).
    const input: TaxYearInput = {
      year: targetYear.year,
      filingStatus: 'single',
      ordinaryIncome: 640_600 + 16_100,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 0,
    }
    const detail = computeFederalTax(input)
    expect(detail.ordinaryTaxable).toBe(640_600)

    const view = buildTaxOpportunityView({
      evaluation,
      proposalYears: proposalResult.years.map((year) =>
        year.year === targetYear.year
          ? {
              ...year,
              filingStatus: input.filingStatus,
              ltcgZeroHeadroom: detail.zeroRateLtcgHeadroom,
              amt: detail.alternativeMinimumTax,
              advisoryFederalTax: { input, detail },
            }
          : year,
      ),
    })
    const yearRow = view.years.find((row) => row.year === targetYear.year)!
    expect(yearRow.bracket).toMatchObject({
      ordinaryTaxable: 640_600,
      statutoryRatePct: 37,
      bracketCeiling: null,
      ordinarySpaceRemaining: null,
      excludes: ['irmaaSurcharge', 'acaPremiumTaxCredit', 'stateAndLocalTax'],
    })
  })

  it('nulls bracket / irmaa / aca sections when evidence is absent', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    const stripped: YearResult[] = proposalResult.years.map((year) => {
      const copy = { ...year }
      delete copy.advisoryFederalTax
      delete copy.irmaaLookbackMagi
      delete copy.irmaaLookbackMagiSource
      delete copy.irmaaLookbackMagiYear
      delete copy.irmaaNextTierThreshold
      delete copy.aca
      return copy
    })

    const view = buildTaxOpportunityView({
      evaluation,
      proposalYears: stripped,
    })

    for (const yearRow of view.years) {
      expect(yearRow.bracket).toBeNull()
      expect(yearRow.irmaa).toBeNull()
      expect(yearRow.aca).toBeNull()
    }
  })

  it('rejects incoherent IRMAA lookback evidence and accepts genuine simulator rows', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: proposalResult.years,
      }),
    ).not.toThrow()

    const withThreshold = proposalResult.years.find(
      (year) =>
        year.irmaaLookbackMagi !== undefined &&
        year.irmaaNextTierThreshold !== undefined &&
        year.irmaaNextTierThreshold !== null,
    )
    expect(withThreshold).toBeDefined()
    const targetYear = withThreshold!.year
    const threshold = withThreshold!.irmaaNextTierThreshold!

    const lookbackAtBoundary = proposalResult.years.map((year) =>
      year.year === targetYear
        ? { ...year, irmaaLookbackMagi: threshold }
        : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: lookbackAtBoundary,
      }),
    ).not.toThrow()

    const lookbackAboveBoundary = proposalResult.years.map((year) =>
      year.year === targetYear
        ? { ...year, irmaaLookbackMagi: threshold + 1 }
        : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: lookbackAboveBoundary,
      }),
    ).toThrow(new RegExp(`year ${targetYear}.*irmaaLookbackMagi`))

    const invalidLookbackYear = proposalResult.years.map((year) =>
      year.year === targetYear
        ? { ...year, irmaaLookbackMagiYear: targetYear - 3 }
        : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: invalidLookbackYear,
      }),
    ).toThrow(new RegExp(`year ${targetYear}.*irmaaLookbackMagiYear`))
  })

  it('populates irmaa sections from published lookback MAGI and next-tier threshold', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { proposalResult, view } = buildViewFromPlans(baseline, proposal)

    const withEvidence = proposalResult.years.find(
      (year) =>
        year.irmaaLookbackMagi !== undefined &&
        year.irmaaLookbackMagiSource !== undefined &&
        year.irmaaLookbackMagiYear !== undefined &&
        year.irmaaNextTierThreshold !== undefined,
    )
    expect(withEvidence).toBeDefined()
    const yearRow = view.years.find((row) => row.year === withEvidence!.year)!
    expect(yearRow.irmaa).not.toBeNull()
    expect(yearRow.irmaa!.lookbackMagi).toBe(withEvidence!.irmaaLookbackMagi)
    expect(yearRow.irmaa!.source).toBe(withEvidence!.irmaaLookbackMagiSource)
    expect(yearRow.irmaa!.lookbackYear).toBe(withEvidence!.irmaaLookbackMagiYear)
    expect(yearRow.irmaa!.tier).toBe(yearRow.ledger.irmaaTier)
    expect(yearRow.irmaa!.nextTierThreshold).toBe(withEvidence!.irmaaNextTierThreshold)
    expect(yearRow.irmaa!.distanceToNextTier).toBe(
      withEvidence!.irmaaNextTierThreshold === null
        ? null
        : withEvidence!.irmaaNextTierThreshold! - withEvidence!.irmaaLookbackMagi!,
    )
  })

  it('nulls irmaa distance/threshold when published next-tier threshold is null (no Medicare)', () => {
    const baseline = coupleWithCash()
    // All under 65 in 2026 — no Medicare months → null next-tier boundary.
    baseline.household.people[0]!.dob = '1970-01-01'
    baseline.household.people[1]!.dob = '1972-01-01'
    baseline.household.people[0]!.retirementAge = 65
    baseline.household.people[1]!.retirementAge = 65
    baseline.household.people[0]!.longevity = { planningAge: 70, source: 'manual' }
    baseline.household.people[1]!.longevity = { planningAge: 70, source: 'manual' }
    const proposal = structuredClone(baseline)
    const validatedBaseline = validatePlan(baseline)
    const validatedProposal = validatePlan(proposal)
    const { proposalResult, view } = buildViewFromPlans(validatedBaseline, validatedProposal)

    const year1 = proposalResult.years.find((year) => year.year === 2026)!
    expect(year1.people.every((person) => !person.alive || person.ageAttained < 65)).toBe(true)
    expect(year1.irmaaNextTierThreshold).toBeNull()

    const yearRow = view.years.find((row) => row.year === 2026)!
    if (yearRow.irmaa === null) {
      expect(yearRow.irmaa).toBeNull()
    } else {
      expect(yearRow.irmaa.nextTierThreshold).toBeNull()
      expect(yearRow.irmaa.distanceToNextTier).toBeNull()
    }
  })

  it('nulls irmaa section when next-tier threshold evidence is absent', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    const stripped: YearResult[] = proposalResult.years.map((year) => {
      const copy = { ...year }
      delete copy.irmaaNextTierThreshold
      return copy
    })

    const view = buildTaxOpportunityView({
      evaluation,
      proposalYears: stripped,
    })

    for (const yearRow of view.years) {
      expect(yearRow.irmaa).toBeNull()
    }
  })

  it('populates aca sections verbatim when YearResult.aca is present', () => {
    const baseline = coupleWithCash()
    baseline.household.people[0]!.dob = '1970-01-01'
    baseline.household.people[1]!.dob = '1972-01-01'
    baseline.household.people[0]!.retirementAge = 65
    baseline.household.people[1]!.retirementAge = 65
    baseline.household.people[0]!.longevity = { planningAge: 70, source: 'manual' }
    baseline.household.people[1]!.longevity = { planningAge: 70, source: 'manual' }
    setAcaYearContract(baseline, {
      year: 2026,
      monthlyEnrollment: 500,
      monthlySlcsp: 450,
    })
    const proposal = structuredClone(baseline)
    const validatedBaseline = validatePlan(baseline)
    const validatedProposal = validatePlan(proposal)
    const { proposalResult, view } = buildViewFromPlans(validatedBaseline, validatedProposal)

    const withAca = proposalResult.years.find((year) => year.aca !== undefined)
    expect(withAca).toBeDefined()
    const yearRow = view.years.find((row) => row.year === withAca!.year)!
    expect(yearRow.aca).toEqual({
      readiness: withAca!.aca!.readiness,
      cliffState: withAca!.aca!.cliffState,
      householdMagi: withAca!.aca!.householdMagi,
      fplPct: withAca!.aca!.fplPct,
      modeledAllowablePtc: withAca!.aca!.modeledAllowablePtc,
      economicNetPremium: withAca!.aca!.economicNetPremium,
    })
  })

  it('rejects flipped ACA readiness that preserves premium money but diverges actionable-year count', () => {
    const baseline = coupleWithCash()
    baseline.household.people[0]!.dob = '1970-01-01'
    baseline.household.people[1]!.dob = '1972-01-01'
    baseline.household.people[0]!.retirementAge = 65
    baseline.household.people[1]!.retirementAge = 65
    baseline.household.people[0]!.longevity = { planningAge: 70, source: 'manual' }
    baseline.household.people[1]!.longevity = { planningAge: 70, source: 'manual' }
    setAcaYearContract(baseline, {
      year: 2026,
      monthlyEnrollment: 500,
      monthlySlcsp: 450,
    })
    const proposal = structuredClone(baseline)
    const validatedBaseline = validatePlan(baseline)
    const validatedProposal = validatePlan(proposal)
    const comparison = compareScenarioPlans(validatedBaseline, validatedProposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(validatedProposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: proposalResult.years,
      }),
    ).not.toThrow()

    const withAca = proposalResult.years.find((year) => year.aca !== undefined)
    expect(withAca).toBeDefined()
    const flippedReadiness: 'actionable' | 'nonActionable' =
      withAca!.aca!.readiness === 'actionable' ? 'nonActionable' : 'actionable'
    const expectedActionableCount = evaluation.comparison.aca.actionableYears.proposal

    const tampered = proposalResult.years.map((year) =>
      year.year === withAca!.year
        ? {
            ...year,
            aca: {
              ...year.aca!,
              readiness: flippedReadiness,
            },
          }
        : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: tampered,
      }),
    ).toThrow(
      new RegExp(
        `aca actionable-year count .* does not match comparison \\(${expectedActionableCount}\\)`,
      ),
    )
  })

  it('rejects advisory taxExemptInterest that diverges from comparison while staying self-consistent', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: proposalResult.years,
      }),
    ).not.toThrow()

    const withAdvisory = proposalResult.years.find(
      (year) => year.advisoryFederalTax !== undefined,
    )
    expect(withAdvisory).toBeDefined()
    const annualRow = comparison.annual.find((row) => row.year === withAdvisory!.year)!
    const expectedExempt = annualRow.values.taxExemptInterest.proposal
    expect(expectedExempt).not.toBeNull()

    const donorInput = withAdvisory!.advisoryFederalTax!.input
    const forgedInput: TaxYearInput = {
      ...donorInput,
      taxExemptInterest: (donorInput.taxExemptInterest ?? 0) + 5_000,
    }
    const forgedDetail = computeFederalTax(forgedInput)
    const tampered = proposalResult.years.map((year) =>
      year.year === withAdvisory!.year
        ? {
            ...year,
            ltcgZeroHeadroom: forgedDetail.zeroRateLtcgHeadroom,
            amt: forgedDetail.alternativeMinimumTax,
            advisoryFederalTax: { input: forgedInput, detail: forgedDetail },
          }
        : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: tampered,
      }),
    ).toThrow(
      new RegExp(`year ${withAdvisory!.year} taxExemptInterest does not match comparison`),
    )
  })

  it('pins provenance.evaluationHash and stays deterministic', () => {
    const { baseline, proposal } = actionBearingPlans()
    const first = buildViewFromPlans(baseline, proposal)
    const second = buildViewFromPlans(baseline, proposal)

    expect(first.view.provenance.evaluationHash).toBe(
      taxStrategyEvaluationHash(first.evaluation),
    )
    expect(canonicalTaxOpportunityViewJson(first.view)).toBe(
      canonicalTaxOpportunityViewJson(second.view),
    )
    expect(taxOpportunityViewHash(first.view)).toBe(taxOpportunityViewHash(second.view))
    expect(taxOpportunityViewHash(first.view)).toMatch(/^fnv1a64:[0-9a-f]{16}$/)

    const reparsed = parseTaxOpportunityView(
      JSON.parse(JSON.stringify(first.view)) as unknown,
    )
    expect(canonicalTaxOpportunityViewJson(reparsed)).toBe(
      canonicalTaxOpportunityViewJson(first.view),
    )

    const canonical = canonicalTaxOpportunityViewJson(first.view)
    expect(canonical.indexOf('"kind"')).toBeLessThan(canonical.indexOf('"version"'))
  })

  it('propagates plan-wide evaluation limitations verbatim and freezes them', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      limitations: [pabAmtLimitation],
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })
    const view = buildTaxOpportunityView({
      evaluation,
      proposalYears: proposalResult.years,
    })

    expect(view.limitations).toEqual(evaluation.limitations)
    expect(view.limitations).toEqual([pabAmtLimitation])
    expect(Object.isFrozen(view.limitations)).toBe(true)
    expect(Object.isFrozen(view.limitations[0]!)).toBe(true)
    expect(() => verifyTaxOpportunityViewBinding(view, evaluation)).not.toThrow()
  })

  it('verifyTaxOpportunityViewBinding rejects dropped or edited plan-wide limitations', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      limitations: [pabAmtLimitation],
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })
    const view = buildTaxOpportunityView({
      evaluation,
      proposalYears: proposalResult.years,
    })

    const dropped = asRecord(view)
    dropped['limitations'] = []
    const parsedDropped = parseTaxOpportunityView(dropped)
    expect(() => verifyTaxOpportunityViewBinding(parsedDropped, evaluation)).toThrow(
      /limitations diverge/,
    )

    const edited = asRecord(view)
    const editedLim = (edited['limitations'] as Array<Record<string, unknown>>)[0]!
    editedLim['note'] = 'tampered note'
    const parsedEdited = parseTaxOpportunityView(edited)
    expect(() => verifyTaxOpportunityViewBinding(parsedEdited, evaluation)).toThrow(
      /limitations diverge/,
    )
  })

  it('rejects transplanted advisoryFederalTax and corrupted irmaaSurcharge bindings', () => {
    const { baseline, proposal } = actionBearingPlans()
    const comparison = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: proposalResult.years,
      }),
    ).not.toThrow()

    const withAdvisory = proposalResult.years.filter(
      (year) => year.advisoryFederalTax !== undefined,
    )
    expect(withAdvisory.length).toBeGreaterThanOrEqual(2)
    const donor = withAdvisory[0]!
    const recipient = withAdvisory[1]!
    expect(donor.year).not.toBe(recipient.year)

    const transplanted = proposalResult.years.map((year) =>
      year.year === recipient.year
        ? { ...year, advisoryFederalTax: donor.advisoryFederalTax }
        : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: transplanted,
      }),
    ).toThrow(new RegExp(`year ${recipient.year}`))

    // Same-year transplant: self-consistent advisory pair at a different income
    // level — passes year/detail drift gates, fails YearResult field cross-checks.
    const sameYearDonor = withAdvisory[0]!
    const donorInput = sameYearDonor.advisoryFederalTax!.input
    const fabricatedInput: TaxYearInput = {
      ...donorInput,
      // Swing hard either direction so ltcgZeroHeadroom (and often amt) diverge.
      ordinaryIncome: donorInput.ordinaryIncome < 100_000 ? 400_000 : 5_000,
    }
    const fabricatedDetail = computeFederalTax(fabricatedInput)
    expect(
      fabricatedDetail.zeroRateLtcgHeadroom !== sameYearDonor.ltcgZeroHeadroom ||
        fabricatedDetail.alternativeMinimumTax !== sameYearDonor.amt,
    ).toBe(true)
    const sameYearTransplant = proposalResult.years.map((year) =>
      year.year === sameYearDonor.year
        ? {
            ...year,
            advisoryFederalTax: { input: fabricatedInput, detail: fabricatedDetail },
          }
        : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: sameYearTransplant,
      }),
    ).toThrow(
      new RegExp(
        `(zeroRateLtcgHeadroom|alternativeMinimumTax|filingStatus).*year ${sameYearDonor.year}`,
      ),
    )

    const corruptedSurcharge = proposalResult.years.map((year, index) =>
      index === 0 ? { ...year, irmaaSurcharge: year.irmaaSurcharge + 1 } : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation,
        proposalYears: corruptedSurcharge,
      }),
    ).toThrow(/irmaaSurcharge/)
  })

  it('fail-closes on readiness upgrades, unknown kinds, orphan action years, and magi mismatch', () => {
    const { baseline, proposal } = refusedActionPlans()
    const { evaluation, view } = buildViewFromPlans(baseline, proposal)

    const nonActionable = view.actions.find((action) => action.readiness === 'nonActionable')
    expect(nonActionable).toBeDefined()

    const upgraded = asRecord(view)
    const upgradedAction = (upgraded['actions'] as Array<Record<string, unknown>>).find(
      (action) => action['readiness'] === 'nonActionable',
    )!
    upgradedAction['readiness'] = 'actionable'
    upgradedAction['executedAmountCents'] = upgradedAction['requestedAmountCents']
    upgradedAction['unexecutedAmountCents'] = 0
    const allocations = upgradedAction['sourceAllocations'] as Array<Record<string, unknown>>
    for (const allocation of allocations) {
      allocation['executedAmountCents'] = allocation['requestedAmountCents']
      allocation['unexecutedAmountCents'] = 0
    }
    expect(() => parseTaxOpportunityView(upgraded)).toThrow()

    const unknownKind = asRecord(view)
    const kindAction = (unknownKind['actions'] as Array<Record<string, unknown>>)[0]!
    kindAction['kind'] = 'daf'
    expect(() => parseTaxOpportunityView(unknownKind)).toThrow()

    const orphanYear = asRecord(view)
    const orphanAction = (orphanYear['actions'] as Array<Record<string, unknown>>)[0]!
    orphanAction['year'] = 1999
    expect(() => parseTaxOpportunityView(orphanYear)).toThrow()

    const proposalResult = simulatePlan(proposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })
    const mismatched = proposalResult.years.map((year, index) =>
      index === 0 ? { ...year, magi: year.magi + 1 } : year,
    )
    expect(() =>
      buildTaxOpportunityView({
        evaluation: parseTaxStrategyEvaluation(evaluation),
        proposalYears: mismatched,
      }),
    ).toThrow(/magi does not match comparison/)
  })

  it('rejects out-of-order actions and duplicate actionIds at parse', () => {
    const { baseline, proposal } = refusedActionPlans()
    const { view } = buildViewFromPlans(baseline, proposal)
    expect(view.actions.length).toBeGreaterThanOrEqual(2)

    const outOfOrder = asRecord(view)
    const actions = outOfOrder['actions'] as Array<Record<string, unknown>>
    const swapped = [actions[1]!, actions[0]!, ...actions.slice(2)]
    outOfOrder['actions'] = swapped
    expect(() => parseTaxOpportunityView(outOfOrder)).toThrow(/ascending \(year, actionId\)/)

    const duplicated = asRecord(view)
    const dupActions = duplicated['actions'] as Array<Record<string, unknown>>
    const clone = structuredClone(dupActions[0]!)
    // Keep canonical sort by placing the duplicate immediately after the original
    // with a tweaked actionId that sorts after, then restore the duplicated id.
    clone['actionId'] = dupActions[0]!['actionId']
    duplicated['actions'] = [dupActions[0]!, clone, ...dupActions.slice(1)]
    expect(() => parseTaxOpportunityView(duplicated)).toThrow(/duplicate actionId/)
  })

  it('verifyTaxOpportunityViewBinding rejects duplicate action rows that bypass parse', () => {
    const { baseline, proposal } = refusedActionPlans()
    const { evaluation, view } = buildViewFromPlans(baseline, proposal)
    const duplicated = structuredClone(view)
    const first = duplicated.actions[0]!
    duplicated.actions = [first, structuredClone(first), ...duplicated.actions.slice(1)]
    expect(() => verifyTaxOpportunityViewBinding(duplicated, evaluation)).toThrow(
      new RegExp(`duplicate actionId.*action ${first.actionId}`),
    )
  })

  it('verifyTaxOpportunityViewBinding rejects coherent forgeries that still parse', () => {
    const { baseline, proposal } = refusedActionPlans()
    const { evaluation, view } = buildViewFromPlans(baseline, proposal)
    expect(() => verifyTaxOpportunityViewBinding(view, evaluation)).not.toThrow()

    const refused = view.actions.find((action) => action.readiness === 'nonActionable')
    expect(refused).toBeDefined()

    // Forgery 1: refused action rewritten as fully-executed actionable.
    const forgedExecuted = asRecord(view)
    const forgedAction = (forgedExecuted['actions'] as Array<Record<string, unknown>>).find(
      (action) => action['actionId'] === refused!.actionId,
    )!
    forgedAction['readiness'] = 'actionable'
    forgedAction['outcome'] = 'executed'
    forgedAction['reasons'] = []
    forgedAction['executedAmountCents'] = forgedAction['requestedAmountCents']
    forgedAction['unexecutedAmountCents'] = 0
    for (const allocation of forgedAction['sourceAllocations'] as Array<Record<string, unknown>>) {
      allocation['resolution'] = 'resolved'
      allocation['executedAmountCents'] = allocation['requestedAmountCents']
      allocation['unexecutedAmountCents'] = 0
    }
    const parsedExecuted = parseTaxOpportunityView(forgedExecuted)
    expect(() => verifyTaxOpportunityViewBinding(parsedExecuted, evaluation)).toThrow(
      new RegExp(`action ${refused!.actionId}`),
    )

    // Forgery 2: source account swapped on an otherwise-schema-valid action.
    const actionable = view.actions.find((action) => action.readiness === 'actionable')
      ?? view.actions[0]!
    const forgedAccount = asRecord(view)
    const accountAction = (forgedAccount['actions'] as Array<Record<string, unknown>>).find(
      (action) => action['actionId'] === actionable.actionId,
    )!
    const allocs = accountAction['sourceAllocations'] as Array<Record<string, unknown>>
    expect(allocs.length).toBeGreaterThan(0)
    allocs[0]!['sourceAccountId'] = 'swapped-source-account'
    const parsedAccount = parseTaxOpportunityView(forgedAccount)
    expect(() => verifyTaxOpportunityViewBinding(parsedAccount, evaluation)).toThrow(
      new RegExp(`action ${actionable.actionId}`),
    )

    // Forgery 3: fabricated year row with the action moved onto it.
    const forgedYear = asRecord(view)
    const yearActions = forgedYear['actions'] as Array<Record<string, unknown>>
    const moved = yearActions.find((action) => action['actionId'] === actionable.actionId)!
    const fabricatedYear = 2099
    moved['year'] = fabricatedYear
    const years = forgedYear['years'] as Array<Record<string, unknown>>
    const template = structuredClone(years[years.length - 1]!)
    template['year'] = fabricatedYear
    years.push(template)
    // Re-sort actions into canonical (year, actionId) order after the move.
    yearActions.sort((left, right) => {
      const yearDelta = (left['year'] as number) - (right['year'] as number)
      if (yearDelta !== 0) return yearDelta
      const leftId = left['actionId'] as string
      const rightId = right['actionId'] as string
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0
    })
    const parsedYear = parseTaxOpportunityView(forgedYear)
    expect(() => verifyTaxOpportunityViewBinding(parsedYear, evaluation)).toThrow(
      /year 2099|action /,
    )
  })

  it('verifyTaxOpportunityViewBinding rejects tampered ledger and rmdPressure fields', () => {
    const { baseline, proposal } = actionBearingPlans()
    const { evaluation, view } = buildViewFromPlans(baseline, proposal)
    const tamperedYear = view.years[0]!.year

    const tamperedTax = asRecord(view)
    const taxYears = tamperedTax['years'] as Array<Record<string, unknown>>
    const taxLedger = taxYears[0]!['ledger'] as Record<string, unknown>
    taxLedger['tax'] = (taxLedger['tax'] as number) + 1
    const parsedTax = parseTaxOpportunityView(tamperedTax)
    expect(() => verifyTaxOpportunityViewBinding(parsedTax, evaluation)).toThrow(
      new RegExp(`year ${tamperedYear} ledger\\.tax diverges`),
    )

    const tamperedRmd = asRecord(view)
    const rmdYears = tamperedRmd['years'] as Array<Record<string, unknown>>
    const rmdPressure = rmdYears[0]!['rmdPressure'] as Record<string, unknown>
    rmdPressure['required'] =
      rmdPressure['required'] === null ? 1 : (rmdPressure['required'] as number) + 1
    const parsedRmd = parseTaxOpportunityView(tamperedRmd)
    expect(() => verifyTaxOpportunityViewBinding(parsedRmd, evaluation)).toThrow(
      new RegExp(`year ${tamperedYear} rmdPressure\\.required diverges`),
    )
  })

  it('builds baseline-only trailing years without proposal YearResult rows', () => {
    const baseline = coupleWithCash()
    baseline.household.people[0]!.longevity = { planningAge: 75, source: 'manual' }
    baseline.household.people[1]!.longevity = { planningAge: 75, source: 'manual' }
    const proposal = structuredClone(baseline)
    proposal.household.people[0]!.longevity = { planningAge: 70, source: 'manual' }
    proposal.household.people[1]!.longevity = { planningAge: 70, source: 'manual' }
    const validatedBaseline = validatePlan(baseline)
    const validatedProposal = validatePlan(proposal)

    const comparison = compareScenarioPlans(validatedBaseline, validatedProposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const proposalResult = simulatePlan(validatedProposal, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    const baselineOnlyRows = comparison.annual.filter((row) =>
      Object.values(row.values).every((value) => value.proposal === null),
    )
    expect(baselineOnlyRows.length).toBeGreaterThan(0)
    const trailingBaselineOnly = baselineOnlyRows[baselineOnlyRows.length - 1]!
    expect(
      proposalResult.years.some((year) => year.year === trailingBaselineOnly.year),
    ).toBe(false)

    const view = buildTaxOpportunityView({
      evaluation,
      proposalYears: proposalResult.years,
    })

    const trailingRow = view.years.find((row) => row.year === trailingBaselineOnly.year)!
    expect(trailingRow.ledger).toEqual({
      tax: null,
      magi: null,
      irmaaTier: null,
      irmaaSurcharge: null,
      rmd: null,
      qcd: null,
      rothConversion: null,
      traditionalWithdrawals: null,
      withdrawals: null,
      inheritedRequired: null,
      taxExemptInterest: null,
      acaGrossEnrollmentPremium: null,
      acaModeledAllowablePtc: null,
      acaEconomicNetPremium: null,
    })
    expect(trailingRow.bracket).toBeNull()
    expect(trailingRow.irmaa).toBeNull()
    expect(trailingRow.aca).toBeNull()
    expect(trailingRow.rmdPressure).toEqual({
      required: null,
      inheritedRequired: null,
      traditionalWithdrawals: null,
      qcd: null,
    })
    expect(() => verifyTaxOpportunityViewBinding(view, evaluation)).not.toThrow()
  })
})
