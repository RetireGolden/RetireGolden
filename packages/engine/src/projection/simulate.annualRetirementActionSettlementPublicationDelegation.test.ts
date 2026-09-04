/**
 * Hostile delegation guard for the settlement-publication coordinator seam.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
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

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualRetirementActionSettlementPublicationInput,
      AnnualRetirementActionSettlementPublicationResult
    >(),
)

vi.mock(
  './internal/annualRetirementActionSettlementPublication.js',
  async (importOriginal) =>
    seam.through(
      await importOriginal<
        typeof import('./internal/annualRetirementActionSettlementPublication.js')
      >(),
      'annualRetirementActionSettlementPublication',
      (
        _natural,
        { input },
      ): AnnualRetirementActionSettlementPublicationResult => ({
        retirementActionPublication: Object.freeze({
          sentinel: 'publication',
        }) as unknown as AnnualRetirementActionPublication,
        conversionLinkedWithdrawalGroupExecution: Object.freeze({
          sentinel: 'linked-execution',
        }) as unknown as ExecuteConversionLinkedWithdrawalGroupsResult,
        qcdActionPrerequisites: {
          status: 'evaluated',
          committed: false,
          taxYear: input.taxYear,
          requests: [],
          evidence: Object.freeze([{ sentinel: 'qcd-prerequisite' }]),
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
      }),
    ),
)

import {
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'

import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const zeroTax: TaxCalculator = { compute: () => 0 }

describe('simulatePlan settlement-publication delegation', () => {
  beforeEach(() => {
    seam.reset()
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

    const call = expectSeamRan(seam, 1)[0]!
    expect(call.input).toMatchObject({
      planId: plan.id,
      taxYear: 2026,
      taxPlanDollars: 0,
      penaltiesPlanDollars: 0,
    })
    const year = result.years[0]!
    expectPublishedFromSeam(
      year.retirementActionPublication,
      call.injected.retirementActionPublication,
      'year.retirementActionPublication',
    )
    expectPublishedFromSeam(
      year.conversionLinkedWithdrawalGroupExecution,
      call.injected.conversionLinkedWithdrawalGroupExecution,
      'year.conversionLinkedWithdrawalGroupExecution',
    )
    expectPublishedFromSeam(
      year.qcdActionPrerequisites,
      call.injected.qcdActionPrerequisites!.evidence,
      'year.qcdActionPrerequisites',
    )
  })
})
