/**
 * Survivor-transition analysis (survivor-widowhood-and-irmaa-relief, step 2;
 * moved from planner-ui in B2-P1 slice 5).
 *
 * The acceptance bar: every number the view shows agrees EXACTLY with running
 * the same death timing by hand — the same simulatePlan call with the same
 * death-age override, the same SSA-44 field flip, and for the lever the same
 * run with `additionalBracketFill`.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { summarizeProjection } from './compare.js'
import { simulatePlan } from './simulate.js'
import {
  SURVIVOR_LEVER_BRACKET_PCT,
  candidateDeathAges,
  conversionLeverPatch,
  isDegenerateTiming,
  survivorTransitionAnalysis,
  type SurvivorTimingRow,
  type SurvivorYearFacts,
} from './survivorTransition.js'

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

describe('survivorTransitionAnalysis', () => {
  it('is ineligible (and empty) for single-adult plans', () => {
    const single = validate(createEmptyPlan({ newId: testIds, now: fixedNow }))
    const analysis = survivorTransitionAnalysis(single, opts)
    expect(analysis.eligible).toBe(false)
    expect(analysis.rows).toEqual([])
  })

  it('sweeps only plausible first-death timings for each spouse', () => {
    const plan = validate(couplePlan())
    // Pat is 68 in 2026, planning to 90 → grid ages 70..85 qualify (90 = as planned).
    expect(candidateDeathAges(plan, 'p1', 2026, [70, 75, 80, 85, 90])).toEqual([70, 75, 80, 85])
    const analysis = survivorTransitionAnalysis(plan, opts)
    expect(analysis.eligible).toBe(true)
    const p1Rows = analysis.rows.filter((r) => r.deceasedPersonId === 'p1')
    expect(p1Rows.map((r) => r.deathAge)).toEqual([70, 75, 80, 85])
    expect(p1Rows.map((r) => r.deathYear)).toEqual([2028, 2033, 2038, 2043])
  })

  it('includes the current attained age in the sweep grid', () => {
    const older = couplePlan()
    older.household.people[0]!.dob = '1954-06-15'
    expect(candidateDeathAges(validate(older), 'p1', 2026, [70, 75, 80, 85, 90])).toEqual([75, 80, 85])
    const at70 = couplePlan()
    at70.household.people[0]!.dob = '1956-06-15' // 70 in 2026
    expect(candidateDeathAges(validate(at70), 'p1', 2026, [70, 75, 80, 85, 90])).toEqual([70, 75, 80, 85])
  })

  it('agrees exactly with running the same death timing by hand', () => {
    const plan = validate(couplePlan())
    const analysis = survivorTransitionAnalysis(plan, opts)
    const row = analysis.rows.find((r) => r.deceasedPersonId === 'p1' && r.deathAge === 75)!
    const overrides = { ...opts, deathAgeByPersonId: { p1: 75 } }

    const manualBase = simulatePlan(plan, overrides)
    const manualSummary = summarizeProjection(plan, manualBase, { conversionFreeRun: null })
    expect(row.baseEndingAfterTaxEstate).toBe(manualSummary.endingAfterTaxEstate)
    expect(row.baseLifetimeTax).toBe(manualSummary.lifetimeTaxesAndPenalties)
    expect(row.endYear).toBe(manualBase.endYear)
    const lastJoint = manualBase.years.find((y) => y.year === 2033)!
    const firstSurvivor = manualBase.years.find((y) => y.year === 2034)!
    // The shortfall facts read required spending (R16), not the total shortfall.
    expect(row.lastJointYear).toEqual({ year: 2033, magi: lastJoint.magi, tax: lastJoint.tax, requiredShortfall: lastJoint.requiredShortfall, filingStatus: lastJoint.filingStatus })
    expect(row.firstSurvivorYear.tax).toBe(firstSurvivor.tax)
    expect(row.ssBeforeDeath).toBe(lastJoint.incomes.socialSecurity)
    expect(row.ssAfterDeath).toBe(firstSurvivor.incomes.socialSecurity)

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
    let total = 0
    let relief = 0
    for (const y of withOff.years) {
      const on = withOn.years.find((x) => x.year === y.year)!
      total += y.medicarePremiums - on.medicarePremiums
      if (y.year === 2034 || y.year === 2035) relief += y.medicarePremiums - on.medicarePremiums
    }
    expect(row.ssa44PremiumSavings).toBe(total)
    expect(row.ssa44ReliefYearSavings).toBe(relief)
    expect(row.ssa44PremiumSavings).toBeGreaterThan(0)

    // The lever is the same timing with a 12% fill ADDED to the plan's
    // conversions through the death year.
    const lever = simulatePlan(plan, { ...overrides, additionalBracketFill: { bracketPct: SURVIVOR_LEVER_BRACKET_PCT, startYear: 2026, endYear: 2033 } })
    const leverSummary = summarizeProjection(plan, lever, { conversionFreeRun: null })
    expect(row.conversionLever.endingAfterTaxEstate).toBe(leverSummary.endingAfterTaxEstate)
    expect(row.conversionLever.estateDelta).toBe(leverSummary.endingAfterTaxEstate - manualSummary.endingAfterTaxEstate)
    expect(row.conversionLever.lifetimeTaxDelta).toBe(leverSummary.lifetimeTaxesAndPenalties - manualSummary.lifetimeTaxesAndPenalties)
  })

  it('prices the lever on a plan that converts nothing exactly as the replacement patch did', () => {
    // With no conversions of its own, "in addition" and "instead" coincide: the
    // widows-penalty insight's replacement patch gives the same run.
    const plan = validate(couplePlan())
    const row = survivorTransitionAnalysis(plan, opts).rows.find((r) => r.deceasedPersonId === 'p1' && r.deathAge === 75)!
    const patched = applyScenarioPatch(plan, conversionLeverPatch(2026, 2033))
    expect(patched.ok).toBe(true)
    if (!patched.ok) return
    const replaced = summarizeProjection(patched.plan, simulatePlan(patched.plan, { ...opts, deathAgeByPersonId: { p1: 75 } }), { conversionFreeRun: null })
    expect(row.conversionLever.endingAfterTaxEstate).toBe(replaced.endingAfterTaxEstate)
    expect(row.conversionLever.lifetimeTax).toBe(replaced.lifetimeTaxesAndPenalties)
    expect(row.conversionLever.raisedYears.length).toBeGreaterThan(0)
  })

  it('names the reason a lever adds nothing: a plan already converting past the bracket covers every window year', () => {
    const plan = couplePlan()
    plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 24, startYear: 2026, endYear: 2040 }
    const row = survivorTransitionAnalysis(validate(plan), opts).rows.find((r) => r.deceasedPersonId === 'p1' && r.deathAge === 70)!
    expect(row.conversionLever.raisedYears).toEqual([])
    expect(row.conversionLever.coveredYears).toEqual([2026, 2027, 2028])
    // The 24% fill empties the IRA in 2028, and the ledger says the request was reduced to the balance left.
    expect(row.conversionLever.years).toEqual([
      { year: 2026, reason: 'covered', notes: [] },
      { year: 2027, reason: 'covered', notes: [] },
      { year: 2028, reason: 'covered', notes: ['A requested Roth conversion exceeded the available traditional balance and was reduced.'] },
    ])
    expect(row.conversionLever.estateDelta).toBe(0)
    expect(row.conversionLever.lifetimeTaxDelta).toBe(0)
  })

  it('names a skipped conversion with the ledger\'s own reason: the IRA\'s owner has no Roth account', () => {
    const plan = couplePlan()
    plan.accounts = plan.accounts.map((a) => (a.type === 'traditional' ? { ...a, ownerPersonId: 'p2' } : a))
    const row = survivorTransitionAnalysis(validate(plan), opts).rows.find((r) => r.deceasedPersonId === 'p1' && r.deathAge === 70)!
    expect(row.conversionLever.raisedYears).toEqual([])
    const short = row.conversionLever.years.filter((y) => y.reason === 'short')
    expect(short.length).toBeGreaterThan(0)
    for (const y of short) {
      expect(y.notes).toEqual([
        'Sam has no Roth account, so Sam’s share of the Roth conversion was skipped — a conversion has to land in the same person’s own Roth. Opening a Roth IRA for Sam would let that share convert.',
      ])
    }
  })

  it('skips a timing whose death falls in the survivor\'s last year: no survivor years follow it', () => {
    const plan = couplePlan()
    // Sam's last year is 1960 + 83 = 2043, the year Pat dies at 85.
    plan.household.people[1]!.longevity = { planningAge: 83, source: 'manual' }
    const analysis = survivorTransitionAnalysis(validate(plan), opts)
    expect(analysis.rows.filter((r) => r.deceasedPersonId === 'p1').map((r) => [r.deathAge, r.deathYear])).toEqual([[70, 2028], [75, 2033], [80, 2038]])
  })
})

describe('SimulateOptions.additionalBracketFill', () => {
  it('refuses a bracket that is not a rate between 0 and 100 percent', () => {
    const plan = validate(couplePlan())
    for (const bracketPct of [0, 100, Number.NaN]) {
      expect(() => simulatePlan(plan, { ...opts, additionalBracketFill: { bracketPct, startYear: 2026, endYear: 2030 } }), String(bracketPct)).toThrow(RangeError)
    }
  })

  it('refuses a window that ends before it starts, or is not whole years', () => {
    const plan = validate(couplePlan())
    expect(() => simulatePlan(plan, { ...opts, additionalBracketFill: { bracketPct: 12, startYear: 2030, endYear: 2029 } })).toThrow(RangeError)
    expect(() => simulatePlan(plan, { ...opts, additionalBracketFill: { bracketPct: 12, startYear: 2026.5, endYear: 2030 } })).toThrow(RangeError)
    expect(() => simulatePlan(plan, { ...opts, additionalBracketFill: { bracketPct: 12, startYear: 2030, endYear: 2030 } })).not.toThrow()
  })
})

function facts(year: number, over: Partial<SurvivorYearFacts> = {}): SurvivorYearFacts {
  return { year, magi: 0, tax: 0, requiredShortfall: 0, filingStatus: 'marriedFilingJointly', ...over }
}

/** The #513 row: $0 → $0, no tax, no balance, no estate, short on both sides of the death. */
function baseline(over: Partial<SurvivorTimingRow> = {}): SurvivorTimingRow {
  return {
    deceasedPersonId: 'p1',
    deathAge: 75,
    deathYear: 2037,
    endYear: 2060,
    filingTimeline: [],
    lastJointYear: facts(2037, { requiredShortfall: 40_000 }),
    firstSurvivorYear: facts(2038, { requiredShortfall: 40_000, filingStatus: 'single' }),
    ssBeforeDeath: 0,
    ssAfterDeath: 0,
    irmaaYears: [],
    ssa44PremiumSavings: 0,
    ssa44ReliefYearSavings: 0,
    survivorShortfallYears: 25,
    minSurvivorInvestable: 0,
    baseEndingAfterTaxEstate: 0,
    baseLifetimeTax: 0,
    conversionLever: { endingAfterTaxEstate: 0, lifetimeTax: 0, estateDelta: 0, lifetimeTaxDelta: 0, raisedYears: [], coveredYears: [], years: [] },
    ...over,
  }
}

describe('isDegenerateTiming (#513)', () => {
  it('reads the #513 row as degenerate: all zero, shortfall on both sides of the death', () => {
    expect(isDegenerateTiming(baseline())).toBe(true)
  })

  it.each<[string, Partial<SurvivorTimingRow>]>([
    ['Social Security before the death', { ssBeforeDeath: 24_000 }],
    ['Social Security after the death', { ssAfterDeath: 18_000 }],
    ['tax in the last joint year', { lastJointYear: facts(2037, { requiredShortfall: 40_000, tax: 3_000 }) }],
    ['tax in the first survivor year', { firstSurvivorYear: facts(2038, { requiredShortfall: 40_000, tax: 3_000 }) }],
    ['MAGI only, no tax, in the last joint year', { lastJointYear: facts(2037, { requiredShortfall: 40_000, magi: 20_000 }) }],
    ['MAGI only, no tax, in the first survivor year', { firstSurvivorYear: facts(2038, { requiredShortfall: 40_000, magi: 20_000 }) }],
    ['a surviving balance', { minSurvivorInvestable: 12_000 }],
    ['an after-tax estate', { baseEndingAfterTaxEstate: 50_000 }],
    ['lifetime tax later in the projection', { baseLifetimeTax: 9_000 }],
    ['an SSA-44 premium saving', { ssa44PremiumSavings: 1_200 }],
    // The death introduced the shortfall: the joint side's required spending was funded.
    ['survivor shortfall the last joint year did not have', { lastJointYear: facts(2037, { requiredShortfall: 0 }) }],
    ['a real negative balance', { minSurvivorInvestable: -5_000 }],
  ])('keeps a row that has %s', (_what, over) => {
    expect(isDegenerateTiming(baseline(over))).toBe(false)
  })

  it('is symmetric on shortfall: no survivor shortfall at all is degenerate even with a funded joint side', () => {
    expect(isDegenerateTiming(baseline({ survivorShortfallYears: 0, lastJointYear: facts(2037, { requiredShortfall: 0 }) }))).toBe(true)
  })

  it('treats a rounding remainder of either sign as nothing, and half a dollar as something', () => {
    expect(isDegenerateTiming(baseline({ ssAfterDeath: 0.49 }))).toBe(true)
    expect(isDegenerateTiming(baseline({ minSurvivorInvestable: -0.3 }))).toBe(true)
    expect(isDegenerateTiming(baseline({ ssAfterDeath: 0.5 }))).toBe(false)
    expect(isDegenerateTiming(baseline({ lastJointYear: facts(2037, { requiredShortfall: 0.5 }) }))).toBe(false)
    expect(isDegenerateTiming(baseline({ lastJointYear: facts(2037, { requiredShortfall: 0.51 }) }))).toBe(true)
  })
})
