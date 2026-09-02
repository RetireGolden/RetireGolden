import { describe, expect, it } from 'vitest'

import {
  createEmptyPlan,
  parsePlan,
  type Account,
  type Plan,
} from '../model/plan.js'
import { combineTaxCalculators, createFederalTaxCalculator } from '../tax/federalTax.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import { simulatePlan } from './simulate.js'
import {
  basePlan,
  cash,
  fixedNow,
  noTax,
  testIds,
  traditional,
  validate,
} from './simulate.test-support.js'

describe('state tax integration', () => {
  /** Retiree drawing from a traditional account to fund spending (taxable income). */
  function stateRetiree(state: string): Plan {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1958-06-15' // 68 in 2026
    plan.household.people[0]!.retirementAge = null
    plan.household.state = state
    plan.expenses.baseAnnual = 60_000
    plan.accounts = [traditional(1_500_000)]
    return plan
  }

  const stateStack = combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator())

  it('charges state tax in a taxing state and none in a no-tax state', () => {
    const ky = simulatePlan(validate(stateRetiree('KY')), { startYear: 2026, taxCalculator: stateStack })
    const fl = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: stateStack })
    const kyTax = ky.years[0]!.tax
    const flTax = fl.years[0]!.tax
    expect(kyTax).toBeGreaterThan(flTax)
    // FL has no income tax, so its first-year tax is purely federal.
    const federalOnly = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(flTax).toBeCloseTo(federalOnly.years[0]!.tax, 6)
  })

  it('switches state rules at a relocation year', () => {
    const plan = stateRetiree('FL')
    plan.household.stateMoves = [{ fromYear: 2030, fromMonth: 7, state: 'KY' }]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    const before = result.years.find((y) => y.year === 2029)!
    const after = result.years.find((y) => y.year === 2031)!
    // FL years pay no state tax; KY years (post-move) do, so tax rises.
    expect(after.tax).toBeGreaterThan(before.tax)
  })

  it('warns when the residence state is not modeled and there is no override', () => {
    const plan = stateRetiree('ZZ') // unknown code (all 50 + DC are modeled), override 0
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    expect(result.warnings.some((w) => w.includes('ZZ') && w.includes("isn't modeled"))).toBe(true)
    // No warning for a modeled state.
    const ky = simulatePlan(validate(stateRetiree('KY')), { startYear: 2026, taxCalculator: stateStack })
    expect(ky.warnings.some((w) => w.includes("isn't modeled"))).toBe(false)
  })

  it('does not warn about an unmodeled state when a flat override is set', () => {
    const plan = stateRetiree('ZZ')
    plan.assumptions.stateEffectiveTaxPct = 5
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    expect(result.warnings.some((w) => w.includes("isn't modeled"))).toBe(false)
  })

  it('honors the flat override regardless of modeled state', () => {
    const overrideStack = combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator({ overridePct: 6 }))
    const fl = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: overrideStack })
    // Even no-tax FL pays the explicit override on top of federal.
    const federalOnly = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(fl.years[0]!.tax).toBeGreaterThan(federalOnly.years[0]!.tax)
  })

  it('adds the optional local income tax rate through the standard tax stack', () => {
    const plan = stateRetiree('KY')
    const noLocal = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    plan.assumptions.localIncomeTaxPct = 3
    const withLocalStack = combineTaxCalculators(
      createFederalTaxCalculator(),
      createStateTaxCalculator({ localPct: plan.assumptions.localIncomeTaxPct }),
    )
    const withLocal = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: withLocalStack })
    expect(withLocal.years[0]!.tax).toBeGreaterThan(noLocal.years[0]!.tax)
  })
})

describe('survivor filing-status transitions', () => {
  function filingTransitionPlan(hasQualifyingDependent: boolean): Plan {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.hasQualifyingDependent = hasQualifyingDependent
    plan.household.people = [
      { id: 'p1', name: 'Pat', dob: '1960-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 70, source: 'manual' } },
      { id: 'p2', name: 'Sam', dob: '1960-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Consulting', annualAmount: 120_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(1_000_000)]
    return plan
  }

  it('keeps the death year joint, then uses single without the QSS opt-in', () => {
    const result = simulatePlan(validate(filingTransitionPlan(false)), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(result.years.find((y) => y.year === 2026)!.filingStatus).toBe('marriedFilingJointly')
    expect(result.years.find((y) => y.year === 2027)!.filingStatus).toBe('single')
  })

  it('uses qualifying surviving spouse for the two years after death when opted in', () => {
    const result = simulatePlan(validate(filingTransitionPlan(true)), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(result.years.find((y) => y.year === 2026)!.filingStatus).toBe('marriedFilingJointly')
    expect(result.years.find((y) => y.year === 2027)!.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(result.years.find((y) => y.year === 2028)!.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(result.years.find((y) => y.year === 2029)!.filingStatus).toBe('single')
  })
})

describe('stateMoves back-compat', () => {
  it('parses a plan with no stateMoves and defaults to an empty list', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow }) as unknown as Record<string, unknown>
    const household = plan.household as Record<string, unknown>
    delete household.stateMoves
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.plan.household.stateMoves).toEqual([])
  })
})

describe('survivor spending percentage', () => {
  /** Couple where Sam's earlier planning age (75, dies 2041) leaves Pat alone through 2056. */
  function couplePlan(): Plan {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1966-06-15',
      sex: 'average',
      retirementAge: 67,
      longevity: { planningAge: 75, source: 'manual' },
    })
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [cash(3_000_000)]
    return plan
  }

  const run = (plan: Plan) => simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

  it('defaults to 100% — absent field changes nothing in survivor years', () => {
    const result = run(couplePlan())
    const jointYear = result.years.find((y) => y.year === 2035)!
    const survivorYear = result.years.find((y) => y.year === 2050)!
    expect(survivorYear.people.filter((p) => p.alive)).toHaveLength(1)
    expect(jointYear.expenses.baseSpending).toBe(40_000)
    expect(survivorYear.expenses.baseSpending).toBe(40_000)
  })

  it('scales base + phase spending in survivor years only', () => {
    const plan = couplePlan()
    plan.expenses.survivorSpendingPct = 70
    plan.expenses.phases = [{ fromAge: 75, multiplier: 0.9 }]
    const result = run(plan)

    // Both alive, before the phase: unscaled.
    expect(result.years.find((y) => y.year === 2035)!.expenses.baseSpending).toBe(40_000)
    // Survivor year with the 0.9 phase active (Pat is 84 in 2050): both factors compose.
    expect(result.years.find((y) => y.year === 2050)!.expenses.baseSpending).toBeCloseTo(40_000 * 0.9 * 0.7, 6)
  })

  it('leaves one-time goals unscaled in survivor years', () => {
    const plan = couplePlan()
    plan.expenses.survivorSpendingPct = 70
    plan.expenses.oneTimeGoals = [{ id: testIds(), label: 'Roof', year: 2050, amount: 25_000 }]
    const result = run(plan)
    expect(result.years.find((y) => y.year === 2050)!.expenses.oneTimeGoals).toBe(25_000)
  })

  it('never applies to single households', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.expenses.survivorSpendingPct = 70
    plan.accounts = [cash(3_000_000)]
    const result = run(plan)
    // A one-person household has no "survivor" years — spending stays level.
    expect(result.years.find((y) => y.year === 2050)!.expenses.baseSpending).toBe(40_000)
  })
})

describe('SSA-44 IRMAA redetermination', () => {
  function roth(balance: number, owner = 'p1'): Account {
    return { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: owner, annualReturnPct: null, kind: 'ira', balance, annualContribution: 0 }
  }

  /**
   * Retired couple both on Medicare (born 1953, RMDs running). p1 dies at the
   * end of 2030; manual Roth conversions through 2029 keep the joint-year MAGI
   * over the single-filer tier-1 threshold, so under the plain lookback the
   * survivor's 2031 premium is priced on joint-era income.
   */
  function survivorIrmaaPlan(): Plan {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Pat', dob: '1953-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 77, source: 'manual' } }, // last year alive: 2030
      { id: 'p2', name: 'Sam', dob: '1953-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    ]
    plan.assumptions.healthcareExtraInflationPct = 0 // level premiums keep the dollar assertions exact
    plan.accounts = [cash(500_000), traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [2026, 2027, 2028, 2029].map((year) => ({ year, amount: 150_000 })),
    }
    return plan
  }

  it('prices the two survivor years on the lower recent MAGI when opted in', () => {
    const off = simulatePlan(validate(survivorIrmaaPlan()), { startYear: 2026, taxCalculator: noTax })
    const onPlan = survivorIrmaaPlan()
    onPlan.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const on = simulatePlan(validate(onPlan), { startYear: 2026, taxCalculator: noTax })

    // 2031, the first survivor year: the lookback references 2029 (150k joint
    // conversion + RMD > 109k single threshold) → surcharge. The
    // redetermination prices it on 2030's survivor-level MAGI (RMD only).
    const off2031 = off.years.find((y) => y.year === 2031)!
    const on2031 = on.years.find((y) => y.year === 2031)!
    expect(off2031.filingStatus).toBe('single')
    expect(off2031.irmaaTier).toBeGreaterThanOrEqual(1)
    expect(on2031.irmaaTier).toBe(0)
    expect(on2031.medicarePremiums).toBeLessThan(off2031.medicarePremiums)
    expect(on2031.medicarePremiums).toBeCloseTo(202.9 * 12, 4) // standard Part B, one person

    // Joint years are untouched — the window opens only after the event year
    // (2030's premium is priced identically in both runs).
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      expect(on.years.find((y) => y.year === year)!.medicarePremiums).toBeCloseTo(
        off.years.find((y) => y.year === year)!.medicarePremiums,
        6,
      )
      expect(on.years.find((y) => y.year === year)!.irmaaTier).toBe(off.years.find((y) => y.year === year)!.irmaaTier)
    }
  })

  it('never raises a premium: the redetermination takes the lower of lookback and recent MAGI', () => {
    const off = simulatePlan(validate(survivorIrmaaPlan()), { startYear: 2026, taxCalculator: noTax })
    const onPlan = survivorIrmaaPlan()
    onPlan.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const on = simulatePlan(validate(onPlan), { startYear: 2026, taxCalculator: noTax })
    for (const year of on.years) {
      const other = off.years.find((y) => y.year === year.year)!
      expect(year.medicarePremiums).toBeLessThanOrEqual(other.medicarePremiums + 1e-9)
    }
  })

  it('is unchanged with the field absent or fully off (feature-off regression)', () => {
    const absentPlan = survivorIrmaaPlan()
    const offPlan = structuredClone(absentPlan) // identical ids; only the flag differs
    offPlan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: false }
    const absent = simulatePlan(validate(absentPlan), { startYear: 2026, taxCalculator: noTax })
    const off = simulatePlan(validate(offPlan), { startYear: 2026, taxCalculator: noTax })
    expect(JSON.stringify(off.years)).toBe(JSON.stringify(absent.years))
  })

  it('treats each retirement year as a qualifying event only when opted in', () => {
    // Single retiree on Medicare from 2026 (born 1961), work stoppage in 2027
    // (retirementAge 66). A single large 2026 conversion lifts the 2028
    // premium's lookback; the 2027 estimate year is quiet.
    const make = (): Plan => {
      const plan = basePlan()
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1961-06-15',
        retirementAge: 66,
      }
      plan.accounts = [cash(500_000), traditional(1_000_000), roth(0)]
      plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 150_000 }] }
      return plan
    }
    const offPlan = make()
    const survivorOnly = structuredClone(offPlan) // identical ids; only the flag differs
    survivorOnly.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const onPlan = structuredClone(offPlan)
    onPlan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: true }
    const off = simulatePlan(validate(offPlan), { startYear: 2026, taxCalculator: noTax })
    const survivorOnlyRun = simulatePlan(validate(survivorOnly), { startYear: 2026, taxCalculator: noTax })
    const on = simulatePlan(validate(onPlan), { startYear: 2026, taxCalculator: noTax })

    const off2028 = off.years.find((y) => y.year === 2028)!
    const on2028 = on.years.find((y) => y.year === 2028)!
    expect(off2028.irmaaTier).toBeGreaterThanOrEqual(1) // lookback = 2026's 150k conversion
    expect(on2028.irmaaTier).toBe(0) // min(2026, 2027 estimate) = quiet 2027
    // The survivor-years toggle alone never applies to a single household.
    expect(JSON.stringify(survivorOnlyRun.years)).toBe(JSON.stringify(off.years))
  })

  it('ignores a retirement the person does not live to reach (no phantom window)', () => {
    // p1 would retire at 78 (2031) but a scenario override kills them at 75
    // (2028): with retirementYears on, no work-stoppage window may open in
    // 2032–2033 — the survivor's 2032 premium must still see 2030's conversion
    // through the plain lookback.
    const make = (): Plan => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Pat', dob: '1953-06-15', sex: 'average', retirementAge: 78, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'Sam', dob: '1953-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      ]
      plan.assumptions.healthcareExtraInflationPct = 0
      plan.accounts = [cash(500_000), traditional(1_000_000, 0, 'p2'), roth(0, 'p2')]
      plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2030, amount: 150_000 }] }
      return plan
    }
    const offPlan = make()
    const onPlan = structuredClone(offPlan)
    onPlan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: true }
    const simOpts = { startYear: 2026, taxCalculator: noTax, deathAgeByPersonId: { p1: 75 } }
    const off = simulatePlan(validate(offPlan), simOpts)
    const on = simulatePlan(validate(onPlan), simOpts)
    expect(on.years.find((y) => y.year === 2032)!.irmaaTier).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(on.years)).toBe(JSON.stringify(off.years))
  })

  it('prices QSS survivor years on the single IRMAA table (POMS HI 01101.020)', () => {
    // Same fixture with the QSS opt-in: 2031–2032 file as qualifying surviving
    // spouse (joint tax tables), but SSA's IRMAA categories group QSS with
    // individual filers — 2029's ~150k joint MAGI is under the joint threshold
    // (218k) yet over the single one (109k), so the surcharge tier must hit.
    const plan = survivorIrmaaPlan()
    plan.household.hasQualifyingDependent = true
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const y2031 = result.years.find((y) => y.year === 2031)!
    expect(y2031.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(y2031.irmaaTier).toBeGreaterThanOrEqual(1)
  })

  it('flags the redetermination years in the optimizer probe', () => {
    const plan = survivorIrmaaPlan()
    plan.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const flagged: number[] = []
    simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: noTax,
      captureOptimizerInputs: (p) => {
        if (p.ssa44IrmaaRedetermination) flagged.push(p.year)
      },
    })
    expect(flagged).toEqual([2031, 2032]) // the two years after the 2030 death
  })
})
