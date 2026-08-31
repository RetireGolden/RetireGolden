/**
 * Delegation guard for the annual insurance-premium extraction.
 *
 * Projection equivalence alone cannot distinguish a real extraction from an
 * unused helper beside the old inline loop. These tests observe the call and
 * inject rows the plan cannot produce, proving ordered folding, occurrence
 * cardinality, and record-object forwarding at the caller boundary.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedPolicyPremium } from './annualCashFlowYearSites.js'
import type {
  AnnualInsurancePremiumRow,
  AnnualInsurancePremiumRowsInput,
} from './internal/annualInsurancePremiumRows.js'

interface PremiumPhase {
  readonly year: number
  readonly ordinal: number
  readonly input: AnnualInsurancePremiumRowsInput
  readonly rows: readonly AnnualInsurancePremiumRow[]
  readonly originalRows: readonly AnnualInsurancePremiumRow[]
}

const seam = vi.hoisted(() => ({
  phases: [] as PremiumPhase[],
  recorded: [] as RecordedPolicyPremium[],
  replacementMode: null as 'fold' | 'record' | null,
}))

vi.mock('./internal/annualInsurancePremiumRows.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualInsurancePremiumRows.js')>()
  return {
    ...original,
    annualInsurancePremiumRows: (
      input: Parameters<typeof original.annualInsurancePremiumRows>[0],
    ) => {
      const originalRows = original.annualInsurancePremiumRows(input)
      const ordinal = seam.phases.length
      const year = 1962 + input.resolveSubject('p2').ageAttained
      const rows = seam.replacementMode === null
        ? originalRows
        : originalRows.map((originalRow, index): AnnualInsurancePremiumRow => {
            const amount = seam.replacementMode === 'fold'
              ? originalRows.length === 3
                ? [10_000_000_000_000_000, -10_000_000_000_000_000, ordinal + 1][index]!
                : [1_000 + ordinal, 2_000 + ordinal][index]!
              : (year - 2025) * 100 + ordinal * 10 + index + 1
            return {
              amount,
              record: {
                policyId: `${seam.replacementMode}-${year}-${ordinal}-${index}`,
                subjectPersonId: originalRow.record.subjectPersonId,
                amount: seam.replacementMode === 'record' ? amount + 10_000 : amount,
              },
            }
          })
      seam.phases.push({ year, ordinal, input, rows, originalRows })
      return rows
    },
  }
})

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
              seam.recorded.push(row)
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

function run(options: {
  readonly replacementMode?: 'fold' | 'record'
  readonly capture?: boolean
} = {}) {
  seam.phases.length = 0
  seam.recorded.length = 0
  seam.replacementMode = options.replacementMode ?? null
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
  return seam.phases.filter((phase) => phase.year === year)
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
      expect(phase.originalRows.map(({ record }) => record.policyId)).toEqual([
        'life',
        'care',
        'life-2',
      ])
      expect(phase.originalRows.map(({ record }) => record.subjectPersonId)).toEqual([
        'p1',
        'p2',
        'p1',
      ])
    }
    for (const phase of phasesFor(YEAR + 1)) {
      expect(phase.input.policies).toBe(input.insurance)
      expect(phase.originalRows.map(({ record }) => record.policyId)).toEqual([
        'life',
        'life-2',
      ])
      expect(phase.originalRows.map(({ record }) => record.subjectPersonId)).toEqual([
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
    const allRows = seam.phases.flatMap((phase) => phase.rows)
    const allRecords = allRows.map((premium) => premium.record)

    expect(new Set(seam.phases.map((phase) => phase.rows)).size).toBe(seam.phases.length)
    expect(new Set(allRows).size).toBe(allRows.length)
    expect(new Set(allRecords).size).toBe(allRecords.length)
    for (const phase of seam.phases) {
      expect(phase.rows.map(({ record }) => record.policyId)).toEqual(
        phase.rows.map((_, index) => `fold-${phase.year}-${phase.ordinal}-${index}`),
      )
      expect(phase.rows).not.toBe(phase.originalRows)
    }

    const final2026 = lastPhaseFor(YEAR)
    const final2027 = lastPhaseFor(YEAR + 1)
    expect(final2026.rows).toHaveLength(3)
    expect(final2027.rows).toHaveLength(2)
    expect(result.years[0]!.expenses.insurancePremiums).toBe(fold(final2026.rows))
    expect(result.years[1]!.expenses.insurancePremiums).toBe(fold(final2027.rows))
    expect(fold(final2026.rows)).not.toBe(fold(final2027.rows))
    // Omitting the final occurrence would produce zero, so the assertion above
    // is also an explicit underproduction guard rather than only a sum check.
    expect(fold(final2026.rows.slice(0, -1))).toBe(0)
    expect(fold(final2026.rows)).toBe(final2026.rows.at(-1)!.amount)
  })

  it('records every injected occurrence in order using each row record by identity', () => {
    const { result } = run({ replacementMode: 'record', capture: true })
    const expectedRecords = seam.phases.flatMap((phase) =>
      phase.rows.map((premium) => premium.record))

    expect(seam.recorded).toHaveLength(expectedRecords.length)
    for (let index = 0; index < expectedRecords.length; index += 1) {
      expect(seam.recorded[index]).toBe(expectedRecords[index])
    }

    for (const yearResult of result.years) {
      const finalPhase = lastPhaseFor(yearResult.year)
      expect(yearResult.expenses.insurancePremiums).toBe(fold(finalPhase.rows))
      const lines = (yearResult.cashFlow?.useLines ?? []).filter(
        (line) => line.kind === 'insurancePremium',
      )
      expect(lines).toHaveLength(finalPhase.rows.length)
      expect(lines.map((line) => ({
        requested: line.requestedPlanDollars,
        policy: line.identities[0],
      }))).toEqual(expect.arrayContaining(finalPhase.rows.map((premium) => ({
        requested: premium.record.amount,
        policy: {
          entityKind: 'insurancePolicy',
          policyId: premium.record.policyId,
        },
      }))))
    }
  })
})
