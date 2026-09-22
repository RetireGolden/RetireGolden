import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { couplePlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'

const START_YEAR = 2028

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/**
 * A two-person household whose first member's planning age is 65, so the run's
 * own longevity kills the pension/annuity owner after 2028 and leaves the
 * survivor alive to age 95. No accounts, no inflation and no returns, so the
 * stream under test is the only thing that moves the year.
 */
function survivorHousehold(contract: Account): Plan {
  const plan = couplePlan({
    p1Dob: '1963-06-15',
    p2Dob: '1966-06-15',
    p1PlanningAge: 65,
    p2PlanningAge: 95,
  })
  plan.accounts = [contract]
  return plan
}

function yearsOf(plan: Plan, endYear: number): YearResult[] {
  return simulatePlan(validated(plan), {
    startYear: START_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFederalTaxCalculator(),
  }).years
}

function rowAt(years: YearResult[], year: number): YearResult {
  const row = years.find((entry) => entry.year === year)
  if (row === undefined) throw new Error(`missing projection year ${year}`)
  return row
}

describeCalculation(
  'income-pension-annual',
  {
    example: {
      inputs: {
        pensionStartAge: 65,
        ownerWouldBeAge: 67,
        ownerAlive: false,
        spouseAlive: true,
        monthlyAmountAtStart: 2_000,
        colaPct: 3,
        survivorPct: 50,
      },
      expected: { pension: 12_730.8, fullPostColaWrongReading: 25_461.6, livingOwnerYear: 24_000 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-pension-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-pension-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | boolean>
    const expected = example.expected as Record<string, number>

    function pensionYears(): YearResult[] {
      return yearsOf(
        survivorHousehold({
          type: 'pension',
          id: 'pen-1',
          name: 'Pension',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          startAge: inputs.pensionStartAge as number,
          monthlyAmount: inputs.monthlyAmountAtStart as number,
          colaPct: inputs.colaPct as number,
          survivorPct: inputs.survivorPct as number,
        } as unknown as Account),
        2030,
      )
    }

    it('continues 50 percent of a twice-COLAd pension to the survivor: 12730.80', () => {
      const years = pensionYears()
      const year = rowAt(years, 2030)
      // The constructed year really is the worksheet's: the owner would be 67,
      // is dead, and the spouse is alive.
      const owner = year.people.find((person) => person.personId === 'p1')
      const spouse = year.people.find((person) => person.personId === 'p2')
      expect(owner?.ageAttained).toBe(inputs.ownerWouldBeAge)
      expect(owner?.alive).toBe(inputs.ownerAlive)
      expect(spouse?.alive).toBe(inputs.spouseAlive)

      expect(
        withinTolerance(year.incomes.pension, expected.pension!, example.tolerance),
        `pension: actual ${year.incomes.pension}, worksheet ${expected.pension}`,
      ).toBe(true)
      // The worksheet's first wrong reading: the full post-COLA pension after
      // the owner dies. The third: gating on the deceased owner alone, paying 0.
      expect(withinTolerance(year.incomes.pension, expected.fullPostColaWrongReading!, example.tolerance)).toBe(false)
      expect(year.incomes.pension).toBeGreaterThan(0)
    })

    it('pays the whole annualized benefit while the owner is alive', () => {
      const year = rowAt(pensionYears(), START_YEAR)
      expect(year.people.find((person) => person.personId === 'p1')?.alive).toBe(true)
      expect(
        withinTolerance(year.incomes.pension, expected.livingOwnerYear!, example.tolerance),
        `first-year pension: actual ${year.incomes.pension}, worksheet ${expected.livingOwnerYear}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'income-annuity-annual',
  {
    example: {
      inputs: {
        startAge: 65,
        ownerWouldBeAge: 66,
        ownerAlive: false,
        otherMemberAlive: true,
        monthlyAmountAtStart: 1_500,
        colaPct: 2,
        payoutForm: 'jointSurvivor',
        jointSurvivorPct: 60,
      },
      expected: { annuity: 11_016, fullPostColaWrongReading: 18_360, noColaWrongReading: 10_800, livingOwnerYear: 18_000 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-annuity-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-annuity-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string | boolean>
    const expected = example.expected as Record<string, number>

    function annuityYears(): YearResult[] {
      return yearsOf(
        survivorHousehold({
          type: 'annuity',
          id: 'ann-1',
          name: 'Annuity',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          startAge: inputs.startAge as number,
          monthlyAmount: inputs.monthlyAmountAtStart as number,
          colaPct: inputs.colaPct as number,
          taxablePct: 100,
          payoutForm: { kind: 'jointSurvivor', survivorPct: inputs.jointSurvivorPct as number },
        } as unknown as Account),
        2029,
      )
    }

    it('continues 60 percent of a once-COLAd annuity to the joint annuitant: 11016.00', () => {
      const year = rowAt(annuityYears(), 2029)
      const owner = year.people.find((person) => person.personId === 'p1')
      const other = year.people.find((person) => person.personId === 'p2')
      expect(owner?.ageAttained).toBe(inputs.ownerWouldBeAge)
      expect(owner?.alive).toBe(inputs.ownerAlive)
      expect(other?.alive).toBe(inputs.otherMemberAlive)

      expect(
        withinTolerance(year.incomes.annuity, expected.annuity!, example.tolerance),
        `annuity: actual ${year.incomes.annuity}, worksheet ${expected.annuity}`,
      ).toBe(true)
      // The worksheet's three wrong readings: life-only behaviour paying 0,
      // the full post-COLA amount, and 60% of the monthly amount without COLA.
      expect(year.incomes.annuity).toBeGreaterThan(0)
      expect(withinTolerance(year.incomes.annuity, expected.fullPostColaWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(year.incomes.annuity, expected.noColaWrongReading!, example.tolerance)).toBe(false)
    })

    it('pays the whole annualized contract in its start year', () => {
      const year = rowAt(annuityYears(), START_YEAR)
      expect(year.people.find((person) => person.personId === 'p1')?.alive).toBe(true)
      expect(
        withinTolerance(year.incomes.annuity, expected.livingOwnerYear!, example.tolerance),
        `first-year annuity: actual ${year.incomes.annuity}, worksheet ${expected.livingOwnerYear}`,
      ).toBe(true)
    })
  },
)
