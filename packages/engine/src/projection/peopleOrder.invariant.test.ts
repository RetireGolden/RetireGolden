/**
 * No figure depends on the order a plan lists its people in (decision
 * D-PEOPLE-ORDER, rule R8), nor on what their ids are called.
 *
 * Two transforms, over a probe set built to reach every rule that used to read
 * list position: the spending phases, pensions and annuities in every payout
 * form and funding shape, joint cash, brokerage and equity-compensation
 * contributions (plain and scheduled, different retirement years, the same
 * birth date, a 20-year gap), the ABW survival horizon at 25-, 30- and
 * 35-year gaps in both orders of age, equal Social Security PIAs, a surviving
 * spouse, and a QLAC starting at 86 for a December birth on either spouse.
 *
 * 1. Reverse `household.people`, leaving everything else (every owner id,
 *    `phasesAgeOf` and `contributionScheduleAgeOf` included): the parse
 *    outcome, the whole ledger and summary (arrays keyed by id), and every
 *    Monte Carlo path with stochastic longevity and with care shocks (on the
 *    probes the draws reach) are identical.
 * 2. Rename every person id (a bijection that flips their ordinal order): the
 *    same, mapped back, except the one documented Monte Carlo case, two people
 *    with the same birth date and sex, whose draw order the id decides
 *    (model/peopleOrder.ts).
 *
 * The planner-ui twin (planner/peopleOrder.invariant.test.ts) runs the same
 * transforms on the 29 library examples and adds the spending solver and the
 * Social Security month refinement.
 *
 * 3. The surfaces that illustrate for one person or publish one person's age:
 *    reversing the people leaves every Insights card (the annuitization
 *    illustration and the funded floor among them), the funded-ratio card's
 *    figures, the SPIA and QLAC candidates, the annuity sweep (on a few
 *    probes, at two paths) and the Compare headline against a plan that runs
 *    out of money identical.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { DEFAULT_LTC_SHOCK } from '../montecarlo/ltcShock.js'
import { createMarketModel } from '../montecarlo/marketModels.js'
import { runMonteCarloPaths } from '../montecarlo/run.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { summarizeProjection, conversionFreeRun } from './compare.js'
import { buildAnnuitizationSweep } from '../decisions/annuitization.js'
import { createDecisionContext } from '../decisions/evaluateCandidate.js'
import { annuityPurchaseGenerator } from '../decisions/generators.js'
import { detectorProjection } from '../insights/detectorProjection.js'
import { runScreen } from '../insights/runInsights.js'
import { computeFundedRatio, fundedRatioStart } from '../ladder/fundedRatio.js'
import { EMBEDDED_REAL_YIELD_CURVE, packForYear } from '../params/index.js'
import { comparePlanHeadlines } from '../scenarios/planHeadlines.js'
import { simulatePlan } from './simulate.js'

const START = 2026
const tax = createFlatTaxCalculator(0.18)
const ALPHA = 'person-alpha'
const BETA = 'person-beta'

interface ProbeOptions {
  alphaDob?: string
  betaDob?: string
  alphaSex?: 'female' | 'male' | 'average'
  betaSex?: 'female' | 'male' | 'average'
  alphaRetirementAge?: number | null
  betaRetirementAge?: number | null
  alphaPlanningAge?: number
  betaPlanningAge?: number
}

/** A two-person household; Alpha is listed first. */
function household(o: ProbeOptions = {}): Plan {
  const plan = createEmptyPlan({ newId: () => 'order-probe', now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    { id: ALPHA, name: 'Alpha', dob: o.alphaDob ?? '1962-04-15', sex: o.alphaSex ?? 'male', retirementAge: o.alphaRetirementAge === undefined ? 66 : o.alphaRetirementAge, longevity: { planningAge: o.alphaPlanningAge ?? 92, source: 'manual' } },
    { id: BETA, name: 'Beta', dob: o.betaDob ?? '1964-09-02', sex: o.betaSex ?? 'female', retirementAge: o.betaRetirementAge === undefined ? 64 : o.betaRetirementAge, longevity: { planningAge: o.betaPlanningAge ?? 95, source: 'manual' } },
  ]
  plan.expenses.baseAnnual = 70_000
  plan.expenses.phases = [{ fromAge: 75, multiplier: 0.9 }, { fromAge: 85, multiplier: 0.8 }]
  plan.expenses.phasesAgeOf = ALPHA
  plan.incomes = [
    { type: 'wages', id: 'wages-alpha', personId: ALPHA, annualGross: 90_000, endAge: null, realGrowthPct: 0 },
    { type: 'wages', id: 'wages-beta', personId: BETA, annualGross: 60_000, endAge: null, realGrowthPct: 0 },
    { type: 'socialSecurity', id: 'ss-alpha', personId: ALPHA, piaMonthly: 2_800, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: 'ss-beta', personId: BETA, piaMonthly: 1_600, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  plan.accounts = [
    { type: 'cash', id: 'joint-cash', name: 'Joint cash', ownerPersonId: null, annualReturnPct: 2, balance: 120_000, annualContribution: 6_000 },
    { type: 'taxable', id: 'joint-brokerage', name: 'Joint brokerage', ownerPersonId: null, annualReturnPct: null, balance: 600_000, costBasis: 400_000, annualContribution: 10_000 },
    { type: 'traditional', id: 'ira-alpha', name: 'Alpha IRA', ownerPersonId: ALPHA, annualReturnPct: null, kind: 'ira', balance: 700_000, annualContribution: 0 },
    { type: 'traditional', id: 'ira-beta', name: 'Beta IRA', ownerPersonId: BETA, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0, nondeductibleBasis: 40_000 },
    { type: 'roth', id: 'roth-alpha', name: 'Alpha Roth', ownerPersonId: ALPHA, annualReturnPct: null, kind: 'ira', balance: 80_000, annualContribution: 0 },
    { type: 'roth', id: 'roth-beta', name: 'Beta Roth', ownerPersonId: BETA, annualReturnPct: null, kind: 'ira', balance: 20_000, annualContribution: 0 },
  ]
  return plan
}

const withAccounts = (plan: Plan, extra: Account[]): Plan => ({ ...plan, accounts: [...plan.accounts, ...extra] })

/** Alpha 76 and Beta 75 in 2026, both taking RMDs, giving $21,000 a year of legacy QCDs. */
function qcdSplit(): Plan {
  const plan = household({ alphaDob: '1950-03-01', betaDob: '1951-02-10', alphaRetirementAge: 65, betaRetirementAge: 65 })
  return { ...plan, incomes: plan.incomes.filter((income) => income.type !== 'wages'), strategies: { ...plan.strategies, qcdAnnual: 21_000 } }
}

/** The probe set: each a plan document, parsed or not. */
function probes(): Record<string, Plan> {
  const base = household()
  const pension = (owner: string): Account => ({ type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: owner, annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 50 })
  const annuity = (owner: string, payoutForm: NonNullable<Extract<Account, { type: 'annuity' }>['payoutForm']>): Account => ({
    type: 'annuity', id: 'annuity', name: 'Annuity', ownerPersonId: owner, annualReturnPct: null, startAge: 70, monthlyAmount: 1_500, colaPct: 1, taxablePct: 100, payoutForm,
  })
  const qlac = (owner: string, funding: string, startAge = 80): Account => ({
    type: 'annuity', id: 'qlac', name: 'QLAC', ownerPersonId: owner, annualReturnPct: null, startAge, monthlyAmount: 900, colaPct: 0, taxablePct: 100,
    purchase: { year: 2027, premium: 120_000, fundingAccountId: funding, taxQualification: 'qualified', qlac: true },
  })
  const scheduled = (type: 'cash' | 'taxable' | 'equityComp', ageOf: string): Account => {
    const schedule = [{ annualAmount: 10_000, fromAge: 55, toAge: 70, escalationPct: 0 }]
    if (type === 'equityComp') return { type, id: 'joint-scheduled', name: 'Joint RSUs', ownerPersonId: null, annualReturnPct: null, balance: 0, costBasis: 0, annualContribution: 0, vestingMode: 'final', vestDate: null, contributionSchedule: schedule, contributionScheduleAgeOf: ageOf }
    if (type === 'cash') return { type, id: 'joint-scheduled', name: 'Joint savings', ownerPersonId: null, annualReturnPct: 2, balance: 0, annualContribution: 0, contributionSchedule: schedule, contributionScheduleAgeOf: ageOf }
    return { type, id: 'joint-scheduled', name: 'Joint scheduled', ownerPersonId: null, annualReturnPct: null, balance: 0, costBasis: 0, annualContribution: 0, contributionSchedule: schedule, contributionScheduleAgeOf: ageOf }
  }
  const abw = (plan: Plan, horizon: 'survival25' | 'survival10'): Plan => ({
    ...plan,
    expenses: { ...plan.expenses, spendingPolicy: { mode: 'abw', abw: { returnSource: 'fixed', horizon } } },
  })
  const gap = (alphaDob: string, betaDob: string) => household({ alphaDob, betaDob, alphaPlanningAge: 100, betaPlanningAge: 100 })
  const out: Record<string, Plan> = {
    'phases on the first person': base,
    'phases on the second person': { ...base, expenses: { ...base.expenses, phasesAgeOf: BETA } },
    'pension owned by the second person': withAccounts(base, [pension(BETA)]),
    'pension owned by the first person': withAccounts(base, [pension(ALPHA)]),
    'life-only annuity': withAccounts(base, [annuity(BETA, { kind: 'lifeOnly' })]),
    'period-certain annuity': withAccounts(base, [annuity(BETA, { kind: 'periodCertain', certainYears: 10 })]),
    'joint-and-survivor annuity': withAccounts(base, [annuity(BETA, { kind: 'jointSurvivor', survivorPct: 100 })]),
    'non-qualified purchase from the joint brokerage': withAccounts(base, [{
      type: 'annuity', id: 'spia', name: 'SPIA', ownerPersonId: BETA, annualReturnPct: null, startAge: 66, monthlyAmount: 1_200, colaPct: 0, taxablePct: 40,
      purchase: { year: 2027, premium: 150_000, fundingAccountId: 'joint-brokerage', taxQualification: 'nonQualified' },
    }]),
    'QLAC from the first person': withAccounts(base, [qlac(ALPHA, 'ira-alpha')]),
    'QLAC from the second person': withAccounts(base, [qlac(BETA, 'ira-beta')]),
    'pre-start IRA-funded annuity with basis': withAccounts(base, [{
      type: 'annuity', id: 'prestart', name: 'Pre-start annuity', ownerPersonId: BETA, annualReturnPct: null, startAge: 62, monthlyAmount: 600, colaPct: 0, taxablePct: 100,
      purchase: { year: 2020, premium: 60_000, fundingAccountId: 'ira-beta', taxQualification: 'qualified' },
    }]),
    'joint contributions, different retirement years': household({ alphaRetirementAge: 68, betaRetirementAge: 60 }),
    'joint contributions, the same birth date': household({ betaDob: '1962-04-15', betaSex: 'male' }),
    'joint contributions, a 20-year gap': household({ betaDob: '1984-04-15', betaRetirementAge: 60 }),
    'joint equity compensation on a schedule': withAccounts(base, [scheduled('equityComp', BETA)]),
    'joint cash on a schedule': withAccounts(base, [scheduled('cash', ALPHA)]),
    'joint brokerage on a schedule': withAccounts(base, [scheduled('taxable', BETA)]),
    'equal PIAs': { ...base, incomes: base.incomes.map((income) => (income.type === 'socialSecurity' ? { ...income, piaMonthly: 2_400 } : income)) },
    'a surviving spouse': household({ alphaPlanningAge: 74, betaPlanningAge: 96 }),
    // Both past their required beginning date with an IRA each, and a legacy
    // QCD amount the split shares across the two owners' RMDs: the last owner
    // takes the residual, so which owner goes last reaches the last bit of
    // each share. The canonical people order decides it, not list order and
    // not the ids' spelling (the independent review's L3, and N4: V16, V17).
    'legacy QCD split across both IRAs': qcdSplit(),
  }
  for (const [label, dobs] of [
    ['25-year gap, older first', ['1950-03-01', '1975-03-01']],
    ['25-year gap, younger first', ['1975-03-01', '1950-03-01']],
    ['30-year gap, older first', ['1950-03-01', '1980-03-01']],
    ['30-year gap, younger first', ['1980-03-01', '1950-03-01']],
    ['35-year gap, older first', ['1945-03-01', '1980-03-01']],
    ['35-year gap, younger first', ['1980-03-01', '1945-03-01']],
  ] as const) {
    out[`ABW survival25, ${label}`] = abw(gap(dobs[0], dobs[1]), 'survival25')
    out[`ABW survival10, ${label}`] = abw(gap(dobs[0], dobs[1]), 'survival10')
  }
  // A QLAC starting at 86: allowed only for a December birth (the first of the
  // month after the 85th birthday falls in the next year). The parse outcome
  // must be the same whichever spouse is listed first.
  const decemberAlpha = household({ alphaDob: '1960-12-10' })
  out['QLAC at 86, December-born first person'] = withAccounts(decemberAlpha, [qlac(ALPHA, 'ira-alpha', 86)])
  out['QLAC at 86, March-born second person (refused)'] = withAccounts(household({ betaDob: '1962-03-10' }), [qlac(BETA, 'ira-beta', 86)])
  const decemberBeta = household({ betaDob: '1962-12-10' })
  out['QLAC at 86, December-born second person'] = withAccounts(decemberBeta, [qlac(BETA, 'ira-beta', 86)])
  return out
}

function reversed(plan: Plan): Plan {
  return { ...structuredClone(plan), household: { ...plan.household, people: [...plan.household.people].reverse() } }
}

/** A bijection on the two person ids that flips their ordinal order. */
const RENAME: Record<string, string> = { [ALPHA]: 'zz-renamed-alpha', [BETA]: 'aa-renamed-beta' }
/** Rename every occurrence of each id, inside other strings too (a group key, an event id). */
function renameIds(json: string, map: Record<string, string>): string {
  let out = json
  for (const [from, to] of Object.entries(map)) out = out.split(from).join(to)
  return out
}
const inverse = Object.fromEntries(Object.entries(RENAME).map(([from, to]) => [to, from]))

/** Order-free canonical form: arrays of objects keyed by their first unique id field, other arrays as multisets. */
const ID_KEYS = ['personId', 'id', 'accountId', 'streamId', 'incomeId', 'sourceAccountId', 'eventId', 'producerOccurrenceKey', 'ownerPersonId', 'key', 'year']
function canon(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canon)
    if (items.length > 0 && items.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x))) {
      for (const key of ID_KEYS) {
        const keys = items.map((x) => (x as Record<string, unknown>)[key])
        if (keys.every((k) => typeof k === 'string' || typeof k === 'number') && new Set(keys).size === keys.length) {
          return Object.fromEntries(
            items.map((x, i) => [`<${key}=${String(keys[i])}>`, x] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
          )
        }
      }
    }
    return items.map((x) => [JSON.stringify(x), x] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, x]) => x)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().filter((k) => (value as Record<string, unknown>)[k] !== undefined).map((k) => [k, canon((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}

function parseOutcome(plan: Plan): string {
  const parsed = parsePlan(plan)
  return parsed.ok ? 'ok' : parsed.issues.map((issue) => issue.replace(/accounts\.\d+/g, 'accounts.#')).sort().join(' | ')
}

/** The whole ledger and summary as JSON, before the order-free canonical form. */
function ledgerAndSummaryJson(plan: Plan): string {
  const parsed = parsePlan(plan)
  if (!parsed.ok) return '"refused"'
  const options = { startYear: START, taxCalculator: tax }
  const result = simulatePlan(parsed.plan, options)
  const summary = summarizeProjection(parsed.plan, result, { conversionFreeRun: conversionFreeRun(parsed.plan, options) })
  return JSON.stringify({ result, summary })
}
const orderFree = (json: string): string => JSON.stringify(canon(JSON.parse(json)))
/**
 * The ledger's evidence ids are SHA-256 digests of content that includes the
 * person ids, so a renamed id gives a different digest and no different
 * figure. The rename comparison masks them; the reversal comparison does not
 * need to.
 */
const withoutDigests = (json: string): string => json.replace(/:[0-9a-f]{64}"/gu, ':<digest>"')
const ledgerAndSummary = (plan: Plan): string => orderFree(ledgerAndSummaryJson(plan))

function monteCarlo(plan: Plan, mode: 'headline' | 'longevity' | 'care'): string[] {
  const parsed = parsePlan(plan)
  if (!parsed.ok) return []
  return runMonteCarloPaths(parsed.plan, {
    startYear: START,
    taxCalculator: tax,
    model: createMarketModel({ type: 'lognormal', inflationMeanPct: parsed.plan.assumptions.inflationPct, returnVolPct: 12 }),
    seed: 20260928,
    pathCount: MC_PATHS,
    stochasticLongevity: mode === 'longevity',
    ltcShock: mode === 'care' ? DEFAULT_LTC_SHOCK : null,
  }).paths.map((path) => JSON.stringify([path.endingNetWorth, path.depletionYear, Array.from(path.investableByYear)]))
}

const PROBES = probes()
/**
 * The Monte Carlo is run path for path on the probes whose draws the fixes
 * reach (the death and care draws, joint contributions after a sampled
 * death, survivor income), in the two modes that draw per person (longevity
 * and care; the headline mode draws markets only), at 10 paths so the suite
 * stays fast. The planner-ui twin holds the examples at 20 paths in all three
 * modes, and the implementation's measurement holds the seven example
 * couples reversed at 1,000 paths. The ABW and QLAC probes are ledger rules,
 * held by the ledger comparison.
 */
const MC_PATHS = 10
const MONTE_CARLO_PROBES = new Set([
  'phases on the first person',
  'pension owned by the second person',
  'joint-and-survivor annuity',
  'QLAC from the second person',
  'joint contributions, different retirement years',
  'joint contributions, the same birth date',
  'joint contributions, a 20-year gap',
  'joint brokerage on a schedule',
])
/** The documented exception: the id decides the draw order only on a tie in birth date and sex. */
const tiesOnBirthDateAndSex = (plan: Plan) =>
  plan.household.people[0]!.dob === plan.household.people[1]!.dob && plan.household.people[0]!.sex === plan.household.people[1]!.sex

describe('people order: reversing the people changes nothing (D-PEOPLE-ORDER, R8)', () => {
  for (const [label, plan] of Object.entries(PROBES)) {
    it(`${label}: parse, ledger, summary and every Monte Carlo path`, () => {
      const flipped = reversed(plan)
      expect(parseOutcome(flipped)).toBe(parseOutcome(plan))
      expect(ledgerAndSummary(flipped)).toBe(ledgerAndSummary(plan))
      if (!MONTE_CARLO_PROBES.has(label)) return
      for (const mode of ['longevity', 'care'] as const) {
        expect(monteCarlo(flipped, mode), mode).toEqual(monteCarlo(plan, mode))
      }
    }, 120_000)
  }

  it('reaches the refusal it must: a QLAC at 86 for a March birth, in either order', () => {
    const plan = PROBES['QLAC at 86, March-born second person (refused)']!
    expect(parseOutcome(plan)).not.toBe('ok')
    expect(parseOutcome(reversed(plan))).toBe(parseOutcome(plan))
    expect(parseOutcome(PROBES['QLAC at 86, December-born first person']!)).toBe('ok')
    expect(parseOutcome(PROBES['QLAC at 86, December-born second person']!)).toBe('ok')
  })
})

/** What the naming surfaces publish for one plan, as one JSON string. */
function namingSurfaces(plan: Plan, withSweep: boolean): string {
  const parsed = parsePlan({ ...structuredClone(plan), expenses: { ...plan.expenses, requiredAnnual: 50_000 } })
  if (!parsed.ok) return '"refused"'
  const p = parsed.plan
  const options = { startYear: START, taxCalculator: tax }
  const result = simulatePlan(p, options)
  const summary = summarizeProjection(p, result, { conversionFreeRun: conversionFreeRun(p, options) })
  const projection = detectorProjection(result, summary)
  const cards = runScreen({ plan: p, projection, params: packForYear(START).pack })
  const start = fundedRatioStart(p, START)
  const funded = start.fromYear === null ? null : computeFundedRatio({ years: result.years, startYear: START, deflate: projection.deflate, curve: EMBEDDED_REAL_YIELD_CURVE, fromYear: start.fromYear })
  const candidates = annuityPurchaseGenerator.generate(createDecisionContext(p, options, { result, summary }))
  const short = parsePlan({ ...structuredClone(p), expenses: { ...p.expenses, baseAnnual: 400_000, requiredAnnual: 50_000 } })
  if (!short.ok) throw new Error(short.issues.join('; '))
  const shortResult = simulatePlan(short.plan, options)
  const headline = comparePlanHeadlines(
    { plan: p, result, summary },
    { plan: short.plan, result: shortResult, summary: summarizeProjection(short.plan, shortResult, { conversionFreeRun: null }) },
  )
  const sweep = withSweep
    ? buildAnnuitizationSweep(p, { ...options, model: { type: 'lognormal', inflationMeanPct: p.assumptions.inflationPct, returnVolPct: 12 }, pathCount: 2, seed: 20260928 }, { allocationPcts: [10, 30] })
    : null
  return JSON.stringify(canon({ cards, start, funded, candidates, headline, sweep }))
}

const SWEEP_PROBES = new Set(['phases on the first person', 'a surviving spouse', 'ABW survival25, 25-year gap, younger first'])

describe('the surfaces that name one person: reversing the people changes nothing (D-PEOPLE-ORDER)', () => {
  for (const [label, plan] of Object.entries(PROBES)) {
    it(`${label}: Insights cards, funded ratio, annuity candidates, Compare headline${SWEEP_PROBES.has(label) ? ' and annuity sweep' : ''}`, () => {
      expect(namingSurfaces(reversed(plan), SWEEP_PROBES.has(label))).toBe(namingSurfaces(plan, SWEEP_PROBES.has(label)))
    }, 120_000)
  }

  it('publishes the depletion age of the older person, whose id the headline carries', () => {
    const surfaces = JSON.parse(namingSurfaces(PROBES['phases on the first person']!, false)) as {
      headline: { depletionAgePersonId: { baseline: string; proposal: string }; depletionAge: { proposal: number | null } }
    }
    expect(surfaces.headline.depletionAgePersonId).toEqual({ baseline: ALPHA, proposal: ALPHA })
    expect(surfaces.headline.depletionAge.proposal).not.toBeNull()
  })
})

describe('people ids: renaming them changes nothing (D-PEOPLE-ORDER, R8)', () => {
  for (const [label, plan] of Object.entries(PROBES)) {
    it(`${label}: parse, ledger, summary and Monte Carlo, mapped back`, () => {
      const renamed = JSON.parse(renameIds(JSON.stringify(plan), RENAME)) as Plan
      expect(renameIds(parseOutcome(renamed), inverse)).toBe(parseOutcome(plan))
      expect(orderFree(withoutDigests(renameIds(ledgerAndSummaryJson(renamed), inverse)))).toBe(orderFree(withoutDigests(ledgerAndSummaryJson(plan))))
      if (tiesOnBirthDateAndSex(plan) || !MONTE_CARLO_PROBES.has(label)) return
      expect(monteCarlo(renamed, 'longevity')).toEqual(monteCarlo(plan, 'longevity'))
    }, 120_000)
  }
})
