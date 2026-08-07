/**
 * ADVERSARIAL VERIFIER EVIDENCE for the remaining-LP-sides slice.
 *
 * Every test here PASSES on this branch: each pins what the engine actually
 * does today so the wrong answer cannot drift silently, and writes the correct
 * answer next to it. None of these defects was introduced by this slice — but
 * each was reached by attacking one of its stated claims, and two of them are
 * certified as correct by comments the slice added.
 *
 * READ EVERY ASSERTION BELOW AS A RECORDED DEFECT, NOT AS DESIRED BEHAVIOR.
 * Each pinned figure is the engine's CURRENT WRONG ANSWER, held still on
 * purpose. The fix for each is tracked as its own slice, and when one lands it
 * MUST flip the assertion it pins — a failure here is the defect being closed,
 * not a regression, and the correct figure to replace the pin with is written
 * beside it in every case. Nothing here may be "repaired" by changing the
 * expected value to whatever the engine starts producing.
 *
 * Finding 3 is the exception that was fixable in the slice itself and WAS
 * fixed: it was a false sentence in the slice's own prose rather than an engine
 * defect, so the enumeration it attacks now states the measured direction. The
 * test stays because the measurement is what makes the corrected sentence true.
 *
 * FINDING 1 IS CLOSED, on 2026-08-07, and its assertions below are FLIPPED
 * exactly as this header always required — they now pin the statutory answer,
 * not the engine's departure from it. Its approximation was REGISTERED on the
 * record that carried the other half of the same departure rather than on a new
 * one, because fixing the pro-rata ORDERING replaced the offending computation
 * outright and the CEILING went with it: one defect, one record, one fix. See
 * `taxRuleRegistry.ts`, `irc-408-d-8-D-projection-qcd-after-pro-rata`, now
 * `settled`, and `simulate.qcdAggregateIncludible.test.ts`, which pins the same
 * figures from the ledger side. Findings 2 and 4 remain open and remain pinned.
 *
 * 1. THE §408(d)(8)(D) CAP (CLOSED). `forcedDistributionCashDiversion` is the
 *    GROSS routed gift and `forcedDistributionOrdinaryIncomeExclusion` is the
 *    includible share, and the comments justify the difference by citing
 *    §408(d)(8)(D). The engine measured "otherwise includible" against the
 *    RMD's own taxable share; the statute measures it against the aggregate
 *    includible amount of ALL the owner's IRAs treated as one contract — which
 *    the QCD block's own comment (simulate.ts, "measured over the owner's
 *    individual retirement plans treated as one contract") already stated. The
 *    design premise the slice rests on was sound and survives: the two figures
 *    CAN legitimately differ, on a near-all-basis IRA. What changed is that
 *    they no longer differ on the ORDINARY one, because the gift is now
 *    excluded at its gross, so the shape below reports the two terms equal.
 *
 * 2. THE PENSION LUMP SUM WITH AN ELECTION YEAR ALREADY PAST. The rollover
 *    credit is gated on `electionYear === year` while the pension stream is
 *    skipped on `year >= electionYear`. A plan whose election year falls before
 *    the projection start therefore loses the pension for the whole horizon and
 *    never receives the offer — in the exact ledger AND in the LP. This slice
 *    closed the "LP saw only half the fact" gap; it does not reach the case
 *    where the LEDGER sees only half, which a plan reopened a year after its
 *    election year hits.
 *
 * 3. THE HECM DRAW'S DIRECTION. The new stated-absent enumeration says
 *    "Every one but the HECM draw makes the solve poorer than the household".
 *    Omitting the draw makes the LP poorer too: it funds the year's spending
 *    from buckets the household did not have to touch, and the LP carries no
 *    home and no loan in its objective either way. The warning the sentence
 *    wraps (booking the cash alone WOULD make it richer) is right; the
 *    direction it asserts is not.
 *
 * 4. AN INHERITED IRA IS AN ACCEPTED ROLLOVER TARGET. The slice cites
 *    `model/plan.ts`'s "a pension lump sum must roll over into an existing
 *    traditional account" as the guarantee its occurrence covers every reach of
 *    the credit line — which is true. The validation itself is weaker than its
 *    message: an inherited traditional account is `type: 'traditional'`, so the
 *    schema admits a rollover no beneficiary may make.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import type { OptimizerYearProbe } from './types.js'
import { buildOptimizerInput } from './optimizePlan.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `adv-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}
function probesFor(plan: Plan): OptimizerYearProbe[] {
  const probes: OptimizerYearProbe[] = []
  simulatePlan(plan, { ...opts, captureOptimizerInputs: (p) => probes.push(p) })
  return probes
}
function zeroedHealthcare() {
  return { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
}
function retiree(dob: string, planningAge: number): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1', name: 'Pat', dob, sex: 'average', retirementAge: 65,
    longevity: { planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = zeroedHealthcare()
  return plan
}

describe('FINDING 1 (CLOSED): the QCD exclusion is measured by §408(d)(8)(D)', () => {
  it('a nondeductible-basis IRA reports the income the statute taxes', () => {
    const plan = retiree('1950-01-01', 77) // 76 in 2026
    plan.strategies.qcdAnnual = 40_000
    plan.accounts = [
      { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 1_000_000, annualContribution: 0, nondeductibleBasis: 200_000 },
      { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 200_000, annualContribution: 0 },
    ]
    const v = validate(plan)
    const ledger = simulatePlan(v, opts).years[0]!
    const probe = probesFor(v)[0]!
    const modeled = buildOptimizerInput(v, opts).years[0]!

    // The year, as fact.
    expect(ledger.rmd).toBeCloseTo(42_194.09, 2)
    expect(ledger.qcd).toBeCloseTo(40_000, 2)
    // The gift returns no basis, so only the 2,194.09 that reached the
    // household pro-rates — and at 200,000/960,000, the denominator the QCD has
    // left. 2,194.09 × 0.208333 = 457.10, against the 8,438.82 the engine used
    // to burn when it pro-rated the whole requirement first.
    expect(ledger.rmd - (probe.rmdTaxable ?? 0)).toBeCloseTo(457.10, 2)

    // THE SLICE'S OWN TERMS. They coincide on this shape now, and that is the
    // fix rather than a collapse of the distinction: §408(d)(8)(D) deems the
    // routed gift includible in full, so the includible figure IS the gross
    // whenever the owner's IRAs hold more pre-tax dollars than the gift. They
    // separate again only past the aggregate includible amount, which
    // `simulate.qcdAggregateIncludible.test.ts` reaches.
    expect(probe.forcedDistributionCashDiversion).toBeCloseTo(40_000, 2)
    expect(probe.forcedDistributionOrdinaryIncomeExclusion).toBeCloseTo(40_000, 2)

    // Each still lands on its own constant, and both sides reconcile against
    // the exact ledger — the cash term is CORRECT.
    const lpOrdinaryAtLedgerDraw =
      modeled.ordinaryIncomeBase +
      (modeled.committedOrdinaryIncome ?? 0) -
      (modeled.forcedDistributionOrdinaryIncomeExclusion ?? 0) +
      ledger.rmd * (modeled.traditionalWithdrawalTaxableFraction ?? 1)
    expect(lpOrdinaryAtLedgerDraw - ledger.magi).toBeCloseTo(0, 4)
    expect(ledger.rmd - (modeled.forcedDistributionCashDiversion ?? 0)).toBeCloseTo(2_194.09, 2)

    // CLOSED (`simulate.ts` `qcdIncomeOffset`, fixed 2026-08-07).
    // §408(d)(8)(D) deems a QCD to consist of otherwise-includible dollars up
    // to the aggregate includible amount of ALL the owner's IRAs treated as one
    // contract — $1,000,000 − $200,000 = $800,000 here, so the whole $40,000
    // gift is excludible and returns NO basis. Only the $2,194.09 that reached
    // the household pro-rates, at the denominator the gift has left.
    //   2026 ordinary income = 2,194.09 × (1 − 200,000/960,000) = 1,736.99
    //   basis consumed       =   457.10  (leaving 199,542.90)
    // The engine used to cap the exclusion at the RMD's taxable share, report
    // no income at all, and burn $8,438.82 of basis — a bracket-filling error
    // in the year AND an over-taxation of every later year that inherited the
    // depleted basis.
    //
    // The 1,755.27 this test asserted as "the right one" while the defect was
    // open was ITSELF wrong, by exactly the half of the statute the fix had to
    // supply: it pro-rated the residual at 200,000/1,000,000, leaving the gift
    // in a denominator the Form 8606 line-7 instructions keep it out of.
    expect(ledger.magi).toBeCloseTo(1_736.99, 2)
    expect(ledger.magi).not.toBeCloseTo(0, 6) // the old wrong answer
    expect(ledger.magi).not.toBeCloseTo((ledger.rmd - ledger.qcd) * 0.8, 2)
  })
})

describe('FINDING 2: a lump-sum election year before the projection start', () => {
  it('stops the pension for the whole horizon and never credits the rollover', () => {
    const plan = retiree('1955-01-01', 80) // 71 in 2026, pension started at 65
    plan.accounts = [
      { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 400_000, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 300_000, annualContribution: 0 },
      { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
        // A plan whose election year was 2025 and which is opened in 2026 —
        // the schema accepts any calendar year.
        lumpSumOffer: { amount: 400_000, electionYear: 2025 }, lumpSumElection: { rolloverAccountId: 'ira' } },
    ]
    const v = validate(plan) // accepted
    const years = simulatePlan(v, opts).years
    const probes = probesFor(v)

    // DEFECT: `simulate.ts` credits the offer only when
    // `lumpSumOffer.electionYear === year` but skips the pension stream for
    // every `year >= electionYear`. The household is shown $24,000/yr poorer
    // AND never receives the $400,000 that replaced it — in the ledger, so the
    // LP faithfully mirrors a projection that is simply wrong.
    expect(years[0]!.incomes.pension).toBe(0) // should be 24,000
    expect(years[0]!.balances['ira']).toBeCloseTo(400_000, 2) // never credited
    expect(probes.every((p) => p.exogenousStrategyAccountMovement.length === 0)).toBe(true)
  })
})

describe('FINDING 3: omitting the HECM draw makes the solve POORER, not richer', () => {
  it('the draw funds the ledger’s spending and reaches neither exogenousCash nor spendingNeed', () => {
    const plan = retiree('1955-01-01', 80)
    plan.expenses.baseAnnual = 90_000
    plan.accounts = [
      { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 200_000, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
      { type: 'property', id: 'home', name: 'Home', annualReturnPct: 0, ownerPersonId: 'p1', value: 800_000, plannedSaleYear: null, expectedNetProceeds: null, primaryResidence: true,
        hecm: { openYear: 2026, principalLimitPct: 50, growthRatePct: 6, drawPolicy: 'coordinated' } },
    ] as never
    const v = validate(plan)
    const years = simulatePlan(v, opts).years
    const probes = probesFor(v)
    const drawIndex = years.findIndex((y) => ((y as unknown as { hecmDraw?: number }).hecmDraw ?? 0) > 0)
    expect(drawIndex).toBeGreaterThanOrEqual(0)

    const drawYear = years[drawIndex]! as unknown as { hecmDraw: number }
    expect(drawYear.hecmDraw).toBeGreaterThan(40_000)
    // The LP sees no part of it: not as cash, not as a smaller need, not as a
    // bucket movement. So the solve must fund the whole year from its own
    // buckets while the household funded most of it from the line — the LP is
    // POORER than the household, exactly like the other three members of the
    // stated-absent class, not the exception the comment names it.
    expect(probes[drawIndex]!.exogenousCash).toBe(0)
    expect(probes[drawIndex]!.spendingNeed).toBeGreaterThan(90_000)
    expect(probes[drawIndex]!.exogenousStrategyAccountMovement).toEqual([])
  })
})

describe('FINDING 4: an inherited IRA passes the rollover-target validation', () => {
  it('accepts a rollover no beneficiary may make, and books it in the inherited bucket', () => {
    const plan = retiree('1959-01-01', 74)
    plan.expenses.baseAnnual = 30_000
    plan.accounts = [
      { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 300_000, annualContribution: 0 },
      { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 100_000, annualContribution: 0,
        inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
      { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
      { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
        lumpSumOffer: { amount: 400_000, electionYear: 2027 }, lumpSumElection: { rolloverAccountId: 'inh' } },
    ]
    // DEFECT (pre-existing, `model/plan.ts` superRefine): the check is
    // `accountTypeById.get(id) !== 'traditional'`, and an inherited account IS
    // type 'traditional', so the message "an existing traditional account"
    // admits a target the statute forbids.
    const v = validate(plan)
    const probes = probesFor(v)
    const idx = probes.findIndex((p) => p.year === 2027)
    const modeled = buildOptimizerInput(v, opts).years[idx]!

    // The slice's own claim survives it: the occurrence covers the case and the
    // bucket bridge resolves the account honestly, so the LP mirrors the
    // (impossible) ledger rather than mislabeling it as owned traditional.
    expect(probes[idx]!.exogenousStrategyAccountMovement)
      .toEqual([{ accountId: 'inh', amount: 400_000 }])
    expect(modeled.exogenousStrategyMovement?.inheritedTrad).toBeCloseTo(400_000, 2)
    expect(modeled.exogenousStrategyMovement?.trad).toBe(0)
  })
})
