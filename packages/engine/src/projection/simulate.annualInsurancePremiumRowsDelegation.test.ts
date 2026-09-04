/**
 * Delegation guard for the annual insurance-premium extraction.
 *
 * Projection equivalence alone cannot distinguish a real extraction from an
 * unused helper beside the old inline loop. These tests observe the call and
 * inject rows the plan cannot produce, proving ordered folding, occurrence
 * cardinality, and record-object forwarding at the caller boundary.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedPolicyPremium } from './annualCashFlowYearSites.js'
import type {
  AnnualInsurancePremiumRow,
  AnnualInsurancePremiumRowsInput,
} from './internal/annualInsurancePremiumRows.js'

const hostile = vi.hoisted(() => ({
  recorded: [] as RecordedPolicyPremium[],
  replacementMode: null as 'fold' | 'record' | null,
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualInsurancePremiumRowsInput,
      readonly AnnualInsurancePremiumRow[],
      number
    >(),
)

vi.mock('./internal/annualInsurancePremiumRows.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualInsurancePremiumRows.js')
    >(),
    'annualInsurancePremiumRows',
    (
      originalRows,
      { input, ordinal },
    ): readonly AnnualInsurancePremiumRow[] => {
      const year = 1962 + input.resolveSubject('p2').ageAttained
      return hostile.replacementMode === null
        ? originalRows
        : originalRows.map((originalRow, index): AnnualInsurancePremiumRow => {
            const amount = hostile.replacementMode === 'fold'
              ? originalRows.length === 3
                ? [10_000_000_000_000_000, -10_000_000_000_000_000, ordinal + 1][index]!
                : [1_000 + ordinal, 2_000 + ordinal][index]!
              : (year - 2025) * 100 + ordinal * 10 + index + 1
            return {
              amount,
              record: {
                policyId: `${hostile.replacementMode}-${year}-${ordinal}-${index}`,
                subjectPersonId: originalRow.record.subjectPersonId,
                amount: hostile.replacementMode === 'record'
                  ? amount + 10_000
                  : amount,
              },
            }
          })
    },
    { capture: (input) => 1962 + input.resolveSubject('p2').ageAttained },
  ),
)

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordInsurancePremium') {
            return (row: RecordedPolicyPremium) => {
              hostile.recorded.push(row)
              target.recordInsurancePremium(row)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function'
            ? (value as (...args: never[]) => unknown).bind(target)
            : value
        },
      })
    },
  }
})

import type { SeamCall } from './simulate.seamGuard.test-support.js'
import {
  expectDistinctInjections,
  expectPublishedFromSeam,
} from './simulate.seamGuard.test-support.js'
import type { InsurancePolicy, Plan } from '../model/plan.js'
import { couplePlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const YEAR = 2026
const zeroTax: TaxCalculator = { compute: () => 0 }

const permanentLife = (
  id: string,
  overrides: Partial<Extract<InsurancePolicy, { kind: 'permanentLife' }>> = {},
): Extract<InsurancePolicy, { kind: 'permanentLife' }> => ({
  kind: 'permanentLife',
  id,
  name: id,
  insured: 'p1',
  beneficiary: 'estate',
  annualPremium: 11,
  premiumMode: 'lifetime',
  deathBenefit: 100_000,
  cashValue: 0,
  cashValueMode: 'flatRate',
  ...overrides,
})

const longTermCare = (
  id: string,
  overrides: Partial<Extract<InsurancePolicy, { kind: 'ltc' }>> = {},
): Extract<InsurancePolicy, { kind: 'ltc' }> => ({
  kind: 'ltc',
  id,
  name: id,
  owner: 'p2',
  annualPremium: 13,
  premiumMode: 'untilAge',
  premiumEndAge: 65,
  benefitMonthly: 5_000,
  benefitPeriodYears: 3,
  eliminationPeriodDays: 90,
  ...overrides,
})

function plan(): Plan {
  const value = couplePlan({
    p1Dob: '1962-01-01',
    p2Dob: '1962-01-01',
    p1PlanningAge: 90,
    p2PlanningAge: 90,
  })
  value.insurance = [
    permanentLife('life'),
    longTermCare('care'),
    permanentLife('life-2', { annualPremium: 17 }),
    permanentLife('paid', { annualPremium: 19, premiumMode: 'paidUp' }),
  ]
  return validatePlan(value)
}

type PremiumPhase = SeamCall<
  AnnualInsurancePremiumRowsInput,
  readonly AnnualInsurancePremiumRow[],
  number
>

function run(options: {
  readonly replacementMode?: 'fold' | 'record'
  readonly capture?: boolean
} = {}) {
  seam.reset()
  hostile.recorded.length = 0
  hostile.replacementMode = options.replacementMode ?? null
  const input = plan()
  const result = simulatePlan(input, {
    startYear: YEAR,
    horizonEndYear: YEAR + 1,
    taxCalculator: zeroTax,
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
  })
  return { input, result }
}

function phasesFor(year: number): readonly PremiumPhase[] {
  return seam.calls.filter((phase) => phase.captured === year)
}

function lastPhaseFor(year: number): PremiumPhase {
  const phase = phasesFor(year).at(-1)
  if (phase === undefined) throw new Error(`missing premium phase for ${year}`)
  return phase
}

function fold(rows: readonly AnnualInsurancePremiumRow[]): number {
  let total = 0
  for (const premium of rows) total += premium.amount
  return total
}

describe('simulatePlan delegates annual insurance premiums', () => {
  it('passes plan insurance and uses the helper eligibility result', () => {
    const { input, result } = run()

    expect(phasesFor(YEAR).length).toBeGreaterThan(0)
    expect(phasesFor(YEAR + 1).length).toBeGreaterThan(0)
    for (const phase of phasesFor(YEAR)) {
      expect(phase.input.policies).toBe(input.insurance)
      expect(phase.natural.map(({ record }) => record.policyId)).toEqual([
        'life',
        'care',
        'life-2',
      ])
      expect(phase.natural.map(({ record }) => record.subjectPersonId)).toEqual([
        'p1',
        'p2',
        'p1',
      ])
    }
    for (const phase of phasesFor(YEAR + 1)) {
      expect(phase.input.policies).toBe(input.insurance)
      expect(phase.natural.map(({ record }) => record.policyId)).toEqual([
        'life',
        'life-2',
      ])
      expect(phase.natural.map(({ record }) => record.subjectPersonId)).toEqual([
        'p1',
        'p1',
      ])
    }
    expect(result.years.map(({ year, expenses }) => ({
      year,
      premiums: expenses.insurancePremiums,
    }))).toEqual([
      { year: YEAR, premiums: 41 },
      { year: YEAR + 1, premiums: 28 },
    ])
  })

  it('consumes each call\'s fresh year-specific rows and folds every occurrence left-to-right', () => {
    const { result } = run({ replacementMode: 'fold' })
    const allRows = seam.calls.flatMap((phase) => phase.injected)
    const allRecords = allRows.map((premium) => premium.record)

    expectDistinctInjections(seam)
    expect(new Set(allRows).size).toBe(allRows.length)
    expect(new Set(allRecords).size).toBe(allRecords.length)
    for (const phase of seam.calls) {
      expect(phase.injected.map(({ record }) => record.policyId)).toEqual(
        phase.injected.map((_, index) =>
          `fold-${phase.captured}-${phase.ordinal}-${index}`),
      )
      expect(phase.injected).not.toBe(phase.natural)
    }

    const final2026 = lastPhaseFor(YEAR)
    const final2027 = lastPhaseFor(YEAR + 1)
    expect(final2026.injected).toHaveLength(3)
    expect(final2027.injected).toHaveLength(2)
    expect(result.years[0]!.expenses.insurancePremiums)
      .toBe(fold(final2026.injected))
    expect(result.years[1]!.expenses.insurancePremiums)
      .toBe(fold(final2027.injected))
    expect(fold(final2026.injected)).not.toBe(fold(final2027.injected))
    // Omitting the final occurrence would produce zero, so the assertion above
    // is also an explicit underproduction guard rather than only a sum check.
    expect(fold(final2026.injected.slice(0, -1))).toBe(0)
    expect(fold(final2026.injected)).toBe(final2026.injected.at(-1)!.amount)
  })

  it('records every injected occurrence in order using each row record by identity', () => {
    const { result } = run({ replacementMode: 'record', capture: true })
    const expectedRecords = seam.calls.flatMap((phase) =>
      phase.injected.map((premium) => premium.record))

    expect(hostile.recorded).toHaveLength(expectedRecords.length)
    for (let index = 0; index < expectedRecords.length; index += 1) {
      expectPublishedFromSeam(
        hostile.recorded[index],
        expectedRecords[index],
        'the recorded insurance-premium payload',
      )
    }

    for (const yearResult of result.years) {
      const finalPhase = lastPhaseFor(yearResult.year)
      expect(yearResult.expenses.insurancePremiums)
        .toBe(fold(finalPhase.injected))
      const lines = (yearResult.cashFlow?.useLines ?? []).filter(
        (line) => line.kind === 'insurancePremium',
      )
      expect(lines).toHaveLength(finalPhase.injected.length)
      expect(lines.map((line) => ({
        requested: line.requestedPlanDollars,
        policy: line.identities[0],
      }))).toEqual(expect.arrayContaining(finalPhase.injected.map((premium) => ({
        requested: premium.record.amount,
        policy: {
          entityKind: 'insurancePolicy',
          policyId: premium.record.policyId,
        },
      }))))
    }
  })
})
