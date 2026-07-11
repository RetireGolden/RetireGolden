/**
 * Survivor-transition analysis (survivor-widowhood-and-irmaa-relief, step 2).
 *
 * The acceptance bar: every number the view shows must agree EXACTLY with
 * running the equivalent scenario by hand — the same simulatePlan call with the
 * same death-age override, the same SSA-44 field flip, the same conversion
 * patch through applyScenarioPatch.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { summarizeProjection } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import { createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { buildSurvivorAnalysis, candidateDeathAges, conversionLeverPatch } from './survivorAnalysis'

let counter = 0
const testIds = () => `surv-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function couplePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: 'p1', name: 'Pat', dob: '1958-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    { id: 'p2', name: 'Sam', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } },
  ]
  plan.expenses.baseAnnual = 60_000
  plan.assumptions.recentAnnualMagi = 160_000
  const trad: Account = { type: 'traditional', id: testIds(), name: '401k', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 900_000, annualContribution: 0 }
  const roth: Account = { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 }
  const cash: Account = { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 800_000, annualContribution: 0 }
  // A single-life pension keeps joint-year MAGI over the single-filer IRMAA
  // threshold and dies with Pat — the classic survivor income cliff.
  const pension: Account = { type: 'pension', id: testIds(), name: 'Pension', ownerPersonId: 'p1', annualReturnPct: null, startAge: 65, monthlyAmount: 11_000, colaPct: 0, survivorPct: 0 }
  plan.accounts = [trad, roth, cash, pension]
  return plan
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }

describe('buildSurvivorAnalysis', () => {
  it('is ineligible (and empty) for single-adult plans', () => {
    const single = validate(createEmptyPlan({ newId: testIds, now: fixedNow }))
    const analysis = buildSurvivorAnalysis(single, opts)
    expect(analysis.eligible).toBe(false)
    expect(analysis.rows).toEqual([])
  })

  it('sweeps only plausible first-death timings for each spouse', () => {
    const plan = validate(couplePlan())
    // Pat is 68 in 2026, planning to 90 → grid ages 70..85 qualify (90 = as planned).
    expect(candidateDeathAges(plan, 'p1', 2026, [70, 75, 80, 85, 90])).toEqual([70, 75, 80, 85])
    const analysis = buildSurvivorAnalysis(plan, opts)
    expect(analysis.eligible).toBe(true)
    const p1Rows = analysis.rows.filter((r) => r.deceasedPersonId === 'p1')
    expect(p1Rows.map((r) => r.deathAge)).toEqual([70, 75, 80, 85])
    expect(p1Rows.map((r) => r.deathYear)).toEqual([2028, 2033, 2038, 2043])
  })

  it('includes the current attained age in the sweep grid', () => {
    // A 72-year-old (born 1954) planning to 90: the 70 rung is in the past,
    // 75–85 qualify, 90 is the plan itself.
    const older = couplePlan()
    older.household.people[0]!.dob = '1954-06-15'
    expect(candidateDeathAges(validate(older), 'p1', 2026, [70, 75, 80, 85, 90])).toEqual([75, 80, 85])
    // Someone exactly on a grid age keeps it — dying at the end of this year
    // is a valid earlier-than-planned timing.
    const at70 = couplePlan()
    at70.household.people[0]!.dob = '1956-06-15' // 70 in 2026
    expect(candidateDeathAges(validate(at70), 'p1', 2026, [70, 75, 80, 85, 90])).toEqual([70, 75, 80, 85])
  })

  it('agrees exactly with running the equivalent scenarios by hand', () => {
    const plan = validate(couplePlan())
    const analysis = buildSurvivorAnalysis(plan, opts)
    const row = analysis.rows.find((r) => r.deceasedPersonId === 'p1' && r.deathAge === 75)!
    const overrides = { ...opts, deathAgeByPersonId: { p1: 75 } }

    // Base facts come from the plan itself under the death override.
    const manualBase = simulatePlan(plan, overrides)
    const manualSummary = summarizeProjection(plan, manualBase)
    expect(row.baseEndingAfterTaxEstate).toBe(manualSummary.endingAfterTaxEstate)
    expect(row.baseLifetimeTax).toBe(manualSummary.lifetimeTaxesAndPenalties)
    const lastJoint = manualBase.years.find((y) => y.year === 2033)!
    const firstSurvivor = manualBase.years.find((y) => y.year === 2034)!
    expect(row.lastJointYear).toEqual({ year: 2033, magi: lastJoint.magi, tax: lastJoint.tax, filingStatus: lastJoint.filingStatus })
    expect(row.firstSurvivorYear.tax).toBe(firstSurvivor.tax)
    expect(row.ssBeforeDeath).toBe(lastJoint.incomes.socialSecurity)
    expect(row.ssAfterDeath).toBe(firstSurvivor.incomes.socialSecurity)

    // IRMAA columns come from two otherwise-identical runs with the SSA-44
    // survivor toggle flipped.
    const mk = (on: boolean): Plan => {
      const p = structuredClone(plan)
      p.expenses.healthcare.ssa44 = { survivorYears: on, retirementYears: false }
      return p
    }
    const withOff = simulatePlan(validate(mk(false)), overrides)
    const withOn = simulatePlan(validate(mk(true)), overrides)
    for (const irmaaYear of row.irmaaYears) {
      expect(irmaaYear.premiumsWithoutSsa44).toBe(withOff.years.find((y) => y.year === irmaaYear.year)!.medicarePremiums)
      expect(irmaaYear.premiumsWithSsa44).toBe(withOn.years.find((y) => y.year === irmaaYear.year)!.medicarePremiums)
    }
    // Relief never charges more.
    expect(row.ssa44PremiumSavings).toBeGreaterThanOrEqual(0)
    // This fixture's recent MAGI keeps the joint years over the single-filer
    // tier-1 threshold, so this timing has genuine relief to show.
    expect(row.ssa44PremiumSavings).toBeGreaterThan(0)

    // The conversion lever is the detector's fill-the-12%-bracket patch,
    // applied through the ordinary scenario machinery on the same timing.
    const patched = applyScenarioPatch(plan, conversionLeverPatch(2026, 2033))
    expect(patched.ok).toBe(true)
    if (patched.ok) {
      const leverSummary = summarizeProjection(patched.plan, simulatePlan(patched.plan, overrides))
      expect(row.conversionLever).not.toBeNull()
      expect(row.conversionLever!.endingAfterTaxEstate).toBe(leverSummary.endingAfterTaxEstate)
      expect(row.conversionLever!.estateDelta).toBe(leverSummary.endingAfterTaxEstate - manualSummary.endingAfterTaxEstate)
    }
  })
})
