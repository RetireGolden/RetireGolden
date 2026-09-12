import { describe, expect, it } from 'vitest'
import { singlePersonPlan, cashAccount, validatePlan } from '../testing/planFixtures.js'
import type { Account } from '../model/plan.js'
import { simulatePlan } from './simulate.js'

function planFor(treatment: 'disburseAtModeledClosing' | 'alreadyIncludedInStartingCash' | undefined, complete = true) {
  const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 80 })
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  const provenance = { source: 'HUD H4 closing and servicer monthly assessment worksheet', asOf: '2026-12-31' }
  plan.accounts = [cashAccount('cash', treatment === 'alreadyIncludedInStartingCash' ? 100000 : 0), {
    id: 'home', name: 'Home', type: 'property', ownerPersonId: 'p1', annualReturnPct: 0,
    value: 2000000, primaryResidence: true, plannedSaleYear: null, expectedNetProceeds: null,
    hecm: { openYear: 2026, growthRatePct: 0, drawPolicy: 'lastResort',
      calculationMode: 'hudValidated', hudTransactionKind: 'ordinaryOrigination',
      caseAssignmentDate: '2026-01-01', closingDate: '2026-01-01',
      appraisedValue: 2000000, verifiedPrincipalLimitFactorPct: 50,
      principalLimitFactorProvenance: { ...provenance, kind: 'quoted' }, otherClosingCosts: 5000,
      closingDayBorrowerAdvance: 100000, closingDayBorrowerAdvanceTreatment: treatment,
      firstMipPeriodConvention: 'fullCalendarMonths',
      mipAssessmentLedgerEvidence: { completeThroughDate: '2026-12-31', noUnrepresentedTransactionsAfterLastAssessment: true, provenance },
      outstandingBalanceAtMipAssessmentByMonth: Array.from({ length: complete ? 12 : 1 }, (_, index) => ({
        assessmentDate: `2026-${String(index + 1).padStart(2, '0')}-28`,
        outstandingBalanceBeforeMip: 129982.5 * (1 + .005 / 12) ** index, provenance,
      })),
    },
  } as Account]
  return validatePlan(plan)
}
function run(treatment: Parameters<typeof planFor>[0], complete = true) {
  return simulatePlan(planFor(treatment, complete), { startYear: 2026, horizonEndYear: 2026, taxCalculator: { compute: () => 0 } })
}
describe('HUD HECM actual annual ledger', () => {
  it('posts the closing advance once and the complete compounded assessment balance', () => {
    // HUD 4000.1 H4: 1249125 * .02 + 5000 + 100000 = 129982.50.
    // Twelve monthly .5%/12 assessments compound to the closing debt below.
    const modeled = run('disburseAtModeledClosing')
    const observed = run('alreadyIncludedInStartingCash')
    expect(modeled.years[0]!.hecmLoanBalance).toBeCloseTo(129982.5 * (1 + .005 / 12) ** 12, 6)
    expect(modeled.endingInvestable).toBe(100000)
    expect(observed.endingInvestable).toBe(100000)
    expect(modeled.years[0]!.hecmComputation?.status).toBe('complete')
  })
  it('publishes incomplete for missing assessments and unknown closing cash ownership', () => {
    expect(run('disburseAtModeledClosing', false).years[0]!.hecmComputation?.status).toBe('incomplete')
    const refused = run(undefined)
    expect(refused.endingInvestable).toBe(0)
    expect(refused.years[0]!.hecmComputation?.status).toBe('incomplete')
  })
})
