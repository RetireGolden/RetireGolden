import { describe, expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import type { AnnualFederalTaxFacts, Plan } from '../model/plan.js'
import {
  productionTaxCalculator,
  recurringOrdinaryIncome,
  runPlan,
  setAcaYearContract,
  singlePersonPlan,
  taxableAccount,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { annualHealthcareExpenses } from './internal/annualHealthcareExpenses.js'
import { resolveAnnualFederalTaxFacts } from './internal/annualFederalTaxFacts.js'
import type { PersonYearState, ProjectionResult } from './types.js'

const taxYear = 2026
const personAgeAttained = taxYear - 1964
const broadProvenance = {
  sourceKind: 'planningEstimate' as const,
  acquisition: 'manual' as const,
}
const niitProvenance = {
  sourceKind: 'planningEstimate' as const,
  acquisition: 'manual' as const,
}
const unknownProvenance = {
  sourceKind: 'unresolvedSource' as const,
  acquisition: 'manual' as const,
}

function broadKnown(amount: number) {
  return { state: 'known' as const, amount, provenance: broadProvenance }
}

function niitKnown(amount: number) {
  return { state: 'known' as const, amount, provenance: niitProvenance }
}

function adjustmentRow(
  foreignExclusionAddback: AnnualFederalTaxFacts['foreignIncomeAdjustments'][number]['foreignExclusionAddback'],
  niitSection911A1NetAddback: AnnualFederalTaxFacts['foreignIncomeAdjustments'][number]['niitSection911A1NetAddback'],
): AnnualFederalTaxFacts {
  return {
    foreignIncomeAdjustments: [{
      year: taxYear,
      foreignExclusionAddback,
      niitSection911A1NetAddback,
    }],
  }
}

/**
 * Characterization review note: this fixture pins the dormant-field invariant
 * that populated `annualFederalTaxFacts` do not change published projection
 * outputs today. Values are regression guardrails, not independent legal
 * oracles; update only after reviewing the changed ledger story.
 */
function taxBearingAcaPlan(acaForeignExclusionAddback?: { state: 'known'; amount: number }): Plan {
  const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 85, state: 'KY' })
  plan.accounts = [
    taxableAccount('brokerage', 180_000, 120_000),
    traditionalAccount('ira', 450_000),
  ]
  plan.incomes = [recurringOrdinaryIncome('salary', 95_000, taxYear)]
  plan.expenses.baseAnnual = 48_000
  setAcaYearContract(plan, { year: taxYear, monthlyEnrollment: 650 })
  if (acaForeignExclusionAddback !== undefined) {
    const contract = plan.expenses.healthcare.acaYears!.find((entry) => entry.year === taxYear)
    if (contract === undefined) throw new Error('missing ACA year contract')
    contract.foreignExclusionAddback = acaForeignExclusionAddback
  }
  return validatePlan(plan)
}

function acaHealthcareAssembly(plan: Plan) {
  const peopleStates: PersonYearState[] = [{
    personId: 'p1',
    ageAttained: personAgeAttained,
    alive: true,
  }]
  const { pack, isStandIn } = packForYear(taxYear)
  return annualHealthcareExpenses({
    plan,
    pack,
    year: taxYear,
    startYear: taxYear,
    peopleStates,
    birthMonthByPerson: new Map([['p1', 1]]),
    resolveMagiFor: (year) => ({ magi: 0, source: 'planFallback', year }),
    ssa44ActiveInYear: () => false,
    filingStatusForYear: 'single',
    taxFilingStatusForYear: 'single',
    inflFactorFrom: () => 1,
    healthInflFactorFrom: () => 1,
    isStandIn,
    hasModeledPerson: (personId) => personId === 'p1',
    resolvePerson: () => peopleStates[0]!,
    planHasTaxExemptYieldAttestation: false,
    taxExemptInterest: 0,
  })
}

function publishedProjection(plan: Plan): ProjectionResult {
  const result = runPlan(plan, productionTaxCalculator(), taxYear)
  expect(result.years.some((year) => year.tax > 0)).toBe(true)
  const currentYear = result.years.find((year) => year.year === taxYear)
  expect(currentYear?.aca?.readiness).toBe('actionable')
  return result
}

describe('annualFederalTaxFacts characterization — unchanged published projection', () => {
  it('matches baseline when current-year facts are known, unknown, or ACA-conflicting', () => {
    const baseline = taxBearingAcaPlan()
    const baselineProjection = publishedProjection(baseline)

    const knownFacts = validatePlan(structuredClone(baseline))
    knownFacts.annualFederalTaxFacts = adjustmentRow(
      broadKnown(30_000),
      niitKnown(20_000),
    )
    expect(publishedProjection(knownFacts)).toEqual(baselineProjection)

    const unknownFacts = validatePlan(structuredClone(baseline))
    unknownFacts.annualFederalTaxFacts = adjustmentRow(
      { state: 'unknown', amount: null, provenance: unknownProvenance },
      { state: 'unknown', amount: null, provenance: unknownProvenance },
    )
    expect(publishedProjection(unknownFacts)).toEqual(baselineProjection)

    const acaTenThousandBaseline = taxBearingAcaPlan({ state: 'known', amount: 10_000 })
    const acaTenThousandProjection = publishedProjection(acaTenThousandBaseline)

    const conflictingFacts = validatePlan(structuredClone(acaTenThousandBaseline))
    conflictingFacts.annualFederalTaxFacts = adjustmentRow(
      broadKnown(30_000),
      niitKnown(20_000),
    )
    const healthcare = acaHealthcareAssembly(conflictingFacts)
    expect(healthcare.acaGeneralTaxCompatibilityEligible).toBe(true)
    const conflictResolution = resolveAnnualFederalTaxFacts({
      annualFederalTaxFacts: conflictingFacts.annualFederalTaxFacts,
      year: taxYear,
      acaContract: healthcare.acaContract,
      acaGeneralTaxCompatibilityEligible: healthcare.acaGeneralTaxCompatibilityEligible,
    })
    expect(conflictResolution.broad.broadTreatment).toBe('generalAndAcaConflictSourceLocal')
    expect(publishedProjection(conflictingFacts)).toEqual(acaTenThousandProjection)
  })
})
