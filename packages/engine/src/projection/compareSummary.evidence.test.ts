import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { summarizeProjection } from './compare.js'
import type { ProjectionResult, YearResult } from './types.js'

/**
 * The smallest real inputs `summarizeProjection` takes: a validated `Plan` and
 * a `ProjectionResult` whose rows carry only the fields a worksheet names.
 * Every other published field sits at zero, so nothing but the worksheet's own
 * figures can reach the assertion, and the projection types are the production
 * ones — a field the ledger adds later has to be given a value here too.
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

function personAged(plan: Plan, dob: string, retirementAge: number): void {
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge,
    longevity: { planningAge: 95, source: 'manual' },
  }
}

describeCalculation(
  'projection-summary-ending-investable',
  {
    example: {
      inputs: { endingInvestable: 438_765.43, penultimateAnnualInvestableTotal: 472_000.0 },
      expected: { endingInvestable: 438_765.43 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-summary-ending-investable.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-summary-ending-investable.mutation.md',
  },
  ({ example }) => {
    it('republishes the 438765.43 endpoint and not the 472000.00 penultimate balance', () => {
      const endpoint = example.inputs.endingInvestable as number
      const penultimate = example.inputs.penultimateAnnualInvestableTotal as number
      const plan = evidencePlan(() => {})
      const result = projection({
        endYear: 2027,
        years: [
          ledgerYear(2026, { investableTotal: penultimate }),
          ledgerYear(2027, { investableTotal: endpoint }),
        ],
        endingInvestable: endpoint,
      })
      const summary = summarizeProjection(plan, result)
      const expected = example.expected.endingInvestable as number
      expect(
        withinTolerance(summary.endingInvestable, expected, example.tolerance),
        `endingInvestable: actual ${summary.endingInvestable}, worksheet ${expected}`,
      ).toBe(true)
      // The wrong readings the worksheet names: the penultimate balance, and
      // the endpoint added to it.
      expect(summary.endingInvestable).not.toBe(penultimate)
      expect(summary.endingInvestable).not.toBe(endpoint + penultimate)
    })
  },
)

describeCalculation(
  'projection-summary-ending-net-worth',
  {
    example: {
      inputs: { endingNetWorth: 812_345.67, endingInvestable: 438_765.43 },
      expected: { endingNetWorth: 812_345.67 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-summary-ending-net-worth.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-summary-ending-net-worth.mutation.md',
  },
  ({ example }) => {
    it('republishes 812345.67 and never substitutes ending investable', () => {
      const netWorth = example.inputs.endingNetWorth as number
      const investable = example.inputs.endingInvestable as number
      const plan = evidencePlan(() => {})
      const result = projection({
        years: [ledgerYear(2026, { investableTotal: investable, netWorth })],
        endingInvestable: investable,
        endingNetWorth: netWorth,
      })
      const summary = summarizeProjection(plan, result)
      const expected = example.expected.endingNetWorth as number
      expect(
        withinTolerance(summary.endingNetWorth, expected, example.tolerance),
        `endingNetWorth: actual ${summary.endingNetWorth}, worksheet ${expected}`,
      ).toBe(true)
      expect(summary.endingNetWorth).not.toBe(investable)
      expect(summary.endingNetWorth).not.toBe(netWorth + investable)
    })
  },
)

describeCalculation(
  'projection-summary-fi-number',
  {
    example: {
      inputs: {
        startYear: 2026,
        dob: '1980-12-31',
        retirementAge: 50,
        spendingYear: 2030,
        expensesTotal: 80_000,
        tax: 10_000,
        penalties: 2_000,
        inflationPct: 3,
        safeWithdrawalRatePct: 4,
        baseAnnual: 60_000,
      },
      expected: { fiNumber: 2_043_520.21020608, emptyLedgerFiNumber: 1_500_000.0 },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-summary-fi-number.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-summary-fi-number.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    function fiPlan(): Plan {
      return evidencePlan((plan) => {
        personAged(plan, inputs.dob as string, inputs.retirementAge as number)
        plan.assumptions.inflationPct = inputs.inflationPct as number
        plan.assumptions.healthcareExtraInflationPct = 0
        plan.assumptions.safeWithdrawalRatePct = inputs.safeWithdrawalRatePct as number
        plan.expenses.baseAnnual = inputs.baseAnnual as number
      })
    }

    it('deflates 92000 of 2030 outflows four years and divides by 4 percent', () => {
      const year = ledgerYear(inputs.spendingYear as number, {
        expenses: { ...ledgerYear(2026).expenses, total: inputs.expensesTotal as number },
        tax: inputs.tax as number,
        penalties: inputs.penalties as number,
      })
      const summary = summarizeProjection(
        fiPlan(),
        projection({ endYear: inputs.spendingYear as number, years: [year] }),
      )
      const expected = example.expected.fiNumber as number
      expect(
        withinTolerance(summary.fiNumber, expected, example.tolerance),
        `fiNumber: actual ${summary.fiNumber}, worksheet ${expected}`,
      ).toBe(true)
    })

    it('prices an empty ledger from base lifestyle alone', () => {
      const summary = summarizeProjection(fiPlan(), projection({ years: [] }))
      const expected = example.expected.emptyLedgerFiNumber as number
      expect(
        withinTolerance(summary.fiNumber, expected, example.tolerance),
        `empty-ledger fiNumber: actual ${summary.fiNumber}, worksheet ${expected}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'projection-summary-fi-age',
  {
    example: {
      inputs: {
        startYear: 2026,
        dob: '1980-12-31',
        inflationPct: 3,
        fiNumber: 1_000_000,
        rows: [
          { year: 2026, investableTotal: 900_000, deflated: 900_000 },
          { year: 2027, investableTotal: 1_030_000, deflated: 1_000_000 },
          { year: 2028, investableTotal: 1_166_990, deflated: 1_100_000 },
        ],
      },
      expected: { fiYear: 2027, fiAge: 47, emptyLedgerFiYear: null, emptyLedgerFiAge: null },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-summary-fi-age.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-summary-fi-age.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const rows = inputs.rows as { year: number; investableTotal: number }[]
    // The worksheet's upstream FI number is 1,000,000 in 2026 dollars. The
    // summary computes it from the same inputs: a retirement age already
    // attained puts the spending year at the start year, so 40,000 of funded
    // outflows over the 4% lens is exactly the worksheet's 1,000,000.
    const spendingBaseForOneMillion = 40_000

    function fiAgePlan(): Plan {
      return evidencePlan((plan) => {
        personAged(plan, inputs.dob as string, 46)
        plan.assumptions.inflationPct = inputs.inflationPct as number
        plan.assumptions.healthcareExtraInflationPct = 0
        plan.assumptions.safeWithdrawalRatePct = 4
        plan.expenses.baseAnnual = spendingBaseForOneMillion
      })
    }

    it('crosses inclusively in 2027 at age 47 and ignores the later sentinel row', () => {
      const years = rows.map((row, index) =>
        ledgerYear(row.year, {
          investableTotal: row.investableTotal,
          expenses:
            index === 0
              ? { ...ledgerYear(row.year).expenses, total: spendingBaseForOneMillion }
              : ledgerYear(row.year).expenses,
        }),
      )
      const summary = summarizeProjection(fiAgePlan(), projection({ endYear: 2028, years }))
      expect(
        withinTolerance(summary.fiNumber, inputs.fiNumber as number, { abs: 0.000001 }),
        `upstream fiNumber: actual ${summary.fiNumber}, worksheet ${String(inputs.fiNumber)}`,
      ).toBe(true)
      expect(summary.fiYear).toBe(example.expected.fiYear)
      expect(summary.fiAge).toBe(example.expected.fiAge)
    })

    it('publishes null for both on an empty ledger', () => {
      const summary = summarizeProjection(fiAgePlan(), projection({ years: [] }))
      expect(summary.fiYear).toBe(example.expected.emptyLedgerFiYear)
      expect(summary.fiAge).toBe(example.expected.emptyLedgerFiAge)
    })
  },
)

describeCalculation(
  'projection-summary-coast-fire-number',
  {
    example: {
      inputs: {
        startYear: 2026,
        dob: '1980-12-31',
        retirementAge: 50,
        fiNumber: 2_043_520.21020608,
        defaultReturnPct: 7,
        inflationPct: 3,
        horizonYears: 4,
      },
      expected: { coastFireNumber: 1_746_809.64013811 },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-summary-coast-fire-number.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-summary-coast-fire-number.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    // The same 2030 spending row the FI-number worksheet prices, so the
    // upstream quantity this record discounts is the worksheet's own.
    const spendingYear = ledgerYear(2030, {
      expenses: { ...ledgerYear(2030).expenses, total: 80_000 },
      tax: 10_000,
      penalties: 2_000,
    })
    function coastPlan(retirementAge: number): Plan {
      return evidencePlan((plan) => {
        personAged(plan, inputs.dob as string, retirementAge)
        plan.assumptions.inflationPct = inputs.inflationPct as number
        plan.assumptions.healthcareExtraInflationPct = 0
        plan.assumptions.defaultReturnPct = inputs.defaultReturnPct as number
        plan.assumptions.safeWithdrawalRatePct = 4
      })
    }

    it('discounts the FI number four years at the simple real 4 percent', () => {
      const summary = summarizeProjection(
        coastPlan(inputs.retirementAge as number),
        projection({ endYear: 2030, years: [spendingYear] }),
      )
      expect(
        withinTolerance(summary.fiNumber, inputs.fiNumber as number, example.tolerance),
        `upstream fiNumber: actual ${summary.fiNumber}, worksheet ${String(inputs.fiNumber)}`,
      ).toBe(true)
      const expected = example.expected.coastFireNumber as number
      expect(
        withinTolerance(summary.coastFireNumber, expected, example.tolerance),
        `coastFireNumber: actual ${summary.coastFireNumber}, worksheet ${expected}`,
      ).toBe(true)
    })

    it('equals the FI number when retirement age is already attained', () => {
      const summary = summarizeProjection(
        coastPlan(46),
        projection({ endYear: 2030, years: [spendingYear] }),
      )
      expect(
        withinTolerance(summary.coastFireNumber, summary.fiNumber, example.tolerance),
        `zero-horizon coastFireNumber: actual ${summary.coastFireNumber}, fiNumber ${summary.fiNumber}`,
      ).toBe(true)
      expect(
        withinTolerance(summary.coastFireNumber, inputs.fiNumber as number, example.tolerance),
        `zero-horizon coastFireNumber: actual ${summary.coastFireNumber}, worksheet ${String(inputs.fiNumber)}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'projection-summary-average-pre-retirement-savings-rate',
  {
    example: {
      inputs: {
        birthYear: 1964,
        retirementAge: 65,
        targetRetirementYear: 2029,
        qualifyingRates: [
          { year: 2026, ratePct: 10 },
          { year: 2027, ratePct: 20 },
          { year: 2028, ratePct: 35 },
        ],
        nonQualifyingRates: [
          { year: 2029, ratePct: 10 },
          { year: 2030, ratePct: 20 },
          { year: 2031, ratePct: 35 },
        ],
      },
      expected: { averagePct: 21.6666666666667, emptyAveragePct: 0 },
      tolerance: { abs: 1e-12 },
    },
    worksheet:
      'DOCS/calculations/cash-flow-and-summary/projection-summary-average-pre-retirement-savings-rate.md',
    mutation:
      'DOCS/calculations/cash-flow-and-summary/projection-summary-average-pre-retirement-savings-rate.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    // The summary publishes the per-year rates it averages, so the worksheet's
    // rates enter as the ledger rows that produce them: savings over gross
    // income, a rate the production formula clamps to [0, 100].
    // Incomes differ year to year so that the dollar-weighted ratio the
    // record's limits rule out, sum(savings) / sum(income), is 27.142857...%
    // here and cannot pass as the worksheet's unweighted mean.
    const grossIncomes = [50_000, 100_000, 200_000]
    function ratesLedger(rates: { year: number; ratePct: number }[]): YearResult[] {
      return rates.map((row, index) => {
        const grossIncome = grossIncomes[index % grossIncomes.length]!
        return ledgerYear(row.year, {
          contributions: (row.ratePct / 100) * grossIncome,
          incomes: { ...ledgerYear(row.year).incomes, wages: grossIncome, total: grossIncome },
        })
      })
    }
    function savingsPlan(): Plan {
      return evidencePlan((plan) => {
        personAged(plan, '1964-06-15', inputs.retirementAge as number)
      })
    }

    it('averages 10, 20 and 35 over three working years, unweighted', () => {
      const years = ratesLedger(inputs.qualifyingRates as { year: number; ratePct: number }[])
      const summary = summarizeProjection(savingsPlan(), projection({ endYear: 2028, years }))
      expect(summary.savingsRates.map((row) => row.year)).toEqual([2026, 2027, 2028])
      const expected = example.expected.averagePct as number
      const dollarWeightedPct =
        (100 * years.reduce((sum, year) => sum + year.contributions, 0)) /
        years.reduce((sum, year) => sum + year.incomes.total, 0)
      expect(Math.abs(dollarWeightedPct - expected)).toBeGreaterThan(1)
      expect(
        withinTolerance(summary.averagePreRetirementSavingsRatePct, expected, example.tolerance),
        `averagePreRetirementSavingsRatePct: actual ${summary.averagePreRetirementSavingsRatePct}, worksheet ${expected}`,
      ).toBe(true)
    })

    it('publishes exactly 0 when no year is strictly before the target retirement year', () => {
      const years = ratesLedger(inputs.nonQualifyingRates as { year: number; ratePct: number }[])
      const summary = summarizeProjection(
        savingsPlan(),
        projection({ startYear: 2029, endYear: 2031, years }),
      )
      expect(summary.averagePreRetirementSavingsRatePct).toBe(example.expected.emptyAveragePct)
    })
  },
)

describeCalculation(
  'projection-summary-ending-after-tax-estate',
  {
    example: {
      inputs: { endingNetWorth: 812_345.67, endingEstateHeirTax: 73_210.11, endingEstateToCharity: 25_000.0 },
      expected: { withCharity: 714_135.56, withoutCharity: 739_135.56 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/projection-summary-ending-after-tax-estate.md',
    mutation: 'DOCS/calculations/accounts-and-growth/projection-summary-ending-after-tax-estate.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    // The summary resolves both subtrahends from the plan's own accounts, so
    // the worksheet's heir tax and charity amounts enter as balances: a
    // traditional balance at the plan's 25% heir rate is 73,210.11, and a cash
    // account bequeathed entirely to charity is 25,000.00.
    const heirTaxRatePct = 25
    const traditionalBalance = inputs.endingEstateHeirTax / (heirTaxRatePct / 100)
    const charityBalance = inputs.endingEstateToCharity

    function estateRun(withCharity: boolean): { plan: Plan; result: ProjectionResult } {
      const accounts: Account[] = [
        {
          type: 'traditional',
          id: 'trad-1',
          name: 'IRA',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          kind: 'ira',
          balance: traditionalBalance,
          annualContribution: 0,
        },
      ]
      if (withCharity) {
        accounts.push({
          type: 'cash',
          id: 'charity-cash',
          name: 'Bequest cash',
          ownerPersonId: null,
          annualReturnPct: 0,
          balance: charityBalance,
          annualContribution: 0,
          estateBeneficiary: { destination: 'charity', charityPct: 100 },
        })
      }
      const plan = evidencePlan((draft) => {
        personAged(draft, '1958-06-15', 65)
        draft.assumptions.heirTaxRatePct = heirTaxRatePct
        draft.accounts = accounts
      })
      const balances: Record<string, number> = { 'trad-1': traditionalBalance }
      if (withCharity) balances['charity-cash'] = charityBalance
      return {
        plan,
        result: projection({
          years: [ledgerYear(2026, { balances, netWorth: inputs.endingNetWorth })],
          endingNetWorth: inputs.endingNetWorth,
          endingNondeductibleIraBasis: 0,
        }),
      }
    }

    it('nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax', () => {
      const { plan, result } = estateRun(true)
      const summary = summarizeProjection(plan, result)
      expect(
        withinTolerance(summary.endingEstateHeirTax, inputs.endingEstateHeirTax, example.tolerance),
        `endingEstateHeirTax: actual ${summary.endingEstateHeirTax}, worksheet ${inputs.endingEstateHeirTax}`,
      ).toBe(true)
      expect(
        withinTolerance(summary.endingEstateToCharity, inputs.endingEstateToCharity, example.tolerance),
        `endingEstateToCharity: actual ${summary.endingEstateToCharity}, worksheet ${inputs.endingEstateToCharity}`,
      ).toBe(true)
      const expected = example.expected.withCharity as number
      expect(
        withinTolerance(summary.endingAfterTaxEstate, expected, example.tolerance),
        `endingAfterTaxEstate: actual ${summary.endingAfterTaxEstate}, worksheet ${expected}`,
      ).toBe(true)
    })

    it('collapses to net worth minus heir tax with no charity destination', () => {
      const { plan, result } = estateRun(false)
      const summary = summarizeProjection(plan, result)
      expect(summary.endingEstateToCharity).toBe(0)
      const expected = example.expected.withoutCharity as number
      expect(
        withinTolerance(summary.endingAfterTaxEstate, expected, example.tolerance),
        `endingAfterTaxEstate: actual ${summary.endingAfterTaxEstate}, worksheet ${expected}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'projection-summary-estate-heir-tax',
  {
    example: {
      inputs: {
        heirTaxRatePct: 22,
        accounts: [
          {
            label: 'Traditional IRA',
            grossBalance: 300_000.0,
            taxablePretaxBase: 240_000.0,
            charityFractionPct: 10,
            destination: 'non-spouse',
          },
          {
            label: 'Non-spouse HSA',
            grossBalance: 40_000.0,
            taxablePretaxBase: 40_000.0,
            charityFractionPct: 0,
            destination: 'non-spouse',
          },
          {
            label: 'Roth IRA',
            grossBalance: 125_000.0,
            taxablePretaxBase: 0.0,
            charityFractionPct: 0,
            destination: 'non-spouse',
          },
        ],
      },
      // The worksheet's two cases: heir tax on the non-charity slice of each
      // taxable pre-tax base (47,520 + 8,800 + 0), and the same accounts with
      // no charity destination anywhere (52,800 + 8,800 + 0).
      expected: { withCharityDestination: 56_320.0, withoutCharityDestination: 61_600.0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/projection-summary-estate-heir-tax.md',
    mutation: 'DOCS/calculations/taxes/projection-summary-estate-heir-tax.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const rows = inputs.accounts as {
      label: string
      grossBalance: number
      taxablePretaxBase: number
      charityFractionPct: number
      destination: string
    }[]
    const [traditionalRow, hsaRow, rothRow] = rows as [
      (typeof rows)[number],
      (typeof rows)[number],
      (typeof rows)[number],
    ]

    // The worksheet's account facts as plan inputs: the traditional row's
    // 240,000.00 taxable pre-tax base is its 300,000.00 gross net of
    // 60,000.00 of household nondeductible IRA basis; the charity fraction is
    // a charitable bequest of that share of the gross.
    const summaryFor = (charityFractionPct: number) => {
      const plan = evidencePlan((draft) => {
        personAged(draft, '1958-06-15', 65)
        draft.assumptions.heirTaxRatePct = inputs.heirTaxRatePct as number
        draft.accounts = [
          {
            type: 'traditional',
            id: 'trad-1',
            name: traditionalRow.label,
            ownerPersonId: 'p1',
            annualReturnPct: 0,
            kind: 'ira',
            balance: traditionalRow.grossBalance,
            annualContribution: 0,
            ...(charityFractionPct > 0
              ? { estateBeneficiary: { destination: 'charity' as const, charityPct: charityFractionPct } }
              : {}),
          },
          {
            type: 'hsa',
            id: 'hsa-1',
            name: hsaRow.label,
            ownerPersonId: 'p1',
            annualReturnPct: 0,
            balance: hsaRow.grossBalance,
            annualContribution: 0,
            beneficiary: 'nonSpouse',
          },
          {
            type: 'roth',
            id: 'roth-1',
            name: rothRow.label,
            ownerPersonId: 'p1',
            annualReturnPct: 0,
            kind: 'ira',
            balance: rothRow.grossBalance,
            annualContribution: 0,
          },
        ]
      })
      const result = projection({
        years: [
          ledgerYear(2026, {
            balances: {
              'trad-1': traditionalRow.grossBalance,
              'hsa-1': hsaRow.grossBalance,
              'roth-1': rothRow.grossBalance,
            },
          }),
        ],
        endingNondeductibleIraBasis: traditionalRow.grossBalance - traditionalRow.taxablePretaxBase,
      })
      return summarizeProjection(plan, result)
    }

    it('taxes the non-charity slice of each pre-tax base: 47520 + 8800 + 0 = 56320.00 with a 10% bequest to charity', () => {
      const summary = summaryFor(traditionalRow.charityFractionPct)
      const traditional = summary.estateBreakdown.find((row) => row.category === 'traditional')!
      expect(
        withinTolerance(traditional.taxablePretaxBase, traditionalRow.taxablePretaxBase, example.tolerance),
        `traditional taxablePretaxBase: actual ${traditional.taxablePretaxBase}, worksheet ${traditionalRow.taxablePretaxBase}`,
      ).toBe(true)
      const expectedCharity = (traditionalRow.grossBalance * traditionalRow.charityFractionPct) / 100
      expect(
        withinTolerance(traditional.charityAmount, expectedCharity, example.tolerance),
        `traditional charityAmount: actual ${traditional.charityAmount}, worksheet ${expectedCharity}`,
      ).toBe(true)
      const expected = example.expected.withCharityDestination as number
      expect(
        withinTolerance(summary.endingEstateHeirTax, expected, example.tolerance),
        `endingEstateHeirTax: actual ${summary.endingEstateHeirTax}, worksheet ${expected} ` +
          `(per-account actual ${summary.estateBreakdown.map((row) => `${row.category}=${row.heirTax}`).join(', ')})`,
      ).toBe(true)
    })

    it('collapses to base times rate with no charity destination: 52800 + 8800 + 0 = 61600.00', () => {
      const summary = summaryFor(0)
      const expected = example.expected.withoutCharityDestination as number
      expect(
        withinTolerance(summary.endingEstateHeirTax, expected, example.tolerance),
        `endingEstateHeirTax (no charity): actual ${summary.endingEstateHeirTax}, worksheet ${expected}`,
      ).toBe(true)
      expect(summary.endingEstateToCharity).toBe(0)
    })
  },
)

describeCalculation(
  'projection-summary-lifetime-taxes-and-penalties',
  {
    example: {
      inputs: {
        rows: [
          { year: 2026, tax: 12_000.0, penalties: 300.0 },
          { year: 2027, tax: 9_500.25, penalties: 0.0 },
          { year: 2028, tax: 8_000.0, penalties: 1_200.5 },
        ],
      },
      expected: { lifetimeTaxesAndPenalties: 31_000.75 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/projection-summary-lifetime-taxes-and-penalties.md',
    mutation: 'DOCS/calculations/taxes/projection-summary-lifetime-taxes-and-penalties.mutation.md',
  },
  ({ example }) => {
    it('sums tax and penalties across all three years to 31000.75', () => {
      const rows = (example.inputs as Record<string, unknown>).rows as {
        year: number
        tax: number
        penalties: number
      }[]
      const years = rows.map((row) => ledgerYear(row.year, { tax: row.tax, penalties: row.penalties }))
      const summary = summarizeProjection(
        evidencePlan(() => {}),
        projection({ endYear: 2028, years }),
      )
      const expected = example.expected.lifetimeTaxesAndPenalties as number
      expect(
        withinTolerance(summary.lifetimeTaxesAndPenalties, expected, example.tolerance),
        `lifetimeTaxesAndPenalties: actual ${summary.lifetimeTaxesAndPenalties}, worksheet ${expected}`,
      ).toBe(true)
      // The wrong readings: taxes only, and penalties in the final year alone.
      const taxOnly = rows.reduce((sum, row) => sum + row.tax, 0)
      expect(summary.lifetimeTaxesAndPenalties).not.toBe(taxOnly)
      expect(summary.lifetimeTaxesAndPenalties).not.toBe(taxOnly + rows[rows.length - 1]!.penalties)
    })
  },
)
