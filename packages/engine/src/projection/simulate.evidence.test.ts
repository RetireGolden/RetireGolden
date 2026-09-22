import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { couplePlan, setAcaYearContract, singlePersonPlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult } from './types.js'

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(plan: Plan, startYear: number, horizonEndYear: number): ProjectionResult {
  return simulatePlan(validated(plan), {
    startYear,
    horizonEndYear,
    taxCalculator: createFederalTaxCalculator(),
  })
}

function expectWithin(
  actual: number,
  target: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, target, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${target}`,
  ).toBe(true)
}

describeCalculation(
  'income-total-annual',
  {
    example: {
      inputs: {
        wages: 48_000,
        socialSecurity: 18_000,
        pension: 9_000,
        annuity: 3_000,
        tipsLadder: 2_000,
        recurring: 4_000,
        oneTime: 6_000,
        taxableInterest: 700,
        ordinaryDividends: 800,
        qualifiedDividends: 1_500,
        taxableYield: 3_000,
        taxExemptInterest: 500,
      },
      expected: {
        total: 93_500,
        withoutTaxExemptInterestWrongReading: 93_000,
        withoutTaxableYieldWrongReading: 90_500,
        withCharacterComponentsWrongReading: 96_500,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-total-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-total-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const YEAR = 2026

    /**
     * The smallest real plan whose single 2026 row realizes all nine members
     * at the worksheet's amounts. Four separate taxable accounts carry one
     * yield figure each — a pure interest sleeve, a wholly qualified dividend
     * sleeve, a wholly ordinary dividend sleeve and a municipal sleeve — so
     * every published character field lands exactly. The Social Security
     * stream is claimed at this cohort's full retirement age (66 years 8
     * months for a 1958 birth), so the claim factor is exactly 1 and the
     * earnings test withholds nothing against the wage row.
     */
    function incomePlan(): Plan {
      const plan = singlePersonPlan({ dob: '1958-06-15', planningAge: 95 })
      plan.accounts = [
        {
          type: 'taxable', id: 'interest-sleeve', name: 'Interest sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 70_000, costBasis: 70_000, annualContribution: 0,
          interestYieldPct: 1, dividendYieldPct: 0, reinvestDividends: false,
        },
        {
          type: 'taxable', id: 'qualified-sleeve', name: 'Qualified sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 150_000, costBasis: 150_000, annualContribution: 0,
          interestYieldPct: 0, dividendYieldPct: 1, qualifiedRatio: 1, reinvestDividends: false,
        },
        {
          type: 'taxable', id: 'ordinary-sleeve', name: 'Ordinary sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 80_000, costBasis: 80_000, annualContribution: 0,
          interestYieldPct: 0, dividendYieldPct: 1, qualifiedRatio: 0, reinvestDividends: false,
        },
        {
          type: 'taxable', id: 'muni-sleeve', name: 'Municipal sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 50_000, costBasis: 50_000, annualContribution: 0,
          interestYieldPct: 0, dividendYieldPct: 0, taxExemptInterestYieldPct: 1, reinvestDividends: false,
        },
        {
          type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0,
          startAge: 65, monthlyAmount: inputs.pension! / 12, colaPct: 0, survivorPct: 0,
        } as unknown as Account,
        {
          type: 'annuity', id: 'ann', name: 'Annuity', ownerPersonId: 'p1', annualReturnPct: 0,
          startAge: 65, monthlyAmount: inputs.annuity! / 12, colaPct: 0, taxablePct: 100,
        } as unknown as Account,
      ]
      plan.incomes = [
        { type: 'wages', id: 'w', personId: 'p1', annualGross: inputs.wages!, realGrowthPct: 0, endAge: null },
        {
          type: 'socialSecurity', id: 'ss', personId: 'p1',
          piaMonthly: inputs.socialSecurity! / 12, earnings: null,
          claimAge: { years: 66, months: 8 },
        },
        {
          type: 'recurring', id: 'rec', label: 'Rental', annualAmount: inputs.recurring!,
          startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary',
        },
        {
          type: 'oneTime', id: 'one', label: 'Sale', year: YEAR, amount: inputs.oneTime!,
          inflationAdjusted: false, taxTreatment: 'ordinary',
        },
      ]
      plan.incomeFloor = {
        ladders: [
          {
            id: 'ladder', name: 'Bridge', purpose: 'bridge',
            startYear: YEAR, endYear: YEAR, annualRealAmount: inputs.tipsLadder!,
          },
        ],
      }
      return plan
    }

    it('sums the nine members to 93500 and counts the character fields once', () => {
      const result = run(incomePlan(), YEAR, YEAR)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
      const incomes = row.incomes

      // The constructed year really does carry the worksheet's twelve
      // published components.
      for (const key of [
        'wages', 'socialSecurity', 'pension', 'annuity', 'tipsLadder', 'recurring', 'oneTime',
        'taxableInterest', 'ordinaryDividends', 'qualifiedDividends', 'taxableYield', 'taxExemptInterest',
      ] as const) {
        expectWithin(incomes[key], inputs[key]!, example.tolerance, `incomes.${key}`)
      }

      expectWithin(incomes.total, expected.total!, example.tolerance, 'incomes.total')
      // ... and the published total is that composition of its own members.
      expectWithin(
        incomes.total,
        incomes.wages + incomes.socialSecurity + incomes.pension + incomes.annuity +
          incomes.tipsLadder + incomes.recurring + incomes.oneTime + incomes.taxableYield +
          incomes.taxExemptInterest,
        example.tolerance,
        'incomes.total against its own published members',
      )
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.withoutTaxExemptInterestWrongReading!,
        expected.withoutTaxableYieldWrongReading!,
        expected.withCharacterComponentsWrongReading!,
      ]) {
        expect(withinTolerance(incomes.total, wrong, example.tolerance)).toBe(false)
      }
    })
  },
)

describeCalculation(
  'projection-result-ending-investable',
  {
    example: {
      inputs: {
        firstRowInvestableTotal: 510_000,
        lastRowInvestableTotal: 487_250.125,
        yearRowOrder: [2030, 2031],
      },
      expected: { endingInvestable: 487_250.125 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-investable.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-investable.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[]>
    const expected = example.expected as Record<string, number>
    const first = inputs.firstRowInvestableTotal as number
    const last = inputs.lastRowInvestableTotal as number

    it('republishes the 2031 row and not the 2030 one', () => {
      // One cash account that closes 2030 at 510,000 and spends the difference
      // down to 487,250.125 through an uninflated 2031 one-time goal.
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: first, annualContribution: 0 },
      ]
      plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spend-down', year: 2031, amount: first - last }]
      const result = run(plan, 2030, 2031)
      expect(result.years.map((row) => row.year)).toEqual(inputs.yearRowOrder)
      expectWithin(result.years[0]!.investableTotal, first, example.tolerance, '2030 investableTotal')
      expectWithin(result.years[1]!.investableTotal, last, example.tolerance, '2031 investableTotal')

      expectWithin(result.endingInvestable, expected.endingInvestable!, example.tolerance, 'endingInvestable')
      // The worksheet's wrong readings: the first row, and the rows summed.
      expect(withinTolerance(result.endingInvestable, first, example.tolerance)).toBe(false)
      expect(withinTolerance(result.endingInvestable, first + last, example.tolerance)).toBe(false)
    })

  },
)

describeCalculation(
  'projection-result-ending-net-worth',
  {
    example: {
      inputs: {
        firstRowNetWorth: 925_000,
        lastRowNetWorth: 901_375.625,
        yearRowOrder: [2030, 2031],
      },
      expected: { endingNetWorth: 901_375.625 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-net-worth.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-net-worth.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[]>
    const expected = example.expected as Record<string, number>
    const first = inputs.firstRowNetWorth as number
    const last = inputs.lastRowNetWorth as number
    const propertyValue = 415_000

    it('republishes the 2031 row and never substitutes ending investable', () => {
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: first - propertyValue, annualContribution: 0 },
        {
          type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0,
          value: propertyValue, plannedSaleYear: null, expectedNetProceeds: null,
        } as unknown as Account,
      ]
      plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spend-down', year: 2031, amount: first - last }]
      const result = run(plan, 2030, 2031)
      expect(result.years.map((row) => row.year)).toEqual(inputs.yearRowOrder)
      expectWithin(result.years[0]!.netWorth, first, example.tolerance, '2030 netWorth')
      expectWithin(result.years[1]!.netWorth, last, example.tolerance, '2031 netWorth')

      expectWithin(result.endingNetWorth, expected.endingNetWorth!, example.tolerance, 'endingNetWorth')
      // The worksheet's wrong readings: the first row, and ending investable,
      // which on this run differs by the whole property value.
      expect(withinTolerance(result.endingNetWorth, first, example.tolerance)).toBe(false)
      expect(withinTolerance(result.endingNetWorth, result.endingInvestable, example.tolerance)).toBe(false)
      expectWithin(
        result.endingNetWorth - result.endingInvestable,
        propertyValue,
        example.tolerance,
        'net worth above ending investable',
      )
    })

  },
)

describeCalculation(
  'year-result-contributions',
  {
    example: {
      inputs: {
        year: 2026,
        ownerAAge: 40,
        ownerBAge: 45,
        ownerADesired: 6_000,
        ownerBDesired: 9_000,
        ownerAWages: 50_000,
        ownerBWages: 50_000,
        generalInflationPct: 0,
        iraLimit2026: 7_500,
      },
      expected: {
        contributions: 13_500,
        ownerACredited: 6_000,
        ownerBCredited: 7_500,
        bothDesiredWrongReading: 15_000,
        householdWideLimitWrongReading: 7_500,
        underFiftyCatchUpWrongReading: 14_600,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/year-result-contributions.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/year-result-contributions.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const YEAR = inputs.year!

    it('trims Owner B to the 7500 IRA limit and leaves Owner A at 6000', () => {
      // The 2026 base IRA limit is read from the pack rather than written in.
      expect(packForYear(YEAR).pack.contributionLimits.ira).toBe(inputs.iraLimit2026)

      const plan = couplePlan({
        p1Dob: `${YEAR - inputs.ownerAAge!}-06-15`,
        p2Dob: `${YEAR - inputs.ownerBAge!}-06-15`,
        p1PlanningAge: 95,
        p2PlanningAge: 95,
      })
      plan.accounts = [
        {
          type: 'traditional', id: 'ira-a', name: 'IRA A', ownerPersonId: 'p1',
          annualReturnPct: 0, kind: 'ira', balance: 0,
          annualContribution: inputs.ownerADesired!,
        } as unknown as Account,
        {
          type: 'traditional', id: 'ira-b', name: 'IRA B', ownerPersonId: 'p2',
          annualReturnPct: 0, kind: 'ira', balance: 0,
          annualContribution: inputs.ownerBDesired!,
        } as unknown as Account,
      ]
      plan.incomes = [
        { type: 'wages', id: 'w1', personId: 'p1', annualGross: inputs.ownerAWages!, realGrowthPct: 0, endAge: null },
        { type: 'wages', id: 'w2', personId: 'p2', annualGross: inputs.ownerBWages!, realGrowthPct: 0, endAge: null },
      ]
      plan.assumptions.inflationPct = inputs.generalInflationPct!

      const result = run(plan, YEAR, YEAR)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      expectWithin(row.contributions, expected.contributions!, example.tolerance, 'contributions')
      // Each owner's own IRA really carries its own credited amount.
      expectWithin(
        row.balances['ira-a'] ?? 0, expected.ownerACredited!, example.tolerance, 'IRA A ending balance',
      )
      expectWithin(
        row.balances['ira-b'] ?? 0, expected.ownerBCredited!, example.tolerance, 'IRA B ending balance',
      )
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.bothDesiredWrongReading!,
        expected.householdWideLimitWrongReading!,
        expected.underFiftyCatchUpWrongReading!,
      ]) {
        expect(withinTolerance(row.contributions, wrong, example.tolerance)).toBe(false)
      }
    })
  },
)

describeCalculation(
  'year-result-employer-match',
  {
    example: {
      inputs: {
        year: 2026,
        wages: 75_000,
        electiveDeferralLanded: 24_500,
        matchCapPctOfPay: 50,
        matchPct: 200,
        section415cLimit2026: 72_000,
        otherAnnualAdditions: 0,
      },
      expected: {
        employerMatch: 47_500,
        payCap: 37_500,
        rawMatch: 49_000,
        remainingSection415cRoom: 47_500,
        ignoringSection415cWrongReading: 49_000,
        matchOnAllWagesWrongReading: 150_000,
        payCapAfterMultiplyWrongReading: 37_500,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/year-result-employer-match.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/year-result-employer-match.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const YEAR = inputs.year!

    it('caps the 49000 raw match at the 47500 of §415(c) room left after the deferral', () => {
      // The 2026 §415(c) limit is read from the pack rather than written in.
      expect(packForYear(YEAR).pack.contributionLimits.section415cLimit).toBe(inputs.section415cLimit2026)
      expect(packForYear(YEAR).pack.contributionLimits.employee401k).toBe(inputs.electiveDeferralLanded)

      // A 45-year-old, so no age-50 catch-up can widen the deferral or the room.
      const plan = singlePersonPlan({ dob: `${YEAR - 45}-06-15`, planningAge: 95 })
      plan.accounts = [
        {
          type: 'traditional', id: 'plan-401k', name: 'Employer plan', ownerPersonId: 'p1',
          annualReturnPct: 0, kind: 'employer', balance: 0,
          annualContribution: inputs.electiveDeferralLanded!,
          employerMatch: { matchPct: inputs.matchPct!, capPctOfPay: inputs.matchCapPctOfPay! },
        } as unknown as Account,
      ]
      plan.incomes = [
        { type: 'wages', id: 'w', personId: 'p1', annualGross: inputs.wages!, realGrowthPct: 0, endAge: null },
      ]

      const result = run(plan, YEAR, YEAR)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      // The constructed year really lands the worksheet's elective deferral.
      expectWithin(row.contributions, inputs.electiveDeferralLanded!, example.tolerance, 'contributions')
      expectWithin(row.employerMatch, expected.employerMatch!, example.tolerance, 'employerMatch')
      // The remaining room really is the §415(c) limit less that deferral.
      expectWithin(
        inputs.section415cLimit2026! - inputs.electiveDeferralLanded!,
        expected.remainingSection415cRoom!,
        example.tolerance,
        'remaining §415(c) room',
      )
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.ignoringSection415cWrongReading!,
        expected.matchOnAllWagesWrongReading!,
        expected.payCapAfterMultiplyWrongReading!,
      ]) {
        expect(withinTolerance(row.employerMatch, wrong, example.tolerance)).toBe(false)
      }
    })
  },
)

describeCalculation(
  'surplus-invested-annual',
  {
    example: {
      inputs: {
        acceptedCashInflows: 100_000,
        expensesTotal: 50_000,
        contributions: 10_000,
        tax: 8_000,
        penalties: 2_000,
        cashAccountIds: ['cash-b', 'cash-a'],
        negativeResidualCase: -5_000,
      },
      expected: {
        surplusInvested: 30_000,
        destinationAccountId: 'cash-a',
        negativeResidualSurplus: 0,
        omittingContributionsWrongReading: 40_000,
        penaltiesTwiceWrongReading: 28_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/surplus-invested-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/surplus-invested-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string[]>
    const expected = example.expected as Record<string, number | string>
    const YEAR = 2026
    const inflows = inputs.acceptedCashInflows as number
    const expensesTotal = inputs.expensesTotal as number
    const contributions = inputs.contributions as number
    const tax = inputs.tax as number
    const penalties = inputs.penalties as number
    const cashIds = inputs.cashAccountIds as string[]

    /**
     * The worksheet's five published members as one real 2026 ledger row.
     *
     * Cash inflows are split into an 80,000 ordinary wage and a 20,000
     * tax-free recurring stream, so a flat 10% calculator prices the year's
     * tax at exactly the worksheet's 8,000 while the household's cash inflow
     * is exactly 100,000. The 2,000 of penalties are the IRC 4974 excise on a
     * completed five-year deadline year (opening benefit 12,000, 4,000
     * distributed by the 2026 deadline): that obligation is priced from
     * observed legal-year facts and replays no cash, which is the only way a
     * year can carry penalties and still end with a residual — an early-
     * withdrawal penalty is charged on need-based withdrawals, and a year with
     * a surplus takes none. The owner is 55, so no Medicare or marketplace
     * premium can move `expenses.total` off the worksheet's 50,000.
     */
    function surplusPlan(baseAnnual: number, contributionAmount: number): Plan {
      const plan = singlePersonPlan({ dob: `${YEAR - 55}-06-15`, planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: cashIds[0]!, name: 'Cash B', ownerPersonId: null, annualReturnPct: 0, balance: 0, annualContribution: 0 },
        { type: 'cash', id: cashIds[1]!, name: 'Cash A', ownerPersonId: null, annualReturnPct: 0, balance: 0, annualContribution: 0 },
        {
          type: 'taxable', id: 'brokerage', name: 'Brokerage', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 0, costBasis: 0,
          interestYieldPct: 0, dividendYieldPct: 0, reinvestDividends: true,
          annualContribution: contributionAmount,
        } as unknown as Account,
        {
          type: 'roth', id: 'inherited-roth', name: 'Inherited Roth', ownerPersonId: 'p1',
          annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0,
          inherited: {
            ownerDeathYear: 2021,
            ownerDeathDate: '2021-03-01',
            decedentHadStartedRmds: false,
            beneficiary: {
              beneficiaryClass: 'estate',
              soleBeneficiary: true,
              provenance: { source: 'worksheet fixture', asOf: '2026-01-01' },
            },
            verifiedNonDesignatedRegime: {
              classification: 'non-designated-beneficiary',
              schedule: 'five-year',
              provenance: { source: 'worksheet fixture', asOf: '2026-01-01' },
            },
            completedDeadlineObservation: {
              taxYear: YEAR,
              openingBenefit: 12_000,
              distributedByDeadline: 4_000,
              legalDistributionDeadline: `${YEAR}-12-31`,
              observedAsOfDate: `${YEAR + 1}-01-15`,
              provenance: { source: 'worksheet fixture', asOf: `${YEAR + 1}-02-01` },
            },
          },
        } as unknown as Account,
      ]
      plan.incomes = [
        { type: 'wages', id: 'w', personId: 'p1', annualGross: 80_000, realGrowthPct: 0, endAge: null },
        {
          type: 'recurring', id: 'taxfree', label: 'Tax-free receipt', annualAmount: 20_000,
          startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'none',
        },
      ]
      plan.expenses.baseAnnual = baseAnnual
      return plan
    }

    function surplusRun(baseAnnual: number, contributionAmount: number): ProjectionResult {
      return simulatePlan(validated(surplusPlan(baseAnnual, contributionAmount)), {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFlatTaxCalculator(10),
      })
    }

    it('publishes 30000 of residual cash and credits it to the lowest-id cash account', () => {
      const result = surplusRun(expensesTotal, contributions)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      // The constructed year really carries the worksheet's five members.
      expectWithin(row.incomes.total, inflows, example.tolerance, 'accepted cash inflows')
      expectWithin(row.expenses.total, expensesTotal, example.tolerance, 'expenses.total')
      expectWithin(row.contributions, contributions, example.tolerance, 'contributions')
      expectWithin(row.tax, tax, example.tolerance, 'tax')
      expectWithin(row.penalties, penalties, example.tolerance, 'penalties')

      expectWithin(
        row.surplusInvested,
        expected.surplusInvested as number,
        example.tolerance,
        'surplusInvested',
      )
      // The destination is the lowest-id cash account, not the first one listed.
      expectWithin(
        row.balances[expected.destinationAccountId as string] ?? 0,
        expected.surplusInvested as number,
        example.tolerance,
        'destination cash account ending balance',
      )
      expect(row.balances[cashIds[0]!] ?? 0).toBe(0)

      // The worksheet's first two wrong readings.
      expect(
        withinTolerance(
          row.surplusInvested,
          expected.omittingContributionsWrongReading as number,
          example.tolerance,
        ),
      ).toBe(false)
      expect(
        withinTolerance(
          row.surplusInvested,
          expected.penaltiesTwiceWrongReading as number,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('floors a 5000 negative residual at zero instead of publishing it', () => {
      // The same year with enough extra required lifestyle to turn the
      // 30,000 residual into exactly the worksheet's -5,000.
      const result = surplusRun(expensesTotal + 35_000, contributions)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
      const residual =
        row.incomes.total - row.expenses.total - row.contributions - row.tax - row.penalties
      expectWithin(
        residual,
        inputs.negativeResidualCase as number,
        example.tolerance,
        'residual before the floor',
      )
      expect(row.surplusInvested).toBe(expected.negativeResidualSurplus as number)
    })
  },
)

describeCalculation(
  'year-result-tax-exempt-interest',
  {
    example: {
      inputs: {
        taxableAccountStartBalance: 200_000,
        taxExemptInterestYieldPct: 2,
        attestedHouseholdTotal: 6_000,
        accountReturnPct: 0,
        inflationPct: 0,
      },
      expected: {
        caseAGenerated: 4_000,
        caseBPublished: 6_000,
        sumWrongReading: 10_000,
        alwaysGeneratedWrongReading: 4_000,
        nonCashWrongReading: 0,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/year-result-tax-exempt-interest.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/year-result-tax-exempt-interest.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const YEAR = 2026

    /** One municipal sleeve at the worksheet's balance and yield, nothing else. */
    function muniPlan(): Plan {
      const plan = singlePersonPlan({ dob: `${YEAR - 60}-06-15`, planningAge: 95 })
      plan.accounts = [
        {
          type: 'taxable', id: 'muni', name: 'Municipal sleeve', ownerPersonId: 'p1',
          annualReturnPct: inputs.accountReturnPct!,
          balance: inputs.taxableAccountStartBalance!,
          costBasis: inputs.taxableAccountStartBalance!,
          interestYieldPct: 0, dividendYieldPct: 0,
          taxExemptInterestYieldPct: inputs.taxExemptInterestYieldPct!,
          reinvestDividends: false, annualContribution: 0,
        } as unknown as Account,
      ]
      plan.assumptions.inflationPct = inputs.inflationPct!
      return plan
    }

    it('publishes the 4000 the accounts generate when no ACA contract is known', () => {
      const result = run(muniPlan(), YEAR, YEAR)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
      expectWithin(
        row.taxExemptInterest, expected.caseAGenerated!, example.tolerance, 'Case A taxExemptInterest',
      )
      // Tax-exempt interest is cash-real: it is one of the income total's members.
      expectWithin(
        row.incomes.taxExemptInterest, expected.caseAGenerated!, example.tolerance,
        'Case A incomes.taxExemptInterest',
      )
      // The worksheet's third wrong reading.
      expect(row.taxExemptInterest).not.toBe(expected.nonCashWrongReading!)
    })

    it('publishes the larger attested 6000 in a known ACA contract year, never the sum', () => {
      const plan = muniPlan()
      setAcaYearContract(plan, { year: YEAR, monthlyEnrollment: 500 })
      const contract = plan.expenses.healthcare.acaYears![0]!
      plan.expenses.healthcare.acaYears = [{
        ...contract,
        taxExemptInterest: { state: 'known', amount: inputs.attestedHouseholdTotal! },
      }]
      const result = run(plan, YEAR, YEAR)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      expectWithin(
        row.taxExemptInterest, expected.caseBPublished!, example.tolerance, 'Case B taxExemptInterest',
      )
      // The worksheet's first two wrong readings.
      expect(withinTolerance(row.taxExemptInterest, expected.sumWrongReading!, example.tolerance)).toBe(false)
      expect(
        withinTolerance(row.taxExemptInterest, expected.alwaysGeneratedWrongReading!, example.tolerance),
      ).toBe(false)
    })
  },
)
