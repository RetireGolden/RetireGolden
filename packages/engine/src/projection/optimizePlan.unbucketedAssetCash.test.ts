/**
 * Cash from an asset the optimizer's LP carries in no bucket (decision
 * D-OPTIMIZER-SOLVER-OUTPUT, part 6): a planned property sale's net proceeds,
 * on the exact-basis path and on the legacy `expectedNetProceeds` path, and a
 * permanent-life death benefit. Before the decision the LP saw none of it, so
 * a plan holding a home it sells, or a policy that pays out, was solved as a
 * household poorer by the whole amount from that year on.
 *
 * Each figure the probe books is read against the ledger's own cash-flow line
 * for the same dollars (`captureAnnualCashFlow`, which moves no economic
 * output), so the bar is the ledger and not this code. The LP comparison
 * follows `optimizePlan.remainingSides.test.ts`: the shipped input against the
 * same input with the new term zeroed, so a difference can only be the term.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { buildOptimizerModel, optimizeSchedule, type OptimizerInput } from '../strategies/optimizer.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { buildOptimizerInput } from './optimizePlan.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `unbucketed-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }

/**
 * A couple at 76 and 74 with no inflation and no returns, so every dollar is
 * the same dollar in every year: Pat's planning age, 78, is 2028, the year a
 * permanent-life policy on Pat pays; the home sells in 2027.
 */
function couplePlan(options: {
  sale: 'exact' | 'legacy' | 'none'
  deathBenefit: number
}): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: 'p1', name: 'Pat', dob: '1950-01-01', sex: 'average', retirementAge: 65, longevity: { planningAge: 78, source: 'manual' } },
    { id: 'p2', name: 'Sam', dob: '1952-01-01', sex: 'average', retirementAge: 65, longevity: { planningAge: 80, source: 'manual' } },
  ]
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 60_000
  plan.accounts = [
    { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 600_000, annualContribution: 0 },
    { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
  ]
  if (options.sale !== 'none') {
    plan.accounts.push({
      type: 'property',
      id: 'home',
      name: 'Home',
      ownerPersonId: null,
      annualReturnPct: null,
      value: 400_000,
      plannedSaleYear: 2027,
      expectedNetProceeds: options.sale === 'legacy' ? 300_000 : null,
      ...(options.sale === 'exact' ? { costBasis: 150_000, sellingCostPct: 6, primaryResidence: true } : {}),
    } as Account)
  }
  plan.insurance =
    options.deathBenefit > 0
      ? [
          {
            kind: 'permanentLife',
            id: 'whole-life',
            name: 'Whole life',
            insured: 'p1',
            beneficiary: 'estate',
            annualPremium: 0,
            premiumMode: 'paidUp',
            deathBenefit: options.deathBenefit,
            cashValue: 0,
            cashValueMode: 'flatRate',
            cashValueGrowthPct: 0,
          },
        ]
      : []
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/** The ledger's own cash-flow lines of one kind, summed per year. */
function ledgerLines(plan: Plan, kind: string): Map<number, number> {
  const out = new Map<number, number>()
  for (const year of simulatePlan(plan, { ...opts, captureAnnualCashFlow: true }).years) {
    for (const line of year.cashFlow?.sourceLines ?? []) {
      if (line.kind === kind) out.set(year.year, (out.get(year.year) ?? 0) + line.amountPlanDollars)
    }
  }
  return out
}

function withoutAssetCash(input: OptimizerInput): OptimizerInput {
  return { ...input, years: input.years.map((year) => ({ ...year, unbucketedAssetCash: 0 })) }
}

const cashRow = (lp: string, t: number) => lp.split('\n').find((line) => line.trim().startsWith(`cash${t}:`))!
const nonCashRows = (lp: string) => lp.split('\n').filter((line) => !/^\s*cash\d+:/.test(line)).join('\n')

describe('cash from assets the optimizer carries in no bucket', () => {
  it('books each kind in its year, at the ledger\'s own figure', () => {
    const cases: [Plan, string, number][] = [
      [couplePlan({ sale: 'exact', deathBenefit: 0 }), 'propertySaleProceeds', 2027],
      [couplePlan({ sale: 'legacy', deathBenefit: 0 }), 'legacyPropertySaleDeposit', 2027],
      [couplePlan({ sale: 'none', deathBenefit: 250_000 }), 'lifeInsuranceDeathBenefit', 2028],
    ]
    for (const [plan, kind, year] of cases) {
      const ledger = ledgerLines(plan, kind)
      expect([...ledger.keys()], kind).toEqual([year])
      const input = buildOptimizerInput(plan, opts)
      for (const lpYear of input.years) {
        expect(lpYear.unbucketedAssetCash, `${kind} ${lpYear.year}`).toBe(ledger.get(lpYear.year) ?? 0)
      }
    }
    // The figures themselves: the legacy path deposits the stated proceeds,
    // the policy its face amount, and the exact-basis sale its price net of
    // the 6% selling costs (no inflation, so the price is the value).
    expect(ledgerLines(couplePlan({ sale: 'legacy', deathBenefit: 0 }), 'legacyPropertySaleDeposit').get(2027)).toBe(300_000)
    expect(ledgerLines(couplePlan({ sale: 'none', deathBenefit: 250_000 }), 'lifeInsuranceDeathBenefit').get(2028)).toBe(250_000)
    expect(ledgerLines(couplePlan({ sale: 'exact', deathBenefit: 0 }), 'propertySaleProceeds').get(2027)).toBeCloseTo(376_000, 6)
  })

  it('adds them together in a year that has more than one', () => {
    // The legacy sale moved to 2028, the year the policy pays.
    const plan = couplePlan({ sale: 'legacy', deathBenefit: 250_000 })
    const home = plan.accounts.find((account) => account.id === 'home')! as Extract<Account, { type: 'property' }>
    home.plannedSaleYear = 2028
    const input = buildOptimizerInput(plan, opts)
    expect(input.years.find((year) => year.year === 2028)!.unbucketedAssetCash).toBe(550_000)
    expect(input.years.filter((year) => year.year !== 2028).every((year) => year.unbucketedAssetCash === 0)).toBe(true)
  })

  it('moves the cash rows by exactly the cash, and nothing else', () => {
    const plan = couplePlan({ sale: 'legacy', deathBenefit: 250_000 })
    const shipped = buildOptimizerInput(plan, opts)
    const shippedLp = buildOptimizerModel(shipped).lp
    const regressedLp = buildOptimizerModel(withoutAssetCash(shipped)).lp
    expect(nonCashRows(shippedLp)).toBe(nonCashRows(regressedLp))
    for (let t = 0; t < shipped.years.length; t++) {
      // The right-hand side is spending less the cash the household has, so the
      // cash LOWERS it by its own amount.
      const moved = Number(cashRow(regressedLp, t).split('=')[1]!) - Number(cashRow(shippedLp, t).split('=')[1]!)
      expect(moved, String(shipped.years[t]!.year)).toBeCloseTo(shipped.years[t]!.unbucketedAssetCash ?? 0, 6)
    }
  })

  it('is byte-identical on a plan with no property sale and no permanent-life policy', () => {
    const plan = couplePlan({ sale: 'none', deathBenefit: 0 })
    const shipped = buildOptimizerInput(plan, opts)
    expect(shipped.years.every((year) => year.unbucketedAssetCash === 0)).toBe(true)
    const absent: OptimizerInput = {
      ...shipped,
      years: shipped.years.map((year) => {
        const rest = { ...year }
        delete rest.unbucketedAssetCash
        return rest
      }),
    }
    expect(buildOptimizerModel(shipped).lp).toBe(buildOptimizerModel(absent).lp)
  })

  it('leaves the solve richer by the cash, not poorer', async () => {
    const shippedInput = buildOptimizerInput(couplePlan({ sale: 'legacy', deathBenefit: 250_000 }), opts)
    const shipped = await optimizeSchedule(shippedInput)
    const regressed = await optimizeSchedule(withoutAssetCash(shippedInput))
    expect(shipped.status).toBe('optimal')
    expect(regressed.status).toBe('optimal')
    // No growth and no inflation: the 550,000 the household receives ends in
    // the tax-free bucket or spares a taxable draw, so the objective rises by
    // at least the cash net of the heir rate's haircut on what it spares.
    expect(shipped.endingAfterTax! - regressed.endingAfterTax!).toBeGreaterThan(550_000 * 0.75)
  })
})
