import { describe, expect, it } from 'vitest'
import { singlePersonPlan, cashAccount, validatePlan } from '../testing/planFixtures.js'
import type { Account } from '../model/plan.js'
import { HECM_MODELED_DEBT_TIMING_ISSUE } from './internal/hecmLineState.js'
import { simulatePlan } from './simulate.js'

const provenance = {
  source: 'HUD H4 closing and servicer monthly assessment worksheet',
  asOf: '2026-12-31',
}

function hudLedgerFromOpening(openingBalance: number, complete = true) {
  return Array.from({ length: complete ? 12 : 1 }, (_, index) => ({
    assessmentDate: `2026-${String(index + 1).padStart(2, '0')}-28`,
    outstandingBalanceBeforeMip: openingBalance * (1 + 0.005 / 12) ** index,
    provenance,
  }))
}

function hudProperty(overrides: {
  drawPolicy?: 'coordinated' | 'lastResort'
  growthRatePct?: number
  completeLedger?: boolean
  treatment?: 'disburseAtModeledClosing' | 'alreadyIncludedInStartingCash'
  expenses?: number
  cash?: number
  horizon?: number
} = {}) {
  const openingBalance = 129_982.5
  const hasTreatmentOverride = Object.prototype.hasOwnProperty.call(overrides, 'treatment')
  // An observed closing advance is represented by starting cash. Preserve
  // that control when the caller leaves treatment at its fixture default, but
  // keep an explicitly undefined treatment unknown so production validation
  // can refuse it rather than silently choosing a cash-ownership policy.
  const treatment = hasTreatmentOverride
    ? overrides.treatment
    : 'alreadyIncludedInStartingCash' as const
  const initialCash =
    overrides.cash ?? (treatment === 'alreadyIncludedInStartingCash' ? 100_000 : 0)
  const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 80 })
  plan.expenses.baseAnnual = overrides.expenses ?? 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  const complete = overrides.completeLedger ?? true
  plan.accounts = [
    cashAccount('cash', initialCash),
    {
      id: 'home',
      name: 'Home',
      type: 'property',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      value: 2_000_000,
      primaryResidence: true,
      plannedSaleYear: null,
      expectedNetProceeds: null,
      hecm: {
        openYear: 2026,
        growthRatePct: overrides.growthRatePct ?? 0,
        drawPolicy: overrides.drawPolicy ?? 'lastResort',
        calculationMode: 'hudValidated',
        hudTransactionKind: 'ordinaryOrigination',
        caseAssignmentDate: '2026-01-01',
        closingDate: '2026-01-01',
        appraisedValue: 2_000_000,
        verifiedPrincipalLimitFactorPct: 50,
        principalLimitFactorProvenance: { ...provenance, kind: 'quoted' },
        otherClosingCosts: 5_000,
        closingDayBorrowerAdvance: 100_000,
        ...(treatment === undefined
          ? {}
          : { closingDayBorrowerAdvanceTreatment: treatment }),
        firstMipPeriodConvention: 'fullCalendarMonths',
        mipAssessmentLedgerEvidence: {
          completeThroughDate: '2026-12-31',
          noUnrepresentedTransactionsAfterLastAssessment: true,
          provenance,
        },
        outstandingBalanceAtMipAssessmentByMonth: hudLedgerFromOpening(
          openingBalance,
          complete,
        ),
      },
    } as Account,
  ]
  return validatePlan(plan)
}

function runPlan(overrides: Parameters<typeof hudProperty>[0] = {}) {
  const horizon = overrides.horizon ?? 2026
  return simulatePlan(hudProperty(overrides), {
    startYear: 2026,
    horizonEndYear: horizon,
    taxCalculator: { compute: () => 0 },
  })
}

describe('HUD HECM actual annual ledger', () => {
  it('posts the closing advance once and the complete compounded assessment balance', () => {
    const modeled = runPlan({ treatment: 'disburseAtModeledClosing' })
    const observed = runPlan({ treatment: 'alreadyIncludedInStartingCash' })
    expect(modeled.years[0]!.hecmLoanBalance).toBeCloseTo(129_982.5 * (1 + 0.005 / 12) ** 12, 6)
    expect(modeled.endingInvestable).toBe(100_000)
    expect(observed.endingInvestable).toBe(100_000)
    expect(modeled.years[0]!.hecmComputation?.status).toBe('complete')
  })

  it('publishes incomplete for missing assessments and unknown closing cash ownership', () => {
    expect(runPlan({ completeLedger: false }).years[0]!.hecmComputation?.status).toBe(
      'incomplete',
    )
    const refused = runPlan({ treatment: undefined })
    expect(refused.endingInvestable).toBe(0)
    expect(refused.years[0]!.hecmComputation?.status).toBe('incomplete')
  })
})

describe('HUD HECM modeled draw vs servicer ledger (r1-3/r1-4)', () => {
  const openingBalance = 129_982.5
  const observedAfterMip = openingBalance * (1 + 0.005 / 12) ** 12

  it('preserves a backstop draw through complete servicer replacement (r1-3)', () => {
    const draw = 10_000
    const growth = 1.065
    const result = runPlan({
      cash: 0,
      expenses: draw,
      growthRatePct: (growth - 1) * 100,
      treatment: 'alreadyIncludedInStartingCash',
    })
    const year = result.years[0]!
    // The annual growth multiplier conserves the modeled draw as an all-in
    // planning estimate, but the fixture has no draw date; complete observed
    // servicing evidence therefore cannot certify the whole HUD balance.
    expect(year.hecmDraw).toBeCloseTo(draw, 2)
    expect(year.hecmLoanBalance).toBeCloseTo(observedAfterMip + draw * growth, 4)
    expect(year.hecmComputation?.status).toBe('incomplete')
    expect(year.hecmComputation?.issues).toContain(HECM_MODELED_DEBT_TIMING_ISSUE)
  })

  it('preserves a coordinated draw while disclosing missing year-two timing evidence (r1-3)', () => {
    const growth = 1.065
    const plan = hudProperty({
      drawPolicy: 'coordinated',
      growthRatePct: (growth - 1) * 100,
      horizon: 2027,
      treatment: 'alreadyIncludedInStartingCash',
      expenses: 40_000,
    })
    plan.accounts.unshift({
      type: 'taxable',
      id: 'brokerage',
      name: 'Brokerage',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 500_000,
      costBasis: 500_000,
      annualContribution: 0,
    })
    plan.assumptions.defaultReturnPct = -10
    const result = simulatePlan(plan, {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: { compute: () => 0 },
    })
    const year = result.years.find((candidate) => candidate.year === 2027)!
    expect(year.hecmDraw).toBeGreaterThan(0)
    expect(year.hecmLoanBalance).toBeGreaterThan(observedAfterMip * growth)
    expect(year.hecmComputation?.status).toBe('incomplete')
    expect(year.hecmComputation?.issues).toContain(
      'The assessment ledger is not verified complete through year end.',
    )
    expect(year.hecmComputation?.issues).toContain(HECM_MODELED_DEBT_TIMING_ISSUE)
  })

  it('discloses growthRatePct estimate for a partial ledger without freezing debt (r1-4)', () => {
    const growth = 1.065
    const result = runPlan({
      completeLedger: false,
      growthRatePct: (growth - 1) * 100,
      treatment: 'alreadyIncludedInStartingCash',
    })
    const year = result.years[0]!
    expect(year.hecmComputation?.status).toBe('incomplete')
    expect(year.hecmLoanBalance).toBeCloseTo(openingBalance * growth, 2)
  })

  it('carries modeled debt forward so year-two debt exceeds observed-only growth', () => {
    const draw = 10_000
    const growth = 1.065
    const result = runPlan({
      cash: 0,
      expenses: draw,
      growthRatePct: (growth - 1) * 100,
      horizon: 2027,
      treatment: 'alreadyIncludedInStartingCash',
    })
    const yearOneDebt = observedAfterMip + draw * growth
    expect(result.years[0]!.hecmLoanBalance).toBeCloseTo(yearOneDebt, 4)
    expect(result.years[1]!.hecmLoanBalance).toBeGreaterThan(result.years[0]!.hecmLoanBalance)
    expect(result.years[1]!.hecmLoanBalance).toBeGreaterThan(observedAfterMip * growth)
    // Carrying the modeled component is intentional; its missing draw/accrual
    // timing remains incomplete on the following year as well.
    expect(result.years[1]!.hecmComputation?.status).toBe('incomplete')
    expect(result.years[1]!.hecmComputation?.issues).toContain(HECM_MODELED_DEBT_TIMING_ISSUE)
  })

  it('keeps exact ledger totals when there is no modeled draw', () => {
    const result = runPlan({ growthRatePct: 0, treatment: 'alreadyIncludedInStartingCash' })
    expect(result.years[0]!.hecmLoanBalance).toBeCloseTo(129_982.5 * (1 + 0.005 / 12) ** 12, 6)
    expect(result.years[0]!.hecmDraw).toBe(0)
  })
})
