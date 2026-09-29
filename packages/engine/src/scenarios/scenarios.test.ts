import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan, type Scenario } from '../model/plan.js'
import type { TaxCalculator } from '../projection/types.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { setAcaYearContract, statedAcaYears } from '../testing/planFixtures.js'
import { applyScenarioPatch, compareScenarios, diffScenarioPatch } from './scenarios.js'
import { createScenarioPatch } from './patch.js'

let counter = 0
const testIds = () => `sc-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function taxable(balance: number): Account {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [taxable(1_000_000)]
  return plan
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('applyScenarioPatch', () => {
  it('deep-merges nested objects and leaves the rest of the plan intact', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, { assumptions: { inflationPct: 4 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.assumptions.inflationPct).toBe(4)
    expect(r.plan.assumptions.defaultReturnPct).toBe(5) // sibling untouched
    expect(r.plan.expenses.baseAnnual).toBe(40_000)
    expect(plan.assumptions.inflationPct).toBe(2.5) // base not mutated
  })

  it('replaces arrays wholesale and merges discriminated unions by replacement', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, {
      expenses: { oneTimeGoals: [{ id: 'g1', label: 'Roof', year: 2030, amount: 30_000 }] },
      assumptions: { ssHaircut: { fromYear: 2034, cutPct: 19 } },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.expenses.oneTimeGoals).toHaveLength(1)
    expect(r.plan.assumptions.ssHaircut).toEqual({ fromYear: 2034, cutPct: 19 })
  })

  it('rejects overrides that fail schema validation', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, { assumptions: { inflationPct: 'lots' } })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.join(' ')).toContain('assumptions.inflationPct')
  })

  it('cannot change schema version, id, or the scenario list itself', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, { schemaVersion: 99, id: 'hijacked', scenarios: [{ bogus: true }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.id).toBe(plan.id)
    expect(r.plan.scenarios).toEqual(plan.scenarios)
  })

  it('keeps explicitly refreshed ACA evidence in a legacy household patch and clears stale evidence otherwise', () => {
    const plan = basePlan()
    setAcaYearContract(plan)
    const base = validate(plan)
    const refreshed = structuredClone(statedAcaYears(base))
    refreshed[0]!.coveredMembers[0]!.enrollmentPremiumByMonth = new Array<number>(12).fill(750)

    const withEvidence = applyScenarioPatch(base, {
      household: { state: 'FL' },
      expenses: { healthcare: { acaYears: refreshed } },
    })
    expect(withEvidence.ok).toBe(true)
    if (withEvidence.ok) {
      expect(withEvidence.plan.household.state).toBe('FL')
      expect(withEvidence.plan.expenses.healthcare.acaYears).toEqual(refreshed)
    }

    const withoutEvidence = applyScenarioPatch(base, { household: { state: 'FL' } })
    expect(withoutEvidence.ok).toBe(true)
    if (withoutEvidence.ok) {
      expect(withoutEvidence.plan.expenses.healthcare.acaYears).toBeUndefined()
    }
  })

  it('keeps premium-field contracts through a premium patch and clears only the stated ones', () => {
    // Decision D-EXAMPLE-SOURCE-SWITCH (2026-09-28): a premiumField contract
    // derives its premiums from the premium field on every run, so a patch to
    // the premium leaves it in place and the credit is priced on the new
    // premium; a stated contract's written premiums are stale and go. Each
    // removal is recorded with the edit and the years it removed.
    const plan = basePlan()
    setAcaYearContract(plan, { year: 2026 })
    const facts = structuredClone(statedAcaYears(plan)[0]!)
    plan.expenses.healthcare.acaYears!.push({
      year: 2027,
      premiumBasis: 'premiumField',
      taxExemptInterest: facts.taxExemptInterest,
      foreignExclusionAddback: facts.foreignExclusionAddback,
      assertions: facts.assertions,
    })
    const base = validate(plan)
    const derivedOnly = base.expenses.healthcare.acaYears!.filter((contract) => contract.premiumBasis === 'premiumField')
    expect(derivedOnly).toHaveLength(1)

    for (const patch of [
      { expenses: { healthcare: { pre65MonthlyPremiumPerPerson: 1_250 } } },
      (() => {
        const edited = structuredClone(base)
        edited.expenses.healthcare.pre65MonthlyPremiumPerPerson = 1_250
        const created = createScenarioPatch(base, edited, {
          title: 'Premium',
          createdAtIso: '2026-07-01T00:00:00.000Z',
          actor: { kind: 'user' },
        })
        if (!created.ok) throw new Error(created.issues.join('; '))
        return created.patch
      })(),
    ]) {
      const premium = applyScenarioPatch(base, patch)
      expect(premium.ok).toBe(true)
      if (premium.ok) {
        expect(premium.plan.expenses.healthcare.pre65MonthlyPremiumPerPerson).toBe(1_250)
        expect(premium.plan.expenses.healthcare.acaYears).toEqual(derivedOnly)
        expect(premium.plan.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'premiumChanged', years: [2026] }])
      }
    }

    // With only stated contracts a premium patch clears the key, as before.
    const statedOnly = basePlan()
    setAcaYearContract(statedOnly, { year: 2026 })
    const cleared = applyScenarioPatch(validate(statedOnly), { expenses: { healthcare: { pre65MonthlyPremiumPerPerson: 1_250 } } })
    expect(cleared.ok).toBe(true)
    if (cleared.ok) expect(cleared.plan.expenses.healthcare.acaYears).toBeUndefined()
  })

  it('keeps premium-field contracts through a household change, and removes every contract when who is on the return changes', () => {
    // Review finding M2: a premium-field contract derives its region, family
    // and members from the household on every run, so a move, a state, a
    // date of birth or a planning age cannot leave it stale; a person added
    // or removed, or a new filing status, can falsify its stored assertions.
    const plan = basePlan()
    setAcaYearContract(plan, { year: 2026 })
    const facts = structuredClone(statedAcaYears(plan)[0]!)
    plan.expenses.healthcare.acaYears!.push({
      year: 2027,
      premiumBasis: 'premiumField',
      taxExemptInterest: facts.taxExemptInterest,
      foreignExclusionAddback: facts.foreignExclusionAddback,
      assertions: facts.assertions,
    })
    const base = validate(plan)
    const derivedOnly = base.expenses.healthcare.acaYears!.filter((contract) => contract.premiumBasis === 'premiumField')

    for (const patch of [
      { household: { state: 'FL' } },
      { household: { people: [{ ...base.household.people[0]!, dob: '1962-06-15' }] } },
      { household: { people: [{ ...base.household.people[0]!, longevity: { planningAge: 92, source: 'manual' } }] } },
      { household: { stateMoves: [{ fromYear: 2030, fromMonth: 7, state: 'GA' }] } },
    ]) {
      const kept = applyScenarioPatch(base, patch)
      expect(kept.ok, JSON.stringify(patch)).toBe(true)
      if (!kept.ok) continue
      expect(kept.plan.expenses.healthcare.acaYears, JSON.stringify(patch)).toEqual(derivedOnly)
      expect(kept.plan.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'householdChanged', years: [2026] }])
    }

    const partner = {
      id: 'p2',
      name: 'Sam',
      dob: '1962-01-01',
      sex: 'average' as const,
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' as const },
    }
    const added = applyScenarioPatch(base, {
      household: { filingStatus: 'marriedFilingJointly', people: [base.household.people[0]!, partner] },
    })
    expect(added.ok).toBe(true)
    if (added.ok) {
      expect(added.plan.expenses.healthcare.acaYears).toBeUndefined()
      expect(added.plan.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'partnerAdded', years: [2026, 2027] }])
    }
    const couple = validate({
      ...structuredClone(base),
      household: { ...structuredClone(base.household), filingStatus: 'marriedFilingJointly', people: [base.household.people[0]!, partner] },
    })
    const removed = applyScenarioPatch(couple, { household: { filingStatus: 'single', people: [couple.household.people[0]!] } })
    expect(removed.ok).toBe(true)
    if (removed.ok) expect(removed.plan.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'partnerRemoved', years: [2026, 2027] }])
    const replaced = applyScenarioPatch(couple, {
      household: { people: [couple.household.people[0]!, { ...partner, id: 'p3', name: 'Alex' }] },
    })
    expect(replaced.ok).toBe(true)
    if (replaced.ok) {
      expect(replaced.plan.expenses.healthcare.acaYears).toBeUndefined()
      expect(replaced.plan.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'peopleChanged', years: [2026, 2027] }])
    }
    const refiled = applyScenarioPatch(couple, { household: { filingStatus: 'single' } })
    expect(refiled.ok).toBe(true)
    if (refiled.ok) {
      expect(refiled.plan.expenses.healthcare.acaYears).toBeUndefined()
      expect(refiled.plan.expenses.healthcare.acaYearsRemoved).toEqual([{ edit: 'filingStatusChanged', years: [2026, 2027] }])
    }
  })
})

describe('diffScenarioPatch', () => {
  it('lists changed leaves with base and scenario values', () => {
    const plan = validate(basePlan())
    const diff = diffScenarioPatch(plan, {
      assumptions: { inflationPct: 4, ssHaircut: { fromYear: 2034, cutPct: 19 } },
    })
    expect(diff).toContainEqual({ path: 'assumptions.inflationPct', baseValue: 2.5, scenarioValue: 4 })
    // ssHaircut is null in the base, so the whole object shows as one change.
    expect(diff.some((d) => d.path === 'assumptions.ssHaircut')).toBe(true)
    expect(diff.some((d) => d.path === 'assumptions.defaultReturnPct')).toBe(false)
  })
})

describe('compareScenarios', () => {
  const opts = { startYear: 2026, taxCalculator: noTax }

  it('runs base plus scenarios and reflects overrides in the metrics', () => {
    const plan = validate(basePlan())
    plan.scenarios = [
      { id: 's1', name: 'Spend more', patch: { expenses: { baseAnnual: 90_000 } } },
      { id: 's2', name: '19% SS cut', patch: { assumptions: { ssHaircut: { fromYear: 2034, cutPct: 19 } } } },
    ]
    const cmp = compareScenarios(plan, opts)
    expect(cmp.rows).toHaveLength(3)
    const [base, spend, cut] = cmp.rows
    expect(base!.scenarioId).toBeNull()
    expect(spend!.error).toBeNull()
    expect(spend!.summary.endingInvestable).toBeLessThan(base!.summary.endingInvestable)
    expect(cut!.diff.some((d) => d.path === 'assumptions.ssHaircut')).toBe(true)
  })

  it('reports an error row for an invalid patch without sinking the table', () => {
    const plan = validate(basePlan())
    plan.scenarios = [{ id: 'bad', name: 'Broken', patch: { household: { filingStatus: 'royalty' } } } as Scenario]
    const cmp = compareScenarios(plan, opts)
    expect(cmp.rows).toHaveLength(2)
    expect(cmp.rows[1]!.error).toContain('invalid')
    expect(cmp.rows[0]!.error).toBeNull()
  })

  it('attaches Monte Carlo success rates when requested, same seed for every row', () => {
    const plan = validate(basePlan())
    plan.scenarios = [{ id: 's1', name: 'Spend way more', patch: { expenses: { baseAnnual: 150_000 } } }]
    const cmp = compareScenarios(plan, {
      ...opts,
      monteCarlo: { model: { type: 'lognormal', inflationMeanPct: 2.5 }, pathCount: 40, seed: 7 },
    })
    expect(cmp.rows[0]!.successRate).not.toBeNull()
    expect(cmp.rows[1]!.successRate).not.toBeNull()
    expect(cmp.rows[1]!.successRate!).toBeLessThanOrEqual(cmp.rows[0]!.successRate!)
  })

  it('builds and uses a separate tax calculator for the base plan and each patched plan', () => {
    const draft = basePlan()
    draft.assumptions.inflationPct = 0
    draft.assumptions.defaultReturnPct = 0
    draft.assumptions.stateEffectiveTaxPct = 0
    draft.expenses.baseAnnual = 0
    draft.incomes = [{
      type: 'recurring',
      id: 'taxable-income',
      label: 'Taxable income',
      annualAmount: 10_000,
      startYear: 2026,
      endYear: 2026,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    }]
    draft.scenarios = [{
      id: 'ten-percent',
      name: '10% test-double rate',
      patch: { assumptions: { stateEffectiveTaxPct: 10 } },
    }]
    const plan = validate(draft)
    const createdRates: number[] = []
    const usedRates: number[] = []
    const calculators: TaxCalculator[] = []
    let sharedCalculatorCalls = 0

    const cmp = compareScenarios(plan, {
      startYear: 2026,
      taxCalculator: {
        compute() {
          sharedCalculatorCalls += 1
          return 0
        },
      },
      taxCalculatorForPlan(rowPlan) {
        const rate = rowPlan.assumptions.stateEffectiveTaxPct
        const delegate = createFlatTaxCalculator(rate)
        const calculator = {
          compute(input: Parameters<typeof delegate.compute>[0]) {
            usedRates.push(rate)
            return delegate.compute(input)
          },
        }
        createdRates.push(rate)
        calculators.push(calculator)
        return calculator
      },
    })

    expect([...createdRates].sort((a, b) => a - b)).toEqual([0, 10])
    expect(calculators).toHaveLength(2)
    expect(calculators[0]).not.toBe(calculators[1])
    expect(usedRates).toContain(0)
    expect(usedRates).toContain(10)
    expect(sharedCalculatorCalls).toBe(0)
    expect(cmp.rows[0]!.summary.lifetimeTaxesAndPenalties).toBe(0)
    // flatTax double transport: one year of $10,000 ordinary at 10% => $1,000 (not federal/state law).
    expect(cmp.rows[1]!.summary.lifetimeTaxesAndPenalties).toBe(1000)
  })
})
