import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { summarizeProjection } from './compare.js'
import type { ProjectionResult, YearResult } from './types.js'

/**
 * The two RetireGolden-MCP batch_evaluate objectives the engine publishes
 * (cumulative_tax and ending_trad), asserted where the engine computes them:
 * `summarizeProjection` over a ledger whose rows carry only the worksheet's
 * fields. Every other published field sits at zero, and the projection types
 * are the production ones, so a field the ledger adds later has to be given a
 * value here too.
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

function projection(years: YearResult[]): ProjectionResult {
  return {
    startYear: years[0]?.year ?? 2026,
    endYear: years[years.length - 1]?.year ?? 2026,
    years,
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
  }
}

/** A validated plan with one person: `parsePlan` is the production gate every real plan passes. */
function evidencePlan(mutate: (plan: Plan) => void): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `ev-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1970-12-31',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 95, source: 'manual' },
  }
  mutate(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'mcp-batch-cumulative-tax-objective',
  {
    example: {
      inputs: {
        rows: [
          { year: 2026, tax: 18_250.4, penalties: 0, amt: 0, irmaaSurcharge: 0 },
          { year: 2027, tax: 21_030.15, penalties: 2_500.0, amt: 1_200.0, irmaaSurcharge: 0 },
          { year: 2028, tax: 0, penalties: 0, amt: 0, irmaaSurcharge: 0 },
          { year: 2029, tax: 24_410.62, penalties: 1_000.35, amt: 0, irmaaSurcharge: 1_105.2 },
        ],
      },
      expected: {
        objective: 67_191.52,
        taxOnly: 63_691.17,
        amtCountedTwice: 68_391.52,
        irmaaCountedAsTax: 68_296.72,
        finalYearOnly: 25_410.97,
        penaltiesInFinalYearOnly: 64_691.52,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/mcp-batch-cumulative-tax-objective.md',
    mutation: 'DOCS/calculations/taxes/mcp-batch-cumulative-tax-objective.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.rows as { year: number; tax: number; penalties: number; amt: number; irmaaSurcharge: number }[]
    const expected = example.expected as Record<string, number>
    const years = rows.map((row) =>
      ledgerYear(row.year, { tax: row.tax, penalties: row.penalties, amt: row.amt, irmaaSurcharge: row.irmaaSurcharge }),
    )

    it('sums tax plus penalties over the four years to 67,191.52, penalties in, the AMT once and no IRMAA', () => {
      const summary = summarizeProjection(evidencePlan(() => {}), projection(years), { conversionFreeRun: null })
      expect(
        withinTolerance(summary.lifetimeTaxesAndPenalties, expected.objective!, example.tolerance),
        `objective: actual ${summary.lifetimeTaxesAndPenalties}, worksheet ${expected.objective}`,
      ).toBe(true)
      // The worksheet's wrong readings, each a cent or more away.
      for (const reading of ['taxOnly', 'amtCountedTwice', 'irmaaCountedAsTax', 'finalYearOnly', 'penaltiesInFinalYearOnly']) {
        expect(
          withinTolerance(summary.lifetimeTaxesAndPenalties, expected[reading]!, example.tolerance),
          `the objective must not read as ${reading} (${expected[reading]})`,
        ).toBe(false)
      }
    })

    it("agrees with the pinned adapter's own reduction, tax then penalties year by year, within half a cent", () => {
      // RetireGolden-MCP 3197d359 src/adapter.ts#batchEvaluate, mcp-v0.10.0's arithmetic, which the census documented until its pin moved to b2c7f717 (0.12.0).
      const adapter = years.reduce((sum, year) => sum + year.tax + year.penalties, 0)
      const summary = summarizeProjection(evidencePlan(() => {}), projection(years), { conversionFreeRun: null })
      expect(withinTolerance(adapter, expected.objective!, example.tolerance)).toBe(true)
      expect(
        withinTolerance(summary.lifetimeTaxesAndPenalties, adapter, example.tolerance),
        `engine ${summary.lifetimeTaxesAndPenalties}, adapter ${adapter}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'mcp-batch-ending-traditional-objective',
  {
    example: {
      inputs: {
        accounts: [
          { id: 'cash-1', type: 'cash', penultimate: 12_000, last: 12_000 },
          { id: 'tax-1', type: 'taxable', penultimate: 85_000, last: 85_000 },
          { id: 'ira-1', type: 'traditional', kind: 'ira', penultimate: 250_000, last: 240_500.25 },
          { id: 'k401-1', type: 'traditional', kind: 'employer', penultimate: 320_000, last: 310_250.5 },
          { id: 'roth-1', type: 'roth', kind: 'ira', penultimate: 150_000, last: 150_000 },
          { id: 'hsa-1', type: 'hsa', penultimate: 22_000, last: 22_000 },
        ],
        heirTaxRatePct: 25,
      },
      expected: {
        objective: 550_750.75,
        penultimateRow: 570_000,
        hsaIncluded: 572_750.75,
        rothIncluded: 700_750.75,
        firstTraditionalOnly: 240_500.25,
        afterHeirTax: 413_063.06,
        everyInvestableBalance: 819_750.75,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/mcp-batch-ending-traditional-objective.md',
    mutation: 'DOCS/calculations/accounts-and-growth/mcp-batch-ending-traditional-objective.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.accounts as { id: string; type: string; kind?: string; penultimate: number; last: number }[]
    const expected = example.expected as Record<string, number>

    function accountsPlan(): Plan {
      return evidencePlan((plan) => {
        plan.assumptions.heirTaxRatePct = example.inputs.heirTaxRatePct as number
        plan.accounts = rows.map((row) => {
          const base = { id: row.id, name: row.id, ownerPersonId: null, annualReturnPct: 0, annualContribution: 0, balance: 0 }
          if (row.type === 'taxable') return { ...base, type: 'taxable', costBasis: 0 } as unknown as Account
          if (row.type === 'traditional' || row.type === 'roth') {
            return { ...base, type: row.type, kind: row.kind, ownerPersonId: 'p1' } as unknown as Account
          }
          if (row.type === 'hsa') return { ...base, type: 'hsa', ownerPersonId: 'p1' } as unknown as Account
          return { ...base, type: 'cash' } as unknown as Account
        })
      })
    }

    const years = [
      ledgerYear(2030, { balances: Object.fromEntries(rows.map((row) => [row.id, row.penultimate])) }),
      ledgerYear(2031, { balances: Object.fromEntries(rows.map((row) => [row.id, row.last])) }),
    ]

    it('adds the last row of the IRA and the 401(k), 240,500.25 + 310,250.50 = 550,750.75, and nothing else', () => {
      const summary = summarizeProjection(accountsPlan(), projection(years), { conversionFreeRun: null })
      const objective = summary.endingByCategory.traditional
      expect(
        withinTolerance(objective, expected.objective!, example.tolerance),
        `objective: actual ${objective}, worksheet ${expected.objective}`,
      ).toBe(true)
      for (const reading of ['penultimateRow', 'hsaIncluded', 'rothIncluded', 'firstTraditionalOnly', 'afterHeirTax', 'everyInvestableBalance']) {
        expect(
          withinTolerance(objective, expected[reading]!, example.tolerance),
          `the objective must not read as ${reading} (${expected[reading]})`,
        ).toBe(false)
      }
    })

    it("agrees with the pinned adapter's walk over the last row's balance entries within half a cent", () => {
      // RetireGolden-MCP 3197d359 src/adapter.ts#batchEvaluate, mcp-v0.10.0's arithmetic, which the census documented until its pin moved to b2c7f717 (0.12.0).
      const plan = accountsPlan()
      const last = years[years.length - 1]!
      const adapter = Object.entries(last.balances).reduce((sum, [id, balance]) => {
        const account = plan.accounts.find((candidate) => candidate.id === id)
        return account?.type === 'traditional' ? sum + balance : sum
      }, 0)
      const summary = summarizeProjection(plan, projection(years), { conversionFreeRun: null })
      expect(withinTolerance(adapter, expected.objective!, example.tolerance)).toBe(true)
      expect(
        withinTolerance(summary.endingByCategory.traditional, adapter, example.tolerance),
        `engine ${summary.endingByCategory.traditional}, adapter ${adapter}`,
      ).toBe(true)
    })
  },
)
