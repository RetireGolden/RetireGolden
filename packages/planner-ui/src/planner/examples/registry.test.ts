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

  it('writes every example contract on the premium-field basis, storing no roster or premium', () => {
    for (const example of EXAMPLE_PLANS) {
      for (const contract of example.build().expenses.healthcare.acaYears ?? []) {
        expect(contract.premiumBasis, `${example.id} ${contract.year}`).toBe('premiumField')
        expect(Object.keys(contract).sort(), `${example.id} ${contract.year}`).toEqual(
          ['assertions', 'foreignExclusionAddback', 'premiumBasis', 'taxExemptInterest', 'year'],
        )
      }
    }
  })

  it('prices an edited premium on the example contract, whatever the provenance of the plan', () => {
    // Decision D-EXAMPLE-SOURCE-SWITCH (2026-09-28): the contract follows the
    // premium field, so a $2,000 premium is the year's enrollment premium and
    // benchmark, 12 x 2,000 = 24,000 each. Before the decision the engine
    // refused the contract (example-contract-input-mismatch) and budgeted
    // the 24,000 gross premium with no credit; `exampleSourceId` no longer
    // changes anything.
    const example = EXAMPLE_PLANS.find((candidate) => candidate.id === 'early-retiree-aca')!
    const plan = example.build()
    plan.exampleSourceId = example.id
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 2_000
    const project = (p: typeof plan) =>
      simulatePlan(p, { startYear: 2026, horizonEndYear: 2026, taxCalculator: createFederalTaxCalculator() }).years[0]!
    const year = project(plan)
    expect(year.aca?.premiumBasis).toBe('premiumField')
    expect(year.aca?.grossEnrollmentPremium).toBe(24_000)
    expect(year.aca?.applicableSlcspPremium).toBe(24_000)
    expect(year.aca?.supportCodes).not.toContain('missing-year-contract')
    const withoutSource = structuredClone(plan)
    delete withoutSource.exampleSourceId
    expect(project(withoutSource)).toStrictEqual(year)
  })

  it('every learnSlug is unique', () => {
    const slugs = EXAMPLE_PLANS.map((e) => e.learnSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
