/** Hostile delegation guard for the settlement-publication coordinator seam. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualRetirementActionSettlementPublicationInput,
  AnnualRetirementActionSettlementPublicationResult,
} from './internal/annualRetirementActionSettlementPublication.js'
import type {
  AnnualRetirementActionPublication,
  EvaluateAnnualQcdExecutionPrerequisitesResult,
  ExecuteConversionLinkedWithdrawalGroupsResult,
} from '../actions/index.js'

const seam = vi.hoisted(() => ({
  calls: [] as AnnualRetirementActionSettlementPublicationInput[],
  publication: Object.freeze({ sentinel: 'publication' }),
  linkedExecution: Object.freeze({ sentinel: 'linked-execution' }),
  prerequisiteEvidence: Object.freeze([{ sentinel: 'qcd-prerequisite' }]),
}))

vi.mock(
  './internal/annualRetirementActionSettlementPublication.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualRetirementActionSettlementPublication.js')
    >()
    return {
      ...original,
      annualRetirementActionSettlementPublication: (
        input: AnnualRetirementActionSettlementPublicationInput,
      ): AnnualRetirementActionSettlementPublicationResult => {
        original.annualRetirementActionSettlementPublication(input)
        seam.calls.push(input)
        return {
          retirementActionPublication:
            seam.publication as unknown as AnnualRetirementActionPublication,
          conversionLinkedWithdrawalGroupExecution:
            seam.linkedExecution as unknown as ExecuteConversionLinkedWithdrawalGroupsResult,
          qcdActionPrerequisites: {
            status: 'evaluated',
            committed: false,
            taxYear: input.taxYear,
            requests: [],
            evidence: seam.prerequisiteEvidence,
            publicationSource: {
              executorSource: 'qcd',
              records: [],
              scheduleDiagnostics: [],
            },
            issues: [],
          } as unknown as Extract<
            EvaluateAnnualQcdExecutionPrerequisitesResult,
            { status: 'evaluated' }
          >,
        }
      },
    }
  },
)

import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const zeroTax: TaxCalculator = { compute: () => 0 }

describe('simulatePlan settlement-publication delegation', () => {
  beforeEach(() => {
    seam.calls.length = 0
  })

  it('publishes the coordinator-owned objects without rebuilding them', () => {
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 60 })
    plan.accounts = []
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }

    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: zeroTax,
    })

    expect(seam.calls).toHaveLength(1)
    expect(seam.calls[0]).toMatchObject({
      planId: plan.id,
      taxYear: 2026,
      taxPlanDollars: 0,
      penaltiesPlanDollars: 0,
    })
    expect(result.years[0]!.retirementActionPublication).toBe(
      seam.publication,
    )
    expect(
      result.years[0]!.conversionLinkedWithdrawalGroupExecution,
    ).toBe(seam.linkedExecution)
    expect(result.years[0]!.qcdActionPrerequisites).toBe(
      seam.prerequisiteEvidence,
    )
  })
})
