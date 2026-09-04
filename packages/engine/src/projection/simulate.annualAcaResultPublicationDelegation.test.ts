/**
 * Hostile delegation proof for annual ACA result publication.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualAcaResultPublicationInput,
  AnnualAcaResultPublicationResult,
} from './internal/annualAcaResultPublication.js'

const INJECTED_WARNING = 'Injected ACA publication warning.'
const INJECTED_MAGI = 11_111
const INJECTED_FPL = 99_999
const INJECTED_PTC = 321

const hostile = vi.hoisted(() => ({ inject: false }))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualAcaResultPublicationInput,
      AnnualAcaResultPublicationResult
    >(),
)

vi.mock('./internal/annualAcaResultPublication.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualAcaResultPublication.js')
    >(),
    'annualAcaResultPublication',
    (natural): AnnualAcaResultPublicationResult =>
      hostile.inject && natural.yearAcaResult !== undefined
        ? {
            yearAcaResult: {
              ...natural.yearAcaResult,
              readiness: 'actionable',
              householdMagi: INJECTED_MAGI,
              federalPovertyLine: INJECTED_FPL,
              modeledAllowablePtc: INJECTED_PTC,
              cliffState: 'at-cliff',
            },
            warnings: [...natural.warnings, INJECTED_WARNING],
          }
        : natural,
  ),
)

import {
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import {
  cashAccount,
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import type { OptimizerYearProbe } from './types.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026

function acaPlan() {
  const plan = singlePersonPlan({ dob: '1990-01-01', planningAge: 60 })
  plan.accounts = [cashAccount('cash', 200_000)]
  setAcaYearContract(plan, {
    year: YEAR,
    monthlyEnrollment: 1_000,
    monthlySlcsp: 1_100,
  })
  return validatePlan(plan)
}

function run(inject: boolean) {
  hostile.inject = inject
  const plan = acaPlan()
  const probes: OptimizerYearProbe[] = []
  const result = simulatePlan(plan, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: { compute: () => 0 },
    captureOptimizerInputs: (probe) => probes.push(probe),
  })
  return { plan, result, year: result.years[0]!, probes }
}

beforeEach(() => {
  hostile.inject = false
  seam.reset()
})

describe('simulatePlan delegates annual ACA result publication', () => {
  it('retains the inactive-year gate outside the coordinator', () => {
    const plan = singlePersonPlan({ dob: '1990-01-01', planningAge: 60 })
    plan.accounts = [cashAccount('cash', 200_000)]
    const result = simulatePlan(validatePlan(plan), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: { compute: () => 0 },
    })

    expect(seam.calls).toEqual([])
    expect(result.years[0]?.aca).toBeUndefined()
  })

  it('passes detached frozen annual evidence and publishes the original result by identity', () => {
    const { plan, year } = run(false)

    const call = expectSeamRan(seam, 1)[0]!
    expect(Object.isFrozen(call.input)).toBe(true)
    expect(Object.isFrozen(call.input.evaluation)).toBe(true)
    expect(Object.isFrozen(call.input.evaluation.acaSupportCodes)).toBe(true)
    expect(Object.isFrozen(call.input.evaluation.acaQuote)).toBe(true)
    expect(Object.isFrozen(call.input.evaluation.acaMagiProbe)).toBe(true)
    expect(Object.isFrozen(call.input.evaluation.acaMagiProbe?.components)).toBe(true)
    expect(Object.isFrozen(call.input.evaluation.acaMagiProbe?.dependents)).toBe(true)
    expect(Object.isFrozen(call.input.contract)).toBe(true)
    expect(Object.isFrozen(call.input.contract?.taxFamilyMembers)).toBe(true)
    expect(Object.isFrozen(call.input.contract?.coveredMembers)).toBe(true)
    expect(Object.isFrozen(
      call.input.contract?.coveredMembers[0]?.enrollmentPremiumByMonth,
    )).toBe(true)
    expect(Object.isFrozen(
      call.input.contract?.coveredMembers[0]?.slcspBenchmarkPremiumByMonth,
    )).toBe(true)
    expect(Object.isFrozen(call.input.people)).toBe(true)
    expect(Object.isFrozen(call.input.marketplaceMonthsByPersonPosition)).toBe(true)
    expect(Object.isFrozen(call.input.slcspBenchmarkPremiums)).toBe(true)

    const sourceContract = plan.expenses.healthcare.acaYears?.[0]
    expect(call.input.contract).not.toBe(sourceContract)
    expect(call.input.contract?.taxFamilyMembers).not.toBe(
      sourceContract?.taxFamilyMembers,
    )
    expect(call.input.contract?.coveredMembers[0]?.enrollmentPremiumByMonth)
      .not.toBe(sourceContract?.coveredMembers[0]?.enrollmentPremiumByMonth)
    expect(call.input.contract?.coveredMembers[0]?.slcspBenchmarkPremiumByMonth)
      .not.toBe(sourceContract?.coveredMembers[0]?.slcspBenchmarkPremiumByMonth)
    expect(call.injected).toBe(call.natural)
    expectPublishedFromSeam(year.aca, call.natural.yearAcaResult, 'the ACA year result')
  })

  it('publishes hostile ACA output and forwards its exact fields to the optimizer probe', () => {
    const { result, year, probes } = run(true)

    const call = expectSeamRan(seam, 1)[0]!
    expect(call.injected).not.toBe(call.natural)
    expectPublishedFromSeam(year.aca, call.injected.yearAcaResult, 'the ACA year result')
    expect(result.warnings).toContain(INJECTED_WARNING)
    expect(probes).toHaveLength(1)
    expect(probes[0]).toMatchObject({
      acaModeledAllowablePtc: INJECTED_PTC,
      acaCliffState: 'at-cliff',
      acaConversionMagiHeadroom: Math.max(
        0,
        INJECTED_FPL *
          (call.input.parameterPack.aca.maxFplPctForCredit / 100) -
          INJECTED_MAGI,
      ),
    })
  })
})
