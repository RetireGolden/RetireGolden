import { describe, expect, it } from 'vitest'

import { parsePlan } from '@retiregolden/engine/model/plan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { EXAMPLE_PLANS } from './registry'

describe('example registry', () => {
  it('every build() output passes parsePlan', () => {
    for (const example of EXAMPLE_PLANS) {
      const plan = example.build()
      const parsed = parsePlan(plan)
      expect(parsed.ok, example.id).toBe(true)
    }
  })

  it('build() is deterministic', () => {
    for (const example of EXAMPLE_PLANS) {
      const a = example.build()
      const b = example.build()
      expect(a, example.id).toEqual(b)
    }
  })

  it('credit-enabled curated examples carry explicit ACA year contracts', () => {
    for (const example of EXAMPLE_PLANS) {
      const plan = example.build()
      if (!plan.expenses.healthcare.applyAcaCredit) continue
      expect(plan.expenses.healthcare.acaYears?.length, example.id).toBeGreaterThan(0)
    }
  })

  it('fails a stale example contract closed to the edited visible gross premium', () => {
    const example = EXAMPLE_PLANS.find((candidate) => candidate.id === 'early-retiree-aca')!
    const plan = example.build()
    plan.exampleSourceId = example.id
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 2_000
    const year = simulatePlan(plan, {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('example-contract-input-mismatch')
    expect(year.aca?.grossEnrollmentPremium).toBe(24_000)
    expect(year.expenses.healthcare).toBe(24_000)
  })

  it('every learnSlug is unique', () => {
    const slugs = EXAMPLE_PLANS.map((e) => e.learnSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
