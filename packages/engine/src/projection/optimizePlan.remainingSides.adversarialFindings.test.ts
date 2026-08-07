/**
 * ADVERSARIAL VERIFIER EVIDENCE for the remaining-LP-sides slice.
 *
 * Every test here PASSES on this branch: each pins what the engine actually
 * does today so the wrong answer cannot drift silently, and writes the correct
 * answer next to it. None of these defects was introduced by this slice — but
 * each was reached by attacking one of its stated claims, and two of them are
 * certified as correct by comments the slice added.
 *
 * READ EVERY REMAINING PINNED FIGURE AS A RECORDED DEFECT, NOT AS DESIRED
 * BEHAVIOR. A pinned figure is the engine's CURRENT WRONG ANSWER, held still on
 * purpose. The fix for each is tracked as its own slice, and when one lands it
 * MUST flip the assertion it pins — a failure here is the defect being closed,
 * not a regression, and the correct figure to replace the pin with is written
 * beside it in every case. Nothing here may be "repaired" by changing the
 * expected value to whatever the engine starts producing.
 *
 * FINDINGS 2 AND 4 ARE NOW CLOSED (retirement-action-execution-source-
 * integrity, the lump-sum hygiene slice). Their pins were flipped by the fixes
 * that closed them, and each now reads as the corrected behavior: both stale
 * shapes are refused at parse, and the residual case a parse rule cannot see (a
 * plan reopened in a later calendar year without being edited) is named by a
 * simulate-time warning. The defect prose below each heading is kept as the
 * record of what was wrong.
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
 * 2. (CLOSED) THE PENSION LUMP SUM WITH AN ELECTION YEAR ALREADY PAST. The rollover
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
 * 4. (CLOSED) AN INHERITED IRA IS AN ACCEPTED ROLLOVER TARGET. The slice cites
 *    `model/plan.ts`'s "a pension lump sum must roll over into an existing
 *    traditional account" as the guarantee its occurrence covers every reach of
 *    the credit line — which is true. The validation itself is weaker than its
 *    message: an inherited traditional account is `type: 'traditional'`, so the
 *    schema admits a rollover no beneficiary may make.
 */

import { describe, expect, it } from 'vitest'

import { migratePlanToCurrent } from '../model/migrations.js'
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

describe('FINDING 2 (CLOSED): a lump-sum election year before the projection start', () => {
  function stalePlan(electionYear: number): Plan {
    const plan = retiree('1955-01-01', 80) // 71 in 2026, pension started at 65
    plan.accounts = [
      { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 400_000, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 300_000, annualContribution: 0 },
      { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
        lumpSumOffer: { amount: 400_000, electionYear }, lumpSumElection: { rolloverAccountId: 'ira' } },
    ]
    return plan
  }

  // THE FIX. The schema used to accept any calendar year, so a plan whose
  // election year was already past was ACCEPTED and then modeled destructively:
  // the pension was skipped for every `year >= electionYear` and the offer was
  // credited in no projected year at all. Crediting it in the first projection
  // year instead would double-count it — balances are what the household holds
  // today ("Balances as of today"), and every other pre-start event in this
  // engine (an annuity premium, a TIPS-ladder purchase) is already read as
  // "assumed already funded" and never replayed. So the shape is refused, and
  // the message names the repair.
  it('is refused at parse, naming the repair', () => {
    // `createEmptyPlan` stamps `updatedAtIso` from `fixedNow` (2026), which is
    // the document's own as-of year and, at every save, the projection start.
    const parsed = parsePlan(stalePlan(2025))
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues).toContain(
      'accounts.3.lumpSumOffer.electionYear: an elected pension lump sum cannot have an election year in the past (if the rollover already happened, clear the election and add its dollars to the receiving account balance)',
    )
  })

  it('loads a legacy stored document instead of locking the household out, and says why', () => {
    // The shape was saveable before this rule existed, so a parse refusal on the
    // load path would be a lockout: `loadPlan` goes through
    // `migratePlanToCurrent`, and `PlanContext` surfaces only a bare reason code.
    // The load-time repair returns it undecided with the offer intact, and the
    // projection states the resulting position rather than changing it in silence.
    const stored = JSON.parse(JSON.stringify(stalePlan(2025))) as unknown
    const migrated = migratePlanToCurrent(stored)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const result = simulatePlan(migrated.plan, opts)
    expect(result.warnings).toContain(
      'A pension lump-sum offer on record has an election year that has already passed, so no rollover is modeled and the pension pays its annuity. Update the election year to compare taking the lump sum again.',
    )
    // The pension pays again, which is the repair's whole economic effect.
    expect(result.years[0]!.incomes.pension).toBeCloseTo(24_000, 2)
    expect(result.years[0]!.balances['ira']).toBeCloseTo(400_000, 2)
  })

  it('still parses, and says so out loud, when a plan is reopened a year later', () => {
    // The residual window the parse rule cannot reach: saved in 2026 with a 2026
    // election (valid then, and still valid on every reopen), run in 2027. The
    // ledger keeps the conservative reading — no pension, no credit — because it
    // cannot tell whether the rollover already happened, and the warning states
    // exactly that instead of leaving the household to discover it.
    const v = validate(stalePlan(2026))
    const probes: OptimizerYearProbe[] = []
    const result = simulatePlan(v, {
      ...opts,
      startYear: 2027,
      captureOptimizerInputs: (p) => probes.push(p),
    })
    expect(result.warnings).toContain(
      'A pension lump-sum election is dated before this projection starts, so the pension pays nothing and no rollover is credited. Update the election year, or clear the election and add the rolled-over dollars to the receiving account balance.',
    )
    expect(result.years[0]!.incomes.pension).toBe(0)
    expect(result.years[0]!.balances['ira']).toBeCloseTo(400_000, 2)
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

describe('FINDING 4 (CLOSED): an inherited IRA passes the rollover-target validation', () => {
  function beneficiary(rolloverAccountId: string): Plan {
    const plan = retiree('1959-01-01', 74)
    plan.expenses.baseAnnual = 30_000
    plan.accounts = [
      { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 300_000, annualContribution: 0 },
      { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 100_000, annualContribution: 0,
        inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
      { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
      { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0, startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
        lumpSumOffer: { amount: 400_000, electionYear: 2027 }, lumpSumElection: { rolloverAccountId } },
    ]
    return plan
  }

  // THE FIX. The check was `accountTypeById.get(id) !== 'traditional'`, and an
  // inherited account IS type 'traditional', so the message "an existing
  // traditional account" admitted a target no beneficiary may use. It now
  // resolves the account and reads the same `inherited` discriminator the SEPP
  // gate and the conversion source rule read.
  it('is refused at parse, with a message that matches what it enforces', () => {
    const parsed = parsePlan(beneficiary('inh'))
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues).toContain(
      'accounts.4.lumpSumElection.rolloverAccountId: a pension lump sum must roll over into an existing traditional account you own (not an inherited IRA)',
    )
  })

  it('loads a legacy stored document with the same shape, undecided', () => {
    // Never offered by the editor's own picker, but reachable by import, by the
    // MCP, or by hand, so the load path still has to carry it rather than refuse.
    const migrated = migratePlanToCurrent(JSON.parse(JSON.stringify(beneficiary('inh'))) as unknown)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    const pension = migrated.plan.accounts.find((a) => a.id === 'pen')!
    if (pension.type !== 'pension') throw new Error('expected the pension back')
    expect(pension.lumpSumElection).toBeUndefined()
    expect(pension.lumpSumOffer).toEqual({ amount: 400_000, electionYear: 2027 })
    // The credit that used to land in the inherited bucket is gone with it.
    const modeled = buildOptimizerInput(migrated.plan, opts).years
    expect(modeled.every((y) => (y.exogenousStrategyMovement?.inheritedTrad ?? 0) === 0)).toBe(true)
  })

  it('leaves the owned-traditional rollover exactly as it was', () => {
    // The slice's own claim, re-measured on the target that survives: the
    // occurrence covers the case and the bucket bridge resolves the account
    // honestly, so the LP mirrors the ledger rather than mislabeling the credit.
    const v = validate(beneficiary('ira'))
    const probes = probesFor(v)
    const idx = probes.findIndex((p) => p.year === 2027)
    const modeled = buildOptimizerInput(v, opts).years[idx]!

    expect(probes[idx]!.exogenousStrategyAccountMovement)
      .toEqual([{ accountId: 'ira', amount: 400_000 }])
    expect(modeled.exogenousStrategyMovement?.trad).toBeCloseTo(400_000, 2)
    expect(modeled.exogenousStrategyMovement?.inheritedTrad).toBe(0)
  })
})
