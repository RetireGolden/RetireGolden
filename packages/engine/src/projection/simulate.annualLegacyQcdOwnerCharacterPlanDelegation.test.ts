/** Hostile delegation guard for grouped legacy-QCD owner character. */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualLegacyQcdOwnerCharacterPlanInput,
  AnnualLegacyQcdOwnerCharacterPlanResult,
} from './internal/annualLegacyQcdOwnerCharacterPlan.js'
import type { IraProRataYear } from '../strategies/iraBasis.js'

const seam = vi.hoisted(() => ({
  inputs: [] as AnnualLegacyQcdOwnerCharacterPlanInput[],
  returnedProRata: [] as IraProRataYear[],
  splitInputs: [] as IraProRataYear[],
}))

vi.mock('../strategies/iraBasis.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../strategies/iraBasis.js')>()
  return {
    ...original,
    splitIraDistribution: (state: IraProRataYear, amount: number) => {
      seam.splitInputs.push(state)
      return original.splitIraDistribution(state, amount)
    },
  }
})

vi.mock('./internal/annualLegacyQcdOwnerCharacterPlan.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualLegacyQcdOwnerCharacterPlan.js')
  >()
  return {
    ...original,
    annualLegacyQcdOwnerCharacterPlan: (
      input: AnnualLegacyQcdOwnerCharacterPlanInput,
    ): AnnualLegacyQcdOwnerCharacterPlanResult => {
      seam.inputs.push(input)
      const natural = original.annualLegacyQcdOwnerCharacterPlan(input)
      const row = natural.rows[0]
      if (row === undefined) throw new Error('expected one QCD owner row')
      const exactProRataWrite: IraProRataYear = {
        basis: 53_000,
        nontaxableFraction: 0,
      }
      seam.returnedProRata.push(exactProRataWrite)
      return {
        rows: [{
          ...row,
          incomeOffsetDelta: 123,
          nonQualifiedOrdinaryIncomeDelta: 45,
          qcdOffsetConsumedWrite: 67_890,
          iraProRataWrite: exactProRataWrite,
          cashFlowWrites: [
            { ownerId: 'p1', target: 'exclusionFromRmd', value: 111 },
            { ownerId: 'p1', target: 'ordinaryFromRmd', value: 22 },
          ],
        }],
      }
    },
  }
})

import type { Account } from '../model/plan.js'
import { asUsdCents } from '../actions/money.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

function duplicateIra(balance: number, basis: number): Account {
  const account = traditionalAccount('shared-ira', balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    nondeductibleBasis: basis,
  }
}

describe('simulatePlan delegates grouped legacy QCD owner character', () => {
  it('passes one logical owner aggregate and applies every hostile row field', () => {
    seam.inputs.length = 0
    seam.returnedProRata.length = 0
    seam.splitInputs.length = 0
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 90 })
    plan.accounts = [
      duplicateIra(265_000, 53_000),
      duplicateIra(53_000, 0),
      cashAccount('cash', 100_000),
    ]
    plan.strategies.qcdAnnual = 5_000
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [],
      sepSimpleActivities: [],
      deductibleIraContributions: [{
        donorPersonId: 'p1',
        taxYear: 2025,
        amountCents: asUsdCents(100_000),
        evidenceId: 'delegation-section-219',
        provenance: { source: 'manual' },
      }],
    }

    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(10),
      captureAnnualCashFlow: true,
    })
    const year = result.years[0]!

    expect(seam.inputs.length).toBeGreaterThan(0)
    for (const input of seam.inputs) {
      expect([...input.preDistributionAggregateIraBalance]).toEqual([
        ['p1', 318_000],
      ])
      // The earlier annuity/RMD staging has already returned its positional
      // share of basis; the QCD seam still receives one owner aggregate, not
      // one entry per compatible physical row.
      expect([...input.iraBasisByOwner]).toEqual([['p1', 51_814.7]])
      expect([...input.qcdGrossByOwner]).toEqual([['p1', 5_000]])
      expect([...input.qcdFromRmdByOwner]).toEqual([['p1', 5_000]])
      expect([...input.qcdSection219ByDonor]).toEqual([['p1', 1_000]])
    }
    expect(year.qcd).toBe(5_000)
    expect(year.rmd).toBe(12_000)
    // $1,185.30 of basis was returned by the already-settled earlier staging;
    // the hostile deltas must then apply left-to-right at this seam.
    expect(year.magi).toBe(year.rmd - 1_185.3 - 123 + 45)
    expect(year.tax).toBe(year.magi * 0.1)
    expect(year.cashFlow?.transferLines.find(
      (line) => line.id === 'transfer:qualifiedCharitableDistribution:rmd:p1',
    )).toMatchObject({
      taxCharacter: [
        { kind: 'qcdIncomeExclusion', amountPlanDollars: 111 },
        { kind: 'nonQualifiedQcdOrdinaryIncome', amountPlanDollars: 22 },
      ],
    })
    expect(seam.returnedProRata.some(
      (write) => seam.splitInputs.some((input) => input === write),
    )).toBe(true)
  })
})
