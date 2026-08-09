import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { irmaaTierForMagi, irmaaTierThreshold, packForYear } from '../params/index.js'
import { computeFederalTax, createFederalTaxCalculator } from '../tax/federalTax.js'
import { simulatePlan } from './simulate.js'
import { taxParameterFilingStatus } from './types.js'

let counter = 0
const testIds = () => `adv-fed-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

/** Single person born 1960, already Medicare-age, short horizon. */
function smallPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 70, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.accounts = [{
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 400_000,
    annualContribution: 0,
  }]
  plan.expenses.baseAnnual = 30_000
  return plan
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/**
 * Mirror `simulate.ts` `factorFrom` / `inflFactorFrom` for a constant
 * `assumptions.inflationPct` path — do NOT use `Math.pow` of a year's
 * `inflationScale`, which is the defect class under test.
 */
function inflationFactorFromPlanInputs(
  inflationPct: number,
  startYear: number,
  horizon: number,
  fromYear: number,
  toYear: number,
): number {
  const inflation = inflationPct / 100
  const cumInfl: number[] = [1]
  for (let i = 0; i < horizon; i++) {
    cumInfl.push(cumInfl[i]! * (1 + inflation))
  }
  if (toYear <= fromYear) return 1
  let f = 1
  if (fromYear < startYear) {
    f = Math.pow(1 + inflation, Math.min(toYear, startYear) - fromYear)
  }
  const a = Math.min(Math.max(fromYear, startYear) - startYear, horizon)
  const b = Math.min(Math.max(toYear, startYear) - startYear, horizon)
  return f * (cumInfl[b]! / cumInfl[a]!)
}

describe('simulatePlan advisoryFederalTax publication', () => {
  it('publishes advisoryFederalTax, irmaaLookbackMagi, and irmaaNextTierThreshold on every alive year', () => {
    const federal = createFederalTaxCalculator()
    const result = simulatePlan(validate(smallPlan()), {
      startYear: 2026,
      taxCalculator: federal,
    })

    const aliveYears = result.years.filter((year) => year.people.some((person) => person.alive))
    expect(aliveYears.length).toBeGreaterThan(0)

    for (const year of aliveYears) {
      expect(year.advisoryFederalTax).toBeDefined()
      const { input, detail } = year.advisoryFederalTax!
      expect(computeFederalTax(input)).toEqual(detail)
      expect(detail.zeroRateLtcgHeadroom).toBe(year.ltcgZeroHeadroom)

      expect(year.irmaaLookbackMagi).toBeTypeOf('number')
      expect(year.irmaaLookbackMagiSource).toBeDefined()
      expect(year.irmaaLookbackMagiYear).toBeTypeOf('number')
      expect(year.irmaaNextTierThreshold).toBeDefined()
      const { pack } = packForYear(year.year)
      const filingStatus =
        year.filingStatus === 'qualifyingSurvivingSpouse'
          ? 'single'
          : taxParameterFilingStatus(year.filingStatus)
      // Constant-inflation fixture (inflationPct = 0): factors are identically 1.
      const at = {
        premiumYear: year.year,
        inflationFactorToYear: () => 1,
      }
      expect(irmaaTierForMagi(pack, year.irmaaLookbackMagi!, filingStatus, at)).toBe(
        year.irmaaTier,
      )

      const anyMedicare = year.people.some(
        (person) => person.alive && person.ageAttained >= 65,
      )
      if (!anyMedicare || year.irmaaTier >= pack.medicare.irmaaTiers.length) {
        expect(year.irmaaNextTierThreshold).toBeNull()
      } else {
        expect(year.irmaaNextTierThreshold).toBe(
          irmaaTierThreshold(pack, year.irmaaTier, filingStatus, at),
        )
        expect(year.irmaaNextTierThreshold!).toBeGreaterThanOrEqual(year.irmaaLookbackMagi!)
      }
    }
  })

  it('labels first-two-years lookback MAGI as planFallback with the lookback calendar year', () => {
    const federal = createFederalTaxCalculator()
    const result = simulatePlan(validate(smallPlan()), {
      startYear: 2026,
      taxCalculator: federal,
    })

    // year-2 lookback is pre-projection → recentAnnualMagi stand-in (default 0).
    const year2026 = result.years.find((year) => year.year === 2026)!
    expect(year2026.irmaaLookbackMagi).toBe(0)
    expect(year2026.irmaaLookbackMagiSource).toBe('planFallback')
    expect(year2026.irmaaLookbackMagiYear).toBe(2024)

    const year2027 = result.years.find((year) => year.year === 2027)!
    expect(year2027.irmaaLookbackMagiSource).toBe('planFallback')
    expect(year2027.irmaaLookbackMagiYear).toBe(2025)
  })

  it('labels lookback MAGI from historicalAnnualMagiByYear as historicalInput', () => {
    const plan = smallPlan()
    plan.assumptions.historicalAnnualMagiByYear = { '2024': 95_000 }
    plan.assumptions.recentAnnualMagi = 0

    const federal = createFederalTaxCalculator()
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: federal,
    })

    const year2026 = result.years.find((year) => year.year === 2026)!
    expect(year2026.irmaaLookbackMagi).toBe(95_000)
    expect(year2026.irmaaLookbackMagiSource).toBe('historicalInput')
    expect(year2026.irmaaLookbackMagiYear).toBe(2024)
  })

  it('publishes irmaaNextTierThreshold null in pre-Medicare years (no Medicare activity)', () => {
    const plan = smallPlan()
    // Age ~56 in 2026 — no Medicare months.
    plan.household.people[0]!.dob = '1970-06-15'
    plan.household.people[0]!.retirementAge = 65
    plan.household.people[0]!.longevity = { planningAge: 70, source: 'manual' }

    const federal = createFederalTaxCalculator()
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: federal,
    })

    const year1 = result.years.find((year) => year.year === 2026)!
    expect(year1.people.every((person) => !person.alive || person.ageAttained < 65)).toBe(true)
    expect(year1.irmaaNextTierThreshold).toBeNull()
    expect(year1.irmaaLookbackMagi).toBeTypeOf('number')
    expect(year1.irmaaLookbackMagiSource).toBeDefined()
    expect(year1.irmaaLookbackMagiYear).toBeTypeOf('number')
  })

  it('indexes IRMAA next-tier thresholds under non-zero inflation via the simulator cum-factor path', () => {
    const startYear = 2026
    const inflationPct = 3
    const plan = smallPlan()
    plan.assumptions.inflationPct = inflationPct
    // Long enough that a lookback-tier threshold is actually indexed past pack year.
    plan.household.people[0]!.longevity = { planningAge: 80, source: 'manual' }

    const federal = createFederalTaxCalculator()
    const validated = validate(plan)
    const result = simulatePlan(validated, {
      startYear,
      taxCalculator: federal,
    })
    const horizon = result.years.length
    const { pack: basePack } = packForYear(startYear)

    let sawIndexedThreshold = false
    for (const year of result.years) {
      if (!year.people.some((person) => person.alive)) continue
      if (year.irmaaNextTierThreshold === undefined) continue
      if (year.irmaaNextTierThreshold === null) continue

      const { pack } = packForYear(year.year)
      const filingStatus =
        year.filingStatus === 'qualifyingSurvivingSpouse'
          ? 'single'
          : taxParameterFilingStatus(year.filingStatus)

      const factorTo = (toYear: number) =>
        inflationFactorFromPlanInputs(
          inflationPct,
          startYear,
          horizon,
          pack.year,
          toYear,
        )
      const expected = irmaaTierThreshold(pack, year.irmaaTier, filingStatus, {
        premiumYear: year.year,
        inflationFactorToYear: factorTo,
      })
      expect(year.irmaaNextTierThreshold).toBe(expected)

      const unindexed = pack.medicare.irmaaTiers[year.irmaaTier]!.magiOver[filingStatus]
      if (factorTo(year.year) !== 1 && expected !== unindexed) {
        sawIndexedThreshold = true
      }
    }

    // Ensure the fixture actually exercised indexing (not a zero-inflation no-op).
    expect(sawIndexedThreshold).toBe(true)
    expect(
      inflationFactorFromPlanInputs(
        inflationPct,
        startYear,
        horizon,
        basePack.year,
        startYear + Math.min(horizon - 1, 4),
      ),
    ).toBeGreaterThan(1)
  })

  it('prices IRMAA thresholds on the single table for qualifyingSurvivingSpouse years', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.hasQualifyingDependent = true
    plan.household.people = [
      {
        id: 'p1',
        name: 'Pat',
        dob: '1960-01-01',
        sex: 'average',
        retirementAge: null,
        longevity: { planningAge: 70, source: 'manual' },
      },
      {
        id: 'p2',
        name: 'Sam',
        dob: '1960-01-01',
        sex: 'average',
        retirementAge: null,
        longevity: { planningAge: 66, source: 'manual' },
      },
    ]
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.incomes = [
      {
        type: 'recurring',
        id: testIds(),
        label: 'Consulting',
        annualAmount: 120_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
    ]
    plan.accounts = [{
      type: 'cash',
      id: testIds(),
      name: 'Cash',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 1_000_000,
      annualContribution: 0,
    }]
    plan.expenses.baseAnnual = 30_000

    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    })

    const qssYears = result.years.filter(
      (year) => year.filingStatus === 'qualifyingSurvivingSpouse',
    )
    expect(qssYears.length).toBeGreaterThan(0)

    for (const year of qssYears) {
      expect(year.irmaaNextTierThreshold).toBeDefined()
      if (year.irmaaNextTierThreshold === null) continue

      const { pack } = packForYear(year.year)
      const at = {
        premiumYear: year.year,
        inflationFactorToYear: () => 1,
      }
      // POMS HI 01101.020: QSS prices on the single IRMAA table, not joint.
      expect(year.irmaaNextTierThreshold).toBe(
        irmaaTierThreshold(pack, year.irmaaTier, 'single', at),
      )
      expect(year.irmaaNextTierThreshold).not.toBe(
        irmaaTierThreshold(pack, year.irmaaTier, 'marriedFilingJointly', at),
      )
      expect(irmaaTierForMagi(pack, year.irmaaLookbackMagi!, 'single', at)).toBe(
        year.irmaaTier,
      )
    }
  })
})
