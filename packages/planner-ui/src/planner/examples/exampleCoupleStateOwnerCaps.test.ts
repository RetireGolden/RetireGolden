import { describe, expect, it } from 'vitest'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { projectPlan } from '../../projection'
import { buildExampleCouple } from './buildExampleCouple'
import { EXAMPLE_FIXED_YEAR } from './buildContext'

describe('example couple state retirement deductions by owner', () => {
  it('caps Alex once across conversion and withdrawal sources and does not transfer Sam unused allowance', () => {
    // KRS141.010 retirement-income exclusion / Kentucky ScheduleP: each
    // recipient gets at most31110 of that recipient retirement income.
    // KY2026 deduction worksheet: one3360 standard deduction on the joint
    // return. Future example years use the engine explicit2026policy pack.
    const plan = buildExampleCouple()
    const { result } = projectPlan(plan, { startYear: EXAMPLE_FIXED_YEAR })
    const actual = createStateTaxCalculator()
    const withoutDeductions = createStateTaxCalculator({ mapParams: (params) => ({
      ...params,
      retirementPrivate: { kind: 'none' },
      retirementPublic: { kind: 'none' },
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
    }) })

    for (const year of [2028, 2035]) {
      const input = result.years.find((row) => row.year === year)?.acceptedTaxInput
      expect(input).toBeDefined()
      if (input === undefined) throw new Error(`Missing accepted tax input for${year}`)
      const facts = input.stateRetirementDistributions ?? []
      const alex = facts.filter((row) => row.ownerPersonId === 'example-couple--alex')
      const sam = facts.filter((row) => row.ownerPersonId === 'example-couple--sam')
      const alexIncome = alex.reduce((sum, row) => sum + row.federallyIncludedAmount, 0)
      const samIncome = sam.reduce((sum, row) => sum + row.federallyIncludedAmount, 0)
      expect(alexIncome).toBeGreaterThan(31110)
      if (year === 2028) expect(samIncome).toBe(0)
      else {
        expect(alex.length).toBeGreaterThan(1)
        expect(samIncome).toBeGreaterThan(0)
        expect(samIncome).toBeLessThan(31110)
      }
      const ownerExclusion = Math.min(31110, alexIncome) + Math.min(31110, samIncome)
      const priced = actual.computeResult(input)
      const grossBase = withoutDeductions.computeResult(input)
      expect(priced.status).toBe('complete')
      expect(grossBase.status).toBe('complete')
      if (!('taxableIncome' in priced) || typeof priced.taxableIncome !== 'number' ||
        !('taxableIncome' in grossBase) || typeof grossBase.taxableIncome !== 'number') {
        throw new Error('State calculator did not publish taxable income')
      }
      expect(priced.taxableIncome).toBeCloseTo(Math.max(0, grossBase.taxableIncome - ownerExclusion - 3360), 6)
      // The result must differ from both the transferable household cap and
      // a second allowance for each conversion/withdrawal event.
      expect(ownerExclusion).toBeLessThan(62220)
    }
  })
})
