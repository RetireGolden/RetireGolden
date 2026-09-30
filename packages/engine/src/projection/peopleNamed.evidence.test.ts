/**
 * Evidence for the schema-v7 rules that name a person where the ledger used to
 * read list position (decision D-PEOPLE-ORDER): whose age the spending phases
 * follow (spending-phase-person), whose age and life a pension or annuity is
 * paid on (guaranteed-income-owner), and when a joint account takes
 * contributions (joint-account-contributions). Each block runs a real
 * simulatePlan on the worksheet's household, listed with the person the old
 * rule would have read first, and reads the worksheet's Expected table.
 */
import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)

function expectedOf(worksheet: string) {
  const rows = worksheetExpectedRows(worksheet)
  return {
    rows,
    value: (label: string): number => {
      const cells = rows.get(label)
      if (cells === undefined) throw new Error(`${worksheet} has no Expected row "${label}"`)
      return worksheetNumber(cells[0]!)
    },
  }
}

function couple(people: Plan['household']['people'], mutate: (plan: Plan) => void): Plan {
  const plan = createEmptyPlan({ newId: () => 'named-evidence', now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = people
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  mutate(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function yearOf(years: readonly YearResult[], year: number): YearResult {
  const row = years.find((y) => y.year === year)
  if (row === undefined) throw new Error(`no ${year} row`)
  return row
}

const reversed = (plan: Plan): Plan => ({ ...structuredClone(plan), household: { ...plan.household, people: [...plan.household.people].reverse() } })
const run = (plan: Plan) => simulatePlan(plan, { startYear: 2026, taxCalculator: noTax }).years
const tolerance = { abs: 0.005 }

const alex = { id: 'alex', name: 'Alex', dob: '1962-04-15', sex: 'male' as const, retirementAge: 66, longevity: { planningAge: 92, source: 'manual' as const } }

// ---------------------------------------------------------------------------
const PHASES = 'DOCS/calculations/spending-and-withdrawals/spending-phase-person.md'
const phases = expectedOf(PHASES)

describeCalculation(
  'spending-phase-person',
  {
    example: {
      inputs: { people: ['Alex 1962-04-15 (listed first)', 'Sam 1964-09-02'], baseAnnual: 60_000, phases: [[75, 0.9], [85, 0.8]], phasesAgeOf: 'sam' },
      expected: Object.fromEntries([...phases.rows].map(([label, cells]) => [label, cells[0]])),
      tolerance,
    },
    worksheet: PHASES,
    mutation: 'DOCS/calculations/spending-and-withdrawals/spending-phase-person.mutation.md',
  },
  () => {
    const plan = couple(
      [alex, { id: 'sam', name: 'Sam', dob: '1964-09-02', sex: 'female', retirementAge: 64, longevity: { planningAge: 95, source: 'manual' } }],
      (p) => {
        p.expenses.baseAnnual = 60_000
        p.expenses.phases = [{ fromAge: 75, multiplier: 0.9 }, { fromAge: 85, multiplier: 0.8 }]
        p.expenses.phasesAgeOf = 'sam'
        p.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 4_000_000, annualContribution: 0 }]
      },
    )

    it('follows Sam’s age, the person the plan names, not Alex’s, who is listed first', () => {
      const years = run(plan)
      for (const [label, year] of [['Base spending, 2037', 2037], ['Base spending, 2038', 2038], ['Base spending, 2039', 2039], ['Base spending, 2049', 2049]] as const) {
        const actual = yearOf(years, year).expenses.baseSpending
        expect(withinTolerance(actual, phases.value(label), tolerance), `${label}: actual ${actual}`).toBe(true)
      }
    })

    it('gives the same spending with the people listed the other way round', () => {
      expect(run(reversed(plan)).map((y) => y.expenses.baseSpending)).toEqual(run(plan).map((y) => y.expenses.baseSpending))
    })

    // The different-family review of #769: Sam is both the named person and the
    // younger one, and outlives Alex, so two more households name Alex.
    const namingAlex = (alexPlanningAge: number): Plan => couple(
      [{ ...alex, longevity: { planningAge: alexPlanningAge, source: 'manual' } }, { id: 'sam', name: 'Sam', dob: '1964-09-02', sex: 'female', retirementAge: 64, longevity: { planningAge: 95, source: 'manual' } }],
      (p) => {
        p.expenses.baseAnnual = 60_000
        p.expenses.phases = [{ fromAge: 75, multiplier: 0.9 }, { fromAge: 85, multiplier: 0.8 }]
        p.expenses.phasesAgeOf = 'alex'
        p.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 4_000_000, annualContribution: 0 }]
      },
    )
    const expectSpending = (years: readonly YearResult[], label: string, year: number): void => {
      const actual = yearOf(years, year).expenses.baseSpending
      expect(withinTolerance(actual, phases.value(label), tolerance), `${label}: actual ${actual}`).toBe(true)
    }

    it('case Older: follows Alex’s age when the plan names Alex, the older person, not the younger one’s', () => {
      const years = run(namingAlex(92))
      expectSpending(years, 'Older: base spending, 2036', 2036)
      expectSpending(years, 'Older: base spending, 2037', 2037)
      expectSpending(years, 'Older: base spending, 2047', 2047)
    })

    it('case Death: keeps following Alex’s age after he dies in 2038, neither stopping the phases nor following Sam’s', () => {
      const years = run(namingAlex(76))
      expect(yearOf(years, 2039).people.find((row) => row.personId === 'alex')?.alive).toBe(false)
      expectSpending(years, 'Death: base spending, 2038', 2038)
      expectSpending(years, 'Death: base spending, 2046', 2046)
      expectSpending(years, 'Death: base spending, 2047', 2047)
    })
  },
)

// ---------------------------------------------------------------------------
const OWNER = 'DOCS/calculations/cash-flow-and-summary/guaranteed-income-owner.md'
const owner = expectedOf(OWNER)

describeCalculation(
  'guaranteed-income-owner',
  {
    example: {
      inputs: {
        people: ['Alex 1962-04-15 (listed first), planning age 92', 'Sam 1964-09-02, planning age 70'],
        pension: { owner: 'sam', startAge: 65, monthlyAmount: 2_000, survivorPct: 50 },
        annuity: { owner: 'sam', startAge: 66, monthlyAmount: 1_000, payoutForm: 'lifeOnly' },
      },
      expected: Object.fromEntries([...owner.rows].map(([label, cells]) => [label, cells[0]])),
      tolerance,
    },
    worksheet: OWNER,
    mutation: 'DOCS/calculations/cash-flow-and-summary/guaranteed-income-owner.mutation.md',
  },
  () => {
    const sam = { id: 'sam', name: 'Sam', dob: '1964-09-02', sex: 'female' as const, retirementAge: 64, longevity: { planningAge: 70, source: 'manual' as const } }
    const incomes: Account[] = [
      { type: 'pension', id: 'pension', name: 'Sam pension', ownerPersonId: 'sam', annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 50 },
      { type: 'annuity', id: 'annuity', name: 'Sam annuity', ownerPersonId: 'sam', annualReturnPct: null, startAge: 66, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100, payoutForm: { kind: 'lifeOnly' } },
    ]
    const plan = couple([alex, sam], (p) => {
      p.expenses.baseAnnual = 30_000
      p.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 3_000_000, annualContribution: 0 }, ...incomes]
    })

    it('starts and ends Sam’s pension and annuity on Sam’s age and life', () => {
      const years = run(plan)
      const check = (label: string, value: number) =>
        expect(withinTolerance(value, owner.value(label), tolerance), `${label}: actual ${value}`).toBe(true)
      check('Pension income, 2028', yearOf(years, 2028).incomes.pension)
      check('Pension income, 2029', yearOf(years, 2029).incomes.pension)
      check('Pension income, 2035', yearOf(years, 2035).incomes.pension)
      check('Annuity income, 2029', yearOf(years, 2029).incomes.annuity)
      check('Annuity income, 2030', yearOf(years, 2030).incomes.annuity)
      check('Annuity income, 2034', yearOf(years, 2034).incomes.annuity)
      check('Annuity income, 2035', yearOf(years, 2035).incomes.annuity)
    })

    it('gives the same income with the people listed the other way round', () => {
      const incomesOf = (p: Plan) => run(p).map((y) => [y.incomes.pension, y.incomes.annuity])
      expect(incomesOf(reversed(plan))).toEqual(incomesOf(plan))
    })

    it('refuses a pension or annuity that names no owner, in plain words', () => {
      const unnamed = { ...structuredClone(plan), accounts: plan.accounts.map((a) => (a.id === 'annuity' ? { ...a, ownerPersonId: null } : a)) }
      const parsed = parsePlan(unnamed)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.issues.join('; ')).toContain('an annuity must name its annuitant')
    })
  },
)

// ---------------------------------------------------------------------------
const JOINT = 'DOCS/calculations/cash-flow-and-summary/joint-account-contributions.md'
const joint = expectedOf(JOINT)

describeCalculation(
  'joint-account-contributions',
  {
    example: {
      inputs: {
        people: ['Pat 1966-01-01 (listed first), no wages, planning age 62', 'Robin 1970-01-01, wages 80,000 to age 64, planning age 90'],
        jointCash: { annualContribution: 6_000 },
        scheduledCase: { wages: 'none', jointCash: { contributionSchedule: [{ annualAmount: 5_000, fromAge: 60, toAge: 64, escalationPct: 0 }], contributionScheduleAgeOf: 'pat' } },
      },
      expected: Object.fromEntries([...joint.rows].map(([label, cells]) => [label, cells[0]])),
      tolerance,
    },
    worksheet: JOINT,
    mutation: 'DOCS/calculations/cash-flow-and-summary/joint-account-contributions.mutation.md',
  },
  () => {
    const plan = couple(
      [
        { id: 'pat', name: 'Pat', dob: '1966-01-01', sex: 'average', retirementAge: 60, longevity: { planningAge: 62, source: 'manual' } },
        { id: 'robin', name: 'Robin', dob: '1970-01-01', sex: 'average', retirementAge: 64, longevity: { planningAge: 90, source: 'manual' } },
      ],
      (p) => {
        p.expenses.baseAnnual = 20_000
        p.incomes = [{ type: 'wages', id: 'wages-robin', personId: 'robin', annualGross: 80_000, endAge: 64, realGrowthPct: 0 }]
        p.accounts = [
          { type: 'cash', id: 'buffer', name: 'Buffer', ownerPersonId: 'robin', annualReturnPct: 0, balance: 2_000_000, annualContribution: 0 },
          { type: 'cash', id: 'joint', name: 'Joint savings', ownerPersonId: null, annualReturnPct: 0, balance: 0, annualContribution: 6_000 },
        ]
      },
    )

    it('keeps contributing while the household has wages, after Pat, listed first, has stopped earning and died', () => {
      const years = run(plan)
      for (const [label, year] of [['Joint balance, end of 2026', 2026], ['Joint balance, end of 2028', 2028], ['Joint balance, end of 2029', 2029], ['Joint balance, end of 2033', 2033], ['Joint balance, end of 2034', 2034]] as const) {
        const actual = yearOf(years, year).balances['joint'] ?? 0
        expect(withinTolerance(actual, joint.value(label), tolerance), `${label}: actual ${actual}`).toBe(true)
      }
    })

    it('gives the same contributions with the people listed the other way round', () => {
      expect(run(reversed(plan)).map((y) => y.balances['joint'])).toEqual(run(plan).map((y) => y.balances['joint']))
    })

    // Case B: a schedule by Pat's age, no wages in the household, Pat dying inside the schedule.
    const scheduled = couple(
      [
        { id: 'pat', name: 'Pat', dob: '1966-01-01', sex: 'average', retirementAge: 60, longevity: { planningAge: 62, source: 'manual' } },
        { id: 'robin', name: 'Robin', dob: '1970-01-01', sex: 'average', retirementAge: 64, longevity: { planningAge: 90, source: 'manual' } },
      ],
      (p) => {
        p.expenses.baseAnnual = 20_000
        p.incomes = []
        p.accounts = [
          { type: 'cash', id: 'buffer', name: 'Buffer', ownerPersonId: 'robin', annualReturnPct: 0, balance: 2_000_000, annualContribution: 0 },
          {
            type: 'cash', id: 'joint', name: 'Joint savings', ownerPersonId: null, annualReturnPct: 0, balance: 0, annualContribution: 0,
            contributionSchedule: [{ annualAmount: 5_000, fromAge: 60, toAge: 64, escalationPct: 0 }], contributionScheduleAgeOf: 'pat',
          },
        ]
      },
    )

    it('takes a joint schedule by the named person\'s age with no household wages, after that person dies too', () => {
      const years = run(scheduled)
      expect(years.every((y) => y.incomes.wages === 0)).toBe(true)
      const labels = [['Scheduled, joint balance, end of 2026', 2026], ['Scheduled, joint balance, end of 2028', 2028], ['Scheduled, joint balance, end of 2029', 2029], ['Scheduled, joint balance, end of 2030', 2030], ['Scheduled, joint balance, end of 2031', 2031]] as const
      for (const [label, year] of labels) {
        const actual = yearOf(years, year).balances['joint'] ?? 0
        expect(withinTolerance(actual, joint.value(label), tolerance), `${label}: actual ${actual}`).toBe(true)
      }
      // A wage test on the schedule would take nothing; stopping at Pat's death would leave 15,000 at the end of 2030.
      expect(yearOf(years, 2030).balances['joint']).not.toBe(0)
      expect(yearOf(years, 2030).balances['joint']).not.toBe(15_000)
      expect(run(reversed(scheduled)).map((y) => y.balances['joint'])).toEqual(years.map((y) => y.balances['joint']))
    })
  },
)
