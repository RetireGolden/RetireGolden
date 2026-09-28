import { expect, it } from 'vitest'

import type { FormerSpouse, Plan } from '../../model/plan.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../../rules/describeCalculation.js'
import { couplePlan, singlePersonPlan, validatePlan } from '../../testing/planFixtures.js'
import { survivorBenefitMonthly } from '../survivorBenefit.js'
import {
  rankSwitchStrategies,
  survivorSwitchingInputs,
  expectedPvSwitch,
  type SwitchingInput,
  type SwitchingOptions,
  type SwitchStrategy,
} from './survivorSwitching.js'

const WORKSHEET = 'DOCS/calculations/social-security/survivor-switching-expected-value.md'
const MUTATION = 'DOCS/calculations/social-security/survivor-switching-expected-value.mutation.md'

// The Expected table: one row per case and strategy, in ranking order, keyed "A: <strategy>".
const rows = worksheetExpectedRows(WORKSHEET)
function expectedRanking(caseLabel: string): { label: string; expectedPv: number }[] {
  return [...rows]
    .filter(([key]) => key.startsWith(`${caseLabel}: `))
    .map(([key, cells]) => ({ label: key.slice(caseLabel.length + 2), expectedPv: worksheetNumber(cells[0]!) }))
}

const matchInflation: SwitchingOptions['assumptions'] = { inflationPct: 2.5, ssCola: { mode: 'matchInflation' }, ssHaircut: null }
const atA: SwitchingOptions = { discountRate: 0.02, assumptions: matchInflation }

const caseA: SwitchingInput = {
  dob: { year: 1964, month: 6, day: 15 },
  sex: 'female',
  currentAge: 62,
  ownPiaMonthly: 1_500,
  deceasedPiaMonthly: 2_400,
  deceasedActualMonthly: 1_680,
  deceasedEverReduced: true,
}

// A widow of 60 whose husband claimed at his full retirement age, with a 2% COLA against 2.5% inflation and a 20% cut from 2034.
const caseB: SwitchingInput = {
  dob: { year: 1966, month: 3, day: 10 },
  sex: 'female',
  currentAge: 60,
  ownPiaMonthly: 1_200,
  deceasedPiaMonthly: 2_000,
  deceasedActualMonthly: 2_000,
  deceasedEverReduced: false,
}
const atB: SwitchingOptions = {
  discountRate: 0.02,
  assumptions: { inflationPct: 2.5, ssCola: { mode: 'fixed', annualPct: 2 }, ssHaircut: { fromYear: 2034, cutPct: 20 } },
}

// A widow of 65 whose husband claimed at 70.
const caseC: SwitchingInput = {
  dob: { year: 1961, month: 2, day: 10 },
  sex: 'female',
  currentAge: 65,
  ownPiaMonthly: 2_000,
  deceasedPiaMonthly: 2_200,
  deceasedActualMonthly: 2_200 * (1 + 40 * (2 / 3 / 100)),
  deceasedEverReduced: false,
}

/** The page's label for a strategy. */
function label(strategy: SwitchStrategy): string {
  const { survivorClaimAge: s, ownClaimAge: o } = strategy
  if (s !== null && o !== null) return s <= o ? `Survivor at ${s}, switch to own at ${o}` : `Own at ${o}, switch to survivor at ${s}`
  if (s !== null) return `Survivor only, at ${s}`
  return `Own only, at ${o}`
}

function expectRanking(caseLabel: string, input: SwitchingInput, options: SwitchingOptions): void {
  const expected = expectedRanking(caseLabel)
  const ranked = rankSwitchStrategies(input, options)
  expect(ranked.map((row) => label(row.strategy)), `case ${caseLabel}`).toEqual(expected.map((row) => row.label))
  ranked.forEach((row, index) => {
    const value = expected[index]!.expectedPv
    expect(withinTolerance(row.expectedPv, value, { rel: 1e-12 }), `${caseLabel}: ${label(row.strategy)}: ${row.expectedPv}`).toBe(true)
  })
}

/** A widow living alone, PIA 1,500 at 67, with the given former-spouse records. */
function widowPlan(records: FormerSpouse[], dob = '1964-06-15'): Plan {
  const plan = singlePersonPlan({ dob })
  plan.household.people[0] = { ...plan.household.people[0]!, sex: 'female' }
  plan.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 1_500, earnings: null, claimAge: { years: 67, months: 0 }, formerSpouses: records }]
  return validatePlan(plan)
}

describeCalculation(
  'survivor-switching-expected-value',
  {
    example: {
      inputs: { caseA, caseB, caseC, discountRate: 0.02 },
      expected: { topA: expectedRanking('A')[0]!.expectedPv, topB: expectedRanking('B')[0]!.expectedPv, topC: expectedRanking('C')[0]!.expectedPv },
      tolerance: { rel: 1e-12 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('case A: six distinct strategies, the survivor benefit at 62 alone first ($415k), each at the worksheet\'s value', () => {
      expectRanking('A', caseA, atA)
    })

    it('case B: the plan\'s COLA drift and cut scale each year, so survivor at 60 then own at 70 ranks first; survivor ages start at 60', () => {
      expectRanking('B', caseB, atB)
      // Without the drift and cut the switch from own at 62 to survivor at 67 would rank first.
      const flat = rankSwitchStrategies(caseB, { discountRate: 0.02, assumptions: matchInflation })
      expect(label(flat[0]!.strategy)).toBe('Own at 62, switch to survivor at 67')
      expect(withinTolerance(flat[0]!.expectedPv, 348_406.9008453028, { rel: 1e-12 })).toBe(true)
    })

    it('case C: a widow of 65 is offered own ages from 65, never a past claim at 62', () => {
      expectRanking('C', caseC, atA)
      const ownAges = rankSwitchStrategies(caseC, atA).flatMap((row) => (row.strategy.ownClaimAge === null ? [] : [row.strategy.ownClaimAge]))
      expect(Math.min(...ownAges)).toBe(65)
    })

    it('strategies that pay the same stream are one: survivor at 62 then own at 62, 67 or 70 is survivor at 62 alone', () => {
      const alone = expectedPvSwitch(caseA, { survivorClaimAge: 62, ownClaimAge: null }, atA)
      for (const ownClaimAge of [62, 67, 70]) {
        expect(expectedPvSwitch(caseA, { survivorClaimAge: 62, ownClaimAge }, atA)).toBe(alone)
      }
      // The worksheet's survivor benefit at 62: the widow's limit after the age
      // reduction, 2,400 x 0.796429 = 1,911.43, below max(1,680, 1,980).
      const survivorAt62 = survivorBenefitMonthly({
        deceasedPiaMonthly: 2_400, deceasedActualMonthly: 1_680, deceasedEverReduced: true,
        survivorClaimAge: { years: 62, months: 0 }, survivorFraMonths: 804,
      })
      expect(withinTolerance(survivorAt62, 1_911.4285714285716, { abs: 1e-9 })).toBe(true)
      expect(withinTolerance(survivorAt62, 1_576.9285714285716, { abs: 1e-9 })).toBe(false)
    })

    it('picks the eligible record with the larger survivor benefit at survivor full retirement age, for a single household only', () => {
      const early: FormerSpouse = { id: 'early', relationship: 'deceased', dob: '1962-01-20', piaMonthly: 2_400, marriageYears: 20, remarriedAtAge: null, deceasedClaimAge: { years: 62, months: 0 } }
      const late: FormerSpouse = { id: 'late', relationship: 'surviving-divorced', dob: '1960-03-05', piaMonthly: 2_200, marriageYears: 12, remarriedAtAge: null, deceasedClaimAge: { years: 70, months: 0 } }
      const input = survivorSwitchingInputs(widowPlan([early, late]), 'p1', 2026)!
      // At survivor FRA: early 1,980 (the limit), late 2,200 x 1.24 = 2,728: late wins.
      expect(input.deceasedPiaMonthly).toBe(2_200)
      expect(input.deceasedEverReduced).toBe(false)
      expect(withinTolerance(input.deceasedActualMonthly, 2_728, { abs: 1e-9 })).toBe(true)
    })

    it('on a tie at survivor full retirement age the first eligible record wins', () => {
      // Both pay 1,650 at survivor FRA: the first as the widow's limit on a PIA of 2,000 claimed at 62,
      // the second as a PIA of 1,650 claimed at full retirement age.
      const limited: FormerSpouse = { id: 'limited', relationship: 'deceased', dob: '1962-01-20', piaMonthly: 2_000, marriageYears: 20, remarriedAtAge: null, deceasedClaimAge: { years: 62, months: 0 } }
      const level: FormerSpouse = { id: 'level', relationship: 'surviving-divorced', dob: '1962-01-20', piaMonthly: 1_650, marriageYears: 12, remarriedAtAge: null, deceasedClaimAge: { years: 67, months: 0 } }
      expect(survivorSwitchingInputs(widowPlan([limited, level]), 'p1', 2026)!.deceasedPiaMonthly).toBe(2_000)
      expect(survivorSwitchingInputs(widowPlan([level, limited]), 'p1', 2026)!.deceasedPiaMonthly).toBe(1_650)
    })

    it('no switching input for a two-person household, or for a benefit paid as a disability benefit from its onset', () => {
      const record: FormerSpouse = { id: 'd', relationship: 'deceased', dob: '1962-01-20', piaMonthly: 2_400, marriageYears: 20, remarriedAtAge: null, deceasedClaimAge: null }
      const couple = couplePlan({ p1Dob: '1964-06-15', p2Dob: '1964-06-15' })
      couple.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 1_500, earnings: null, claimAge: { years: 67, months: 0 }, formerSpouses: [record] }]
      expect(survivorSwitchingInputs(validatePlan(couple), 'p1', 2026)).toBeNull()
      expect(survivorSwitchingInputs(widowPlan([record]), 'p1', 2026)).not.toBeNull()
      const disabled = widowPlan([record])
      const stream = disabled.incomes[0]!
      if (stream.type !== 'socialSecurity') throw new Error('unexpected stream')
      disabled.incomes = [{ ...stream, disability: { onsetAge: 55 } }]
      expect(survivorSwitchingInputs(validatePlan(disabled), 'p1', 2026)).toBeNull()
    })
  },
)
