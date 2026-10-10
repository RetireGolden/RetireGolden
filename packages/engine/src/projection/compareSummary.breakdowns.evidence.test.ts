import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { summarizeProjection } from './compare.js'
import type { ProjectionResult, YearResult } from './types.js'

/**
 * The two per-row breakdowns every published summary carries, which
 * RetireGolden-MCP returns whole (`estateBreakdown[]` and `savingsRates[]`),
 * asserted where the engine computes them: `summarizeProjection` over a
 * ledger whose rows carry only the worksheet's fields. Every other published
 * field sits at zero, and the projection types are the production ones, so a
 * field the ledger adds later has to be given a value here too.
 */
function ledgerYear(year: number, overrides: Partial<YearResult> = {}): YearResult {
  return {
    year,
    people: [],
    filingStatus: 'single',
    incomes: {
      wages: 0,
      socialSecurity: 0,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
      recurring: 0,
      oneTime: 0,
      taxableInterest: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      taxableYield: 0,
      taxExemptInterest: 0,
      total: 0,
    },
    expenses: {
      baseSpending: 0,
      oneTimeGoals: 0,
      debtService: 0,
      propertyCosts: 0,
      healthcare: 0,
      insurancePremiums: 0,
      careCost: 0,
      ltcBenefit: 0,
      requiredSpending: 0,
      targetSpending: 0,
      idealSpending: 0,
      excessSpending: 0,
      intendedSpending: 0,
      guardrailFactor: 1,
      total: 0,
    },
    contributions: 0,
    employerMatch: 0,
    rmd: 0,
    sepp: 0,
    inheritedDistribution: 0,
    inheritedTraditionalDistribution: 0,
    qcd: 0,
    rothConversion: 0,
    penalties: 0,
    magi: 0,
    medicarePremiums: 0,
    irmaaSurcharge: 0,
    irmaaTier: 0,
    amt: 0,
    ltcgZeroHeadroom: 0,
    ssEarningsTestWithheld: 0,
    ssdiPaid: 0,
    tax: 0,
    withdrawals: { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, total: 0 },
    realizedGains: 0,
    taxableYield: 0,
    taxExemptInterest: 0,
    capitalLossUsedAgainstGains: 0,
    capitalLossUsedAgainstOrdinary: 0,
    capitalLossCarryforwardRemaining: 0,
    surplusInvested: 0,
    shortfall: 0,
    requiredShortfall: 0,
    targetShortfall: 0,
    idealShortfall: 0,
    excessShortfall: 0,
    guardrailAction: 'hold',
    flexibleGoals: {
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 0,
      fundedAmount: 0,
      unfundedAmount: 0,
    },
    balances: {},
    investableTotal: 0,
    insuranceCashValue: 0,
    ladderValue: 0,
    deathBenefit: 0,
    hecmDraw: 0,
    hecmLoanBalance: 0,
    netWorth: 0,
    netPortfolioNeed: 0,
    ...overrides,
  }
}

function projection(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    startYear: 2026,
    endYear: 2026,
    years: [],
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
    ...overrides,
  }
}

/** A validated plan: `parsePlan` is the production gate every real plan passes. */
function evidencePlan(mutate: (plan: Plan) => void): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `ev-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  mutate(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const ESTATE_WORKSHEET = 'DOCS/calculations/accounts-and-growth/estate-account-breakdown.md'
const estateRows = worksheetExpectedRows(ESTATE_WORKSHEET)
const ESTATE_COLUMNS = [
  'category',
  'destination',
  'grossBalance',
  'taxablePretaxBase',
  'heirTaxRatePct',
  'charityAmount',
  'heirTax',
  'netToHeirs',
] as const
const AMOUNT_COLUMNS = ['grossBalance', 'taxablePretaxBase', 'heirTaxRatePct', 'charityAmount', 'heirTax', 'netToHeirs'] as const
type EstateExpectation = { name: string } & Record<(typeof ESTATE_COLUMNS)[number], string>
/** The worksheet's Expected rows for one case, in the table's order, keyed by column. */
function estateCase(caseLabel: 'Case 1' | 'Case 2'): EstateExpectation[] {
  return [...estateRows]
    .filter(([label]) => label.startsWith(caseLabel + ', ') && !label.endsWith('sum of the rows'))
    .map(([label, cells]) => ({
      name: label.slice(caseLabel.length + 2),
      ...(Object.fromEntries(ESTATE_COLUMNS.map((column, index) => [column, cells[index]!])) as Record<(typeof ESTATE_COLUMNS)[number], string>),
    }))
}
const estateSum = (caseLabel: 'Case 1' | 'Case 2', column: (typeof ESTATE_COLUMNS)[number]): number =>
  worksheetNumber(estateRows.get(`${caseLabel}, sum of the rows`)![ESTATE_COLUMNS.indexOf(column)]!)

describeCalculation(
  'estate-account-breakdown',
  {
    example: {
      inputs: {
        example: 'annuity-purchases-estate',
        heirTaxRatePct: 28,
        caseTwo: {
          endingNondeductibleIraBasis: 49_000,
          heirTaxByClass: { traditional: 32, hsa: 24 },
          charityPctOf401k: 25,
        },
      },
      expected: { case1: estateCase('Case 1'), case2: estateCase('Case 2') },
      tolerance: { abs: 0.005 },
    },
    worksheet: ESTATE_WORKSHEET,
    mutation: 'DOCS/calculations/accounts-and-growth/estate-account-breakdown.mutation.md',
  },
  ({ example }) => {
    const caseTwo = example.inputs.caseTwo as {
      endingNondeductibleIraBasis: number
      heirTaxByClass: { traditional: number; hsa: number }
      charityPctOf401k: number
    }

    /**
     * The library example's household and accounts
     * (planner-ui examples/buildAnnuityEstate.ts), with case 2's changes; the
     * breakdown reads only the plan's accounts and heir rates and the last
     * ledger row, so nothing else of the example is needed.
     */
    function annuityEstatePlan(variant: 'as built' | 'case 2'): Plan {
      return evidencePlan((plan) => {
        plan.household = {
          ...plan.household,
          filingStatus: 'marriedFilingJointly',
          state: 'FL',
          people: [
            { id: 'jordan', name: 'Jordan', dob: '1961-03-10', sex: 'male', retirementAge: 65, longevity: { planningAge: 90, source: 'manual' } },
            { id: 'taylor', name: 'Taylor', dob: '1963-11-22', sex: 'female', retirementAge: 64, longevity: { planningAge: 93, source: 'manual' } },
          ],
        }
        plan.assumptions.heirTaxRatePct = example.inputs.heirTaxRatePct as number
        if (variant === 'case 2') plan.assumptions.heirTaxByClass = caseTwo.heirTaxByClass
        const accounts: Account[] = [
          { type: 'cash', id: 'cash', name: 'Emergency cash', ownerPersonId: null, annualReturnPct: 2, balance: 315_000, annualContribution: 0 },
          { type: 'traditional', id: 'tira', name: 'Jordan traditional IRA', ownerPersonId: 'jordan', annualReturnPct: null, kind: 'ira', balance: 915_000, annualContribution: 0, estateBeneficiary: { destination: 'spouse' } },
          {
            type: 'annuity',
            id: 'spia',
            name: 'SPIA (non-qualified)',
            ownerPersonId: 'jordan',
            annualReturnPct: null,
            startAge: 66,
            monthlyAmount: 1450,
            colaPct: 0,
            taxablePct: 35,
            purchase: { year: 2027, premium: 220_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
            estateBeneficiary: { destination: 'charity', charityPct: 100 },
          },
          {
            type: 'annuity',
            id: 'qlac',
            name: 'QLAC (qualified deferred)',
            ownerPersonId: 'jordan',
            annualReturnPct: null,
            startAge: 80,
            monthlyAmount: 920,
            colaPct: 2.5,
            taxablePct: 100,
            purchase: { year: 2028, premium: 135_000, fundingAccountId: 'tira', taxQualification: 'qualified', qlac: true },
          },
          {
            type: 'traditional',
            id: '401k',
            name: 'Jordan 401k',
            ownerPersonId: 'jordan',
            annualReturnPct: null,
            kind: 'employer',
            balance: 310_000,
            annualContribution: 0,
            estateBeneficiary:
              variant === 'case 2'
                ? { destination: 'charity', charityPct: caseTwo.charityPctOf401k }
                : { destination: 'nonSpouse' },
          },
          { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: 'jordan', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 },
          { type: 'pension', id: 'pension', name: 'Pension (Jordan)', ownerPersonId: 'jordan', annualReturnPct: null, startAge: 65, monthlyAmount: 1500, colaPct: 2, survivorPct: 50 },
        ]
        if (variant === 'case 2') {
          accounts.push(
            { type: 'hsa', id: 'hsa', name: 'Jordan HSA', ownerPersonId: 'jordan', annualReturnPct: null, balance: 40_000, annualContribution: 0, beneficiary: 'nonSpouse' },
            { type: 'equityComp', id: 'rsu', name: 'Jordan RSUs', ownerPersonId: 'jordan', annualReturnPct: null, balance: 20_000, costBasis: 15_000, annualContribution: 0, vestingMode: 'final', vestDate: null },
          )
        }
        plan.accounts = accounts
      })
    }

    /** The worksheet's last-row balances, by account name. */
    const lastRowBalances = {
      'as built': { cash: 315_000, tira: 915_000, '401k': 310_000, roth: 50_000 },
      'case 2': { cash: 315_000, tira: 915_000, '401k': 310_000, roth: 0, hsa: 40_000, rsu: 20_000 },
    } as const

    function breakdownOf(variant: 'as built' | 'case 2') {
      const result = projection({
        years: [ledgerYear(2026, { balances: { ...lastRowBalances[variant] } })],
        endingNondeductibleIraBasis: variant === 'case 2' ? caseTwo.endingNondeductibleIraBasis : 0,
      })
      return summarizeProjection(annuityEstatePlan(variant), result, { conversionFreeRun: null })
    }

    function expectRows(variant: 'as built' | 'case 2', expected: EstateExpectation[]): void {
      const summary = breakdownOf(variant)
      expect(summary.estateBreakdown.map((row) => row.name)).toEqual(expected.map((row) => row.name))
      for (const [index, want] of expected.entries()) {
        const row = summary.estateBreakdown[index]!
        expect(row.category, `${want.name} category`).toBe(want.category)
        expect(row.destination, `${want.name} destination`).toBe(want.destination)
        for (const column of AMOUNT_COLUMNS) {
          const worksheet = worksheetNumber(want[column])
          expect(
            withinTolerance(row[column], worksheet, example.tolerance),
            `${want.name} ${column}: actual ${row[column]}, worksheet ${worksheet}`,
          ).toBe(true)
        }
      }
      const caseLabel = variant === 'as built' ? 'Case 1' : 'Case 2'
      expect(
        withinTolerance(summary.endingEstateHeirTax, estateSum(caseLabel, 'heirTax'), example.tolerance),
        `endingEstateHeirTax: actual ${summary.endingEstateHeirTax}, worksheet sum ${estateSum(caseLabel, 'heirTax')}`,
      ).toBe(true)
      expect(
        withinTolerance(summary.endingEstateToCharity, estateSum(caseLabel, 'charityAmount'), example.tolerance),
        `endingEstateToCharity: actual ${summary.endingEstateToCharity}, worksheet sum ${estateSum(caseLabel, 'charityAmount')}`,
      ).toBe(true)
    }

    it('splits the example as built: the spouse IRA keeps its base untaxed, the 401k pays 86800, the SPIA has no row', () => {
      expectRows('as built', example.expected.case1 as EstateExpectation[])
    })

    it('spreads the basis, takes charity off the gross and taxes the rest by class: the 401k nets 161076', () => {
      expectRows('case 2', example.expected.case2 as EstateExpectation[])
    })
  },
)

const SAVINGS_WORKSHEET = 'DOCS/calculations/cash-flow-and-summary/projection-summary-savings-rate-annual.md'
const savingsRows = worksheetExpectedRows(SAVINGS_WORKSHEET)

describeCalculation(
  'projection-summary-savings-rate-annual',
  {
    example: {
      inputs: {
        example: 'early-career-match',
        rows: [
          { year: 2026, contributions: 9_000, employerMatch: 2_600, surplusInvested: 1_400, wages: 65_000, socialSecurity: 0 },
          { year: 2062, contributions: 0, employerMatch: 0, surplusInvested: 0, wages: 0, socialSecurity: 0 },
          { year: 2070, contributions: 0, employerMatch: 0, surplusInvested: 6_000, wages: 0, socialSecurity: 24_000 },
          { year: 2076, contributions: 0, employerMatch: 0, surplusInvested: 30_000, wages: 0, socialSecurity: 24_000 },
        ],
      },
      expected: Object.fromEntries([...savingsRows].map(([year, cells]) => [year, cells[0]])),
      tolerance: { abs: 1e-9 },
    },
    worksheet: SAVINGS_WORKSHEET,
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-summary-savings-rate-annual.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.rows as {
      year: number
      contributions: number
      employerMatch: number
      surplusInvested: number
      wages: number
      socialSecurity: number
    }[]

    it('publishes 20, 0, 25 and 100 for the four years, each with its year', () => {
      // Alex of the early-career-match example (planner-ui
      // examples/buildEarlyCareerMatch.ts); the rates read only the rows.
      const plan = evidencePlan((draft) => {
        draft.household.people[0] = {
          id: 'alex',
          name: 'Alex',
          dob: '2001-01-01',
          sex: 'average',
          retirementAge: 60,
          longevity: { planningAge: 90, source: 'manual' },
        }
      })
      const years = rows.map((row) =>
        ledgerYear(row.year, {
          contributions: row.contributions,
          employerMatch: row.employerMatch,
          surplusInvested: row.surplusInvested,
          incomes: {
            ...ledgerYear(row.year).incomes,
            wages: row.wages,
            socialSecurity: row.socialSecurity,
            total: row.wages + row.socialSecurity,
          },
        }),
      )
      const summary = summarizeProjection(plan, projection({ endYear: 2076, years }), { conversionFreeRun: null })
      const expected = example.expected as Record<string, string>
      expect(summary.savingsRates.map((entry) => entry.year)).toEqual(Object.keys(expected).map(Number))
      for (const entry of summary.savingsRates) {
        const worksheet = worksheetNumber(expected[String(entry.year)]!)
        expect(
          withinTolerance(entry.ratePct, worksheet, example.tolerance),
          `${entry.year} ratePct: actual ${entry.ratePct}, worksheet ${worksheet}`,
        ).toBe(true)
      }
    })
  },
)
