/** Hostile delegation guard for the pension/annuity coordinator seam. */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualPensionAndAnnuityIncomeInput,
  AnnualPensionAndAnnuityIncomeResult,
} from './internal/annualPensionAndAnnuityIncome.js'

const seam = vi.hoisted(() => ({
  calls: [] as Array<Readonly<{
    year: number
    observedPriorExclusionIdentity: boolean
    observedPriorContractValue: number | undefined
  }>>,
  exclusionWrite: { ratio: 0.25, remaining: 900 },
}))

vi.mock('./internal/annualPensionAndAnnuityIncome.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualPensionAndAnnuityIncome.js')
  >()
  return {
    ...original,
    annualPensionAndAnnuityIncome: (
      input: AnnualPensionAndAnnuityIncomeInput,
    ): AnnualPensionAndAnnuityIncomeResult => {
      // Execute the real helper first so this guard also catches accidental
      // input mutation before the injected payload is returned.
      original.annualPensionAndAnnuityIncome(input)
      seam.calls.push({
        year: input.year,
        observedPriorExclusionIdentity:
          input.annuityExclusionState.get('ghost-annuity') ===
            seam.exclusionWrite,
        observedPriorContractValue:
          input.annuityContractValue.get('ghost-annuity'),
      })
      const producerOccurrenceKey = input.runtimeOccurrenceKey(
        'annuityContractDistribution',
        'ghost-annuity',
      )
      return {
        annuityIncome: input.opening.annuityIncome + 1_200,
        pensionIncome: input.opening.pensionIncome + 2_400,
        ordinaryIncome: input.opening.ordinaryIncome + 3_600,
        privateRetirementOrdinary:
          input.opening.privateRetirementOrdinary + 1_200,
        publicPensionOrdinary:
          input.opening.publicPensionOrdinary + 2_400,
        qualifiedAnnuityPayments: [{
          annuityAccountId: 'ghost-annuity',
          payment: 1_200,
          fundingOwnerPersonId: 'p1',
        }],
        rows: [
        {
          kind: 'pension',
          accountId: 'pension-row',
          record: {
              accountId: 'ghost-pension',
              payeePersonId: 'p1',
              amount: 2_400,
              source: 'public',
            },
          },
          {
            kind: 'annuity',
            accountId: 'ghost-annuity',
            record: {
              accountId: 'ghost-annuity',
              recipientPersonId: 'p1',
              paid: 1_200,
              nonqualifiedExcludable: 0,
              qualifiedIraFunded: true,
              fundingOwnerPersonId: 'p1',
            },
            exclusionStateWrite: {
              accountId: 'ghost-annuity',
              value: seam.exclusionWrite,
            },
            contractDistribution: {
              annuityAccountId: 'ghost-annuity',
              poolOwnerPersonId: 'p1',
              grossAmountPlanDollars: 1_200,
              contractValueAfter: 777,
              occurrence: {
                producerOccurrenceKey,
                kind: 'annuityContractDistribution',
                grossAmountPlanDollars: 1_200,
                ownerPersonId: 'p1',
                sourceAccountId: 'ghost-annuity',
                executionDate: null,
                executionSequence: null,
                movementAuthorityId: null,
              },
              application: {
                applicationKind: 'debit',
                producerOccurrenceKey,
                simulatorPhase: 'annuityContractDistribution',
                ownerPersonId: 'p1',
                sourceAccountId: 'ghost-annuity',
                sourceBalanceBeforePlanDollars: 1_977,
                appliedAmountPlanDollars: 1_200,
                sourceBalanceAfterPlanDollars: 777,
              },
            },
          },
        ],
      }
    },
  }
})

import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import type { TaxYearInput } from './types.js'
import { simulatePlan } from './simulate.js'

describe('simulatePlan delegates annual pension and annuity income', () => {
  it('uses returned folds and commits returned rows in order across years', () => {
    seam.calls.length = 0
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 61 })
    plan.accounts = [cashAccount('cash', 0)]
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    const stateTaxInputs = new Map<number, Readonly<{
      privateRetirementIncome: number | undefined
      publicPensionIncome: number | undefined
    }>>()
    const flatTax = createFlatTaxCalculator(0)
    const taxCalculator = {
      compute(input: TaxYearInput): number {
        stateTaxInputs.set(input.year, {
          privateRetirementIncome: input.privateRetirementIncome,
          publicPensionIncome: input.publicPensionIncome,
        })
        return flatTax.compute(input)
      },
    }

    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator,
      captureAnnualCashFlow: true,
    })

    expect(seam.calls).toEqual([
      {
        year: 2026,
        observedPriorExclusionIdentity: false,
        observedPriorContractValue: undefined,
      },
      {
        year: 2027,
        observedPriorExclusionIdentity: true,
        observedPriorContractValue: 777,
      },
    ])
    expect([...stateTaxInputs]).toEqual([
      [2026, {
        privateRetirementIncome: 1_200,
        publicPensionIncome: 2_400,
      }],
      [2027, {
        privateRetirementIncome: 1_200,
        publicPensionIncome: 2_400,
      }],
    ])
    for (const year of result.years) {
      expect(year.incomes.annuity).toBe(1_200)
      expect(year.incomes.pension).toBe(2_400)
      expect(year.magi).toBe(3_600)
      expect(year.qualifiedAnnuityPayments).toEqual([{
        annuityAccountId: 'ghost-annuity',
        payment: 1_200,
        fundingOwnerPersonId: 'p1',
      }])
      expect(year.cashFlow?.sourceLines).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'source:annuityPayment:ghost-annuity',
          amountPlanDollars: 1_200,
        }),
        expect.objectContaining({
          id: 'source:pension:ghost-pension',
          amountPlanDollars: 2_400,
        }),
      ]))
      expect(year.retirementRuntimeSource?.runtimeOccurrences).toContainEqual(
        expect.objectContaining({
          kind: 'annuityContractDistribution',
          grossAmountPlanDollars: 1_200,
          sourceAccountId: 'ghost-annuity',
        }),
      )
      expect(
        year.retirementRuntimeApplicationSource?.applications,
      ).toContainEqual(expect.objectContaining({
        applicationKind: 'debit',
        simulatorPhase: 'annuityContractDistribution',
        mutationOrdinal: 1,
        appliedAmountPlanDollars: 1_200,
      }))
    }
  })
})
