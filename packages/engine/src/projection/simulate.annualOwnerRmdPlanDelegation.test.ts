/**
 * Hostile delegation and annual-pass rollback guard for owner RMD planning.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import { rmdApplicablePlanKey, rmdShortfallObligationId } from '../rmd/rmdShortfallExcise.js'
import type {
  AnnualOwnerRmdPlanInput,
  AnnualOwnerRmdPlanResult,
} from './internal/annualOwnerRmdPlan.js'

const hostile = vi.hoisted(() => ({
  downstreamOperationChecks: [] as Array<Readonly<{
    year: number
    applicablePlanKey: string
    observedExactSetValue: boolean
    observedDeletedValue: boolean
  }>>,
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualOwnerRmdPlanInput,
      AnnualOwnerRmdPlanResult,
      readonly (readonly [string, unknown])[]
    >(),
)

vi.mock('./internal/annualOwnerRmdPlan.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/annualOwnerRmdPlan.js')>(),
    'annualOwnerRmdPlan',
    (_natural, { input }): AnnualOwnerRmdPlanResult => {
      const ordinal = input.year - 2026
      const applicablePlan = { kind: 'employerPlan' as const, accountId: 'employer-rmd' }
      const applicablePlanKey = rmdApplicablePlanKey(applicablePlan)
      const take = 5_000 + ordinal * 1_000
      const required = take + 2_000
      const deferredValue = {
        applicablePlan,
        distributionCalendarYear: 2026,
        dueYear: 2027,
        requiredAmount: 123_456,
      }
      const hostileTake = {
        valueOf: () => {
          const observed = input.deferredFirstRmdByApplicablePlan.get(applicablePlanKey)
          const operationCheck = {
            year: input.year,
            applicablePlanKey,
            observedExactSetValue: observed === deferredValue,
            observedDeletedValue: observed === undefined,
          }
          hostile.downstreamOperationChecks.push(operationCheck)
          if (
            (input.year === 2026 && !operationCheck.observedExactSetValue) ||
            (input.year === 2027 && !operationCheck.observedDeletedValue)
          ) {
            throw new Error('simulatePlan consumed owner-RMD rows before applying ordered deferral operations')
          }
          return take
        },
      } as unknown as number
      const rmdTakeByAccount = new Map([['employer-rmd', hostileTake]])
      const injected: AnnualOwnerRmdPlanResult = {
        rmdTakeByAccount,
        rmdObligationByAccount: new Map([['employer-rmd', required]]),
        applicablePlanByKey: new Map([[applicablePlanKey, applicablePlan]]),
        iraRmdRequiredByOwner: new Map(),
        iraRmdUnsatisfiedByOwner: new Map(),
        rmdShortfallObligations: [{
          obligationId: rmdShortfallObligationId(applicablePlan, input.year),
          distributionCalendarYear: input.year,
          taxYear: input.year,
          taxImposedOn: `${input.year}-12-31`,
          applicablePlan,
          requirementKind: 'ownedAnnual',
          requiredAmount: required,
          distributedByDeadline: take,
        }],
        deferredFirstRmdOperations: input.year === 2026
          ? [
              { kind: 'delete', applicablePlanKey },
              { kind: 'set', applicablePlanKey, value: deferredValue },
            ]
          : [{ kind: 'delete', applicablePlanKey }],
      }
      return injected
    },
    {
      capture: (input) => [...input.deferredFirstRmdByApplicablePlan],
    },
  ),
)

import type { Account } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { cashAccount, singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import {
  simulatePlan,
  type SimulateAnnualCounterfactualRequest,
} from './simulate.js'

function employerAccount(): Account {
  const account = traditionalAccount('employer-rmd', 100_000)
  if (account.type !== 'traditional') throw new Error('fixture did not create traditional account')
  return {
    ...account,
    kind: 'employer',
    employerPlanType: '401k',
  }
}

function run() {
  seam.reset()
  hostile.downstreamOperationChecks.length = 0
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  plan.accounts = [employerAccount(), cashAccount('cash', 100_000)]
  const counterfactualReads: unknown[] = []
  const annualCounterfactual: SimulateAnnualCounterfactualRequest = {
    omitActionIds: [],
    taxUnitId: 'owner-rmd-delegation-tax-unit',
    nonGroupTaxInputs: [{
      inputId: 'federalFilingStatus',
      value: { representation: 'declaredTerm', term: 'single' },
    }],
    capture: (reading) => {
      counterfactualReads.push(reading)
    },
  }
  const result = simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2027,
    taxCalculator: createFlatTaxCalculator(10),
    captureAnnualCashFlow: true,
    annualCounterfactual,
  })
  return {
    result,
    phases: [...seam.calls],
    downstreamOperationChecks: [...hostile.downstreamOperationChecks],
    counterfactualReads,
  }
}

describe('simulatePlan delegates annual owner-RMD planning', () => {
  it('consumes hostile rows downstream and rolls deferral effects back between retries', () => {
    const { result, phases, downstreamOperationChecks, counterfactualReads } = run()
    const key = rmdApplicablePlanKey({ kind: 'employerPlan', accountId: 'employer-rmd' })
    const calls2026 = phases.filter((phase) => phase.input.year === 2026)
    const calls2027 = phases.filter((phase) => phase.input.year === 2027)

    expect(calls2026.length).toBeGreaterThan(1)
    expect(calls2027.length).toBeGreaterThan(1)
    expect(downstreamOperationChecks.length).toBeGreaterThanOrEqual(phases.length)
    expect(downstreamOperationChecks.filter((check) => check.year === 2026))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        applicablePlanKey: key,
        observedExactSetValue: true,
        observedDeletedValue: false,
      })]))
    expect(downstreamOperationChecks.filter((check) => check.year === 2027))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        applicablePlanKey: key,
        observedExactSetValue: false,
        observedDeletedValue: true,
      })]))
    expect(counterfactualReads).toHaveLength(2)
    for (const phase of calls2026) expect(phase.captured).toEqual([])
    for (const phase of calls2027) {
      expect(phase.captured).toEqual([[key, {
        applicablePlan: { kind: 'employerPlan', accountId: 'employer-rmd' },
        distributionCalendarYear: 2026,
        dueYear: 2027,
        requiredAmount: 123_456,
      }]])
    }

    for (let ordinal = 0; ordinal < result.years.length; ordinal++) {
      const year = result.years[ordinal]!
      const take = 5_000 + ordinal * 1_000
      expect(year.rmd).toBe(take)
      expect(year.balances['employer-rmd']).toBe(100_000 - (ordinal === 0 ? 5_000 : 11_000))
      expect(year.tax).toBe(take * 0.1)
      expect(year.rmdShortfallExciseTax).toBe(500)
      expect(year.rmdShortfallExciseDetails).toEqual([expect.objectContaining({
        requiredAmount: take + 2_000,
        distributedByDeadline: take,
        shortfall: 2_000,
        tax: 500,
      })])
      expect(year.cashFlow!.sourceLines).toContainEqual(expect.objectContaining({
        id: 'source:requiredMinimumDistribution:account:employer-rmd',
        kind: 'requiredMinimumDistribution',
        amountPlanDollars: take,
      }))
      expect(year.retirementRuntimeSource?.runtimeOccurrences).toContainEqual(
        expect.objectContaining({
          kind: 'employerPlanRmd',
          grossAmountPlanDollars: take,
          sourceAccountId: 'employer-rmd',
        }),
      )
    }
    expect(result.years[1]!.retirementRuntimeSource?.runtimeOccurrences).not.toBe(
      result.years[0]!.retirementRuntimeSource?.runtimeOccurrences,
    )
    expect(result.warnings).toContain(
      'An IRC §4974 excise tax was charged on a required-minimum-distribution shortfall.',
    )
  })
})
