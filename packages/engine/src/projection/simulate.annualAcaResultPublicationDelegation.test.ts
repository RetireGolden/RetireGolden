/** Hostile delegation proof for annual ACA result publication. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualAcaResultPublicationInput,
  AnnualAcaResultPublicationResult,
} from './internal/annualAcaResultPublication.js'

interface PublicationCall {
  readonly input: AnnualAcaResultPublicationInput
  readonly original: AnnualAcaResultPublicationResult
  readonly output: AnnualAcaResultPublicationResult
}

const INJECTED_WARNING = 'Injected ACA publication warning.'
const INJECTED_MAGI = 11_111
const INJECTED_FPL = 99_999
const INJECTED_PTC = 321

const seam = vi.hoisted(() => ({
  inject: false,
  calls: [] as PublicationCall[],
}))

vi.mock('./internal/annualAcaResultPublication.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualAcaResultPublication.js')
  >()
  return {
    ...original,
    annualAcaResultPublication: (input: AnnualAcaResultPublicationInput) => {
      const production = original.annualAcaResultPublication(input)
      const output: AnnualAcaResultPublicationResult =
        seam.inject && production.yearAcaResult !== undefined
          ? {
              yearAcaResult: {
                ...production.yearAcaResult,
                readiness: 'actionable',
                householdMagi: INJECTED_MAGI,
                federalPovertyLine: INJECTED_FPL,
                modeledAllowablePtc: INJECTED_PTC,
                cliffState: 'at-cliff',
              },
              warnings: [...production.warnings, INJECTED_WARNING],
            }
          : production
      seam.calls.push({ input, original: production, output })
      return output
    },
  }
})

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
  seam.inject = inject
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
  seam.inject = false
  seam.calls.length = 0
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

    expect(seam.calls).toHaveLength(1)
    const call = seam.calls[0]!
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
    expect(call.output).toBe(call.original)
    expect(year.aca).toBe(call.original.yearAcaResult)
  })

  it('publishes hostile ACA output and forwards its exact fields to the optimizer probe', () => {
    const { result, year, probes } = run(true)

    expect(seam.calls).toHaveLength(1)
    const call = seam.calls[0]!
    expect(call.output).not.toBe(call.original)
    expect(year.aca).toBe(call.output.yearAcaResult)
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
