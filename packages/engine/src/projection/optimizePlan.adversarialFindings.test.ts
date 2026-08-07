/**
 * Two defects found by independent verification against the LP-committed-terms
 * slice, and the repros that found them — kept, with their assertions flipped
 * to the corrected behavior and the wrong number written down beside the right
 * one so a regression reads as the defect returning rather than as a number
 * drifting.
 *
 * NEITHER WAS INTRODUCED BY THAT SLICE. Both are pre-existing engine defects
 * the slice's own prose then contradicted, which is how they surfaced. Both
 * reached a live recommendation: `optimizerUnsupportedRetirementActions` gates
 * only on `plan.strategies.retirementActions`, and neither fixture records one,
 * so neither was behind the Optimize page's refusal.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { optimizeSchedule } from '../strategies/optimizer.js'
import { recurringOrdinaryIncome } from '../testing/planFixtures.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import type { OptimizerYearProbe } from './types.js'
import { buildOptimizerInput, optimizerUnsupportedRetirementActions } from './optimizePlan.js'
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

/**
 * FINDING 1 — the aggregate QCD's income offset was deleted before it reached
 * the LP, and the fix that carries it.
 *
 * `optimizerOrdinaryIncomeBase` was
 * `Math.max(0, incomeBeforeConversion − rmdTaxable − inheritedTotal) + taxableSs`.
 * `incomeBeforeConversion` carries `− qcdIncomeOffset`, so subtracting the WHOLE
 * taxable RMD left the offset behind as a NEGATIVE residue, and the clamp — put
 * there for non-forced income going negative under pre-tax contributions —
 * deleted it whenever non-forced income was smaller than the gift. That is the
 * ordinary shape for a retiree whose income IS the RMD. The LP then charged full
 * ordinary income on the RMD it re-decides as `wt`, with no exclusion at all.
 *
 * THE FIX: net the RMD's NET contribution out of the base, so the clamp guards
 * only the non-forced income it was written for, and carry the exclusion on its
 * own term (`forcedDistributionOrdinaryIncomeExclusion`) that the LP applies
 * against the forced dollars it books itself.
 */
describe('FINDING 1 (closed): the QCD income offset reaches the LP', () => {
  function qcdPlan(otherOrdinaryIncome: number): Plan {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      // Age 76 in 2026: the applicable RMD age is long past, so the whole gift
      // routes out of the RMD and `qcdIncomeOffset` is the whole $30,000.
      dob: '1950-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 77, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.stateEffectiveTaxPct = 0
    plan.assumptions.heirTaxRatePct = 25
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.strategies.qcdAnnual = 30_000
    if (otherOrdinaryIncome > 0) {
      plan.incomes = [recurringOrdinaryIncome('pension', otherOrdinaryIncome, 2026)]
    }
    plan.accounts = [
      { type: 'traditional', id: 'q-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 1_000_000, annualContribution: 0 },
      { type: 'roth', id: 'q-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'q-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 300_000, annualContribution: 0 },
    ]
    return validate(plan)
  }

  it('prices the year’s exogenous ordinary income at the ledger’s own MAGI', () => {
    // One dial, three plans. The old overstatement was `max(0, offset − other
    // income)` — 30,000 / 10,000 / 0 down this list — which is what made it a
    // clamp and not a coincidence. It is 0 / 0 / 0 now.
    const rows = [0, 20_000, 50_000].map((otherOrdinaryIncome) => {
      const plan = qcdPlan(otherOrdinaryIncome)
      const ledger = simulatePlan(plan, opts).years[0]!
      const modeled = buildOptimizerInput(plan, opts).years[0]!
      // The LP's exogenous ordinary income evaluated at the ledger's own draw:
      // base + committed floor − forced exclusion + the re-decided RMD at its
      // taxable fraction.
      const lpOrdinaryAtLedgerDraw =
        modeled.ordinaryIncomeBase +
        (modeled.committedOrdinaryIncome ?? 0) -
        (modeled.forcedDistributionOrdinaryIncomeExclusion ?? 0) +
        ledger.rmd * (modeled.traditionalWithdrawalTaxableFraction ?? 1)
      return {
        otherOrdinaryIncome,
        modeled,
        ledgerMagi: ledger.magi,
        overstatement: lpOrdinaryAtLedgerDraw - ledger.magi,
        // Nothing on the strategy channel: the entire gift routed out of the
        // RMD, so the movement term is correctly empty here. This finding is
        // the income side alone.
        strategyMovement: modeled.exogenousStrategyMovement,
      }
    })

    // The ledger's own answer, so the bar is a gift that demonstrably happened.
    expect(rows[0]!.ledgerMagi).toBeCloseTo(12_194.09, 2) // RMD 42,194.09 − 30,000
    expect(rows.every((row) => row.strategyMovement === undefined)).toBe(true)

    // CLOSED. The LP prices the ledger's MAGI at every setting of the dial.
    for (const row of rows) expect(row.overstatement).toBeCloseTo(0, 6)

    // And the base is now the non-forced income alone, with the exclusion on
    // its own term rather than dissolved into it — so the clamp has nothing of
    // the gift's to delete at any setting.
    expect(rows.map((row) => row.modeled.ordinaryIncomeBase)).toEqual([0, 20_000, 50_000])
    for (const row of rows) {
      expect(row.modeled.forcedDistributionOrdinaryIncomeExclusion).toBeCloseTo(30_000, 6)
    }
  })

  it('keeps the clamp, and keeps it off the gift', () => {
    // OBLIGATION: the clamp legitimately prevents a negative base, and the fix
    // must not delete it. It guards ONE reachable shape — a contribution that
    // exceeds the year's modeled ordinary income, which only an HSA can be,
    // because every other pre-tax contribution is capped at compensation and
    // compensation is ordinary income (§415(c) pay prong, `simulate.ts`
    // `limit415c`; §219(b)(1)(B), `iraCompensationRemaining`). A scheduled HSA
    // contribution has no such cap and needs no wages.
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1971-01-01', // 55 in 2026: under 65, so an HSA may still receive
      sex: 'average',
      retirementAge: 54,
      longevity: { planningAge: 60, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.stateEffectiveTaxPct = 0
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.accounts = [
      { type: 'traditional', id: 'c-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 400_000, annualContribution: 0 },
      { type: 'roth', id: 'c-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'c-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 100_000, annualContribution: 0 },
      { type: 'hsa', id: 'c-hsa', name: 'HSA', ownerPersonId: 'p1', annualReturnPct: 0, balance: 5_000, annualContribution: 0, contributionSchedule: [{ annualAmount: 4_000, fromAge: 50, toAge: 60, escalationPct: 0 }] },
    ]
    const clamped = validate(plan)
    const probe = probesFor(clamped)[0]!

    // The contribution ran with no wages behind it, so non-forced ordinary
    // income is −4,000 before the clamp.
    expect(probe.otherInflow).toBeCloseTo(4_000, 6)
    // Clamp intact: the LP never receives a negative ordinary base. Nothing of
    // a gift's is lost to it, because there is no gift here and because the
    // exclusion no longer passes through it at all.
    expect(probe.ordinaryIncomeBase).toBe(0)
    expect(probe.forcedDistributionOrdinaryIncomeExclusion).toBe(0)

    // And the shape where the OLD clamp fired and destroyed a gift: the base is
    // still nonnegative, and the exclusion survives beside it.
    const giftProbe = probesFor(qcdPlan(0))[0]!
    expect(giftProbe.ordinaryIncomeBase).toBe(0)
    expect(giftProbe.forcedDistributionOrdinaryIncomeExclusion).toBeCloseTo(30_000, 6)
  })

  it('recommends the conversion the year’s true bracket room supports', async () => {
    const plan = qcdPlan(0)
    const result = simulatePlan(plan, opts)
    // The offset the ledger actually applied: the gift, capped at the RMD.
    const offsets = result.years.map((year) => Math.min(year.qcd, year.rmd))
    expect(offsets).toEqual([30_000, 30_000])

    const shippedInput = buildOptimizerInput(plan, opts)
    // The defect, reconstructed by zeroing the new term — the LP the engine
    // built before this fix, on the identical plan.
    const regressedInput = {
      ...shippedInput,
      years: shippedInput.years.map((year) => ({
        ...year,
        forcedDistributionOrdinaryIncomeExclusion: 0,
      })),
    }

    const shipped = await optimizeSchedule(shippedInput)
    const regressed = await optimizeSchedule(regressedInput)
    expect(shipped.status).toBe('optimal')
    expect(regressed.status).toBe('optimal')

    const shipped2026 = shipped.conversions.find((entry) => entry.year === 2026)!.amount
    const regressed2026 = regressed.conversions.find((entry) => entry.year === 2026)!.amount
    // CLOSED. The recommendation is $30,000 larger — the whole charitable
    // exclusion, which the solver had been treating as bracket room already
    // filled by income the household never had.
    expect(shipped2026 - regressed2026).toBeCloseTo(30_000, 2)
    expect(shipped2026).toBeCloseTo(62_355.9, 2)
    expect(regressed2026).toBeCloseTo(32_355.9, 2)

    // The ACA/IRMAA path reconciles too: an excluded distribution is out of
    // gross income, so the reconstructed incumbent MAGI is the ledger's.
    const probe = probesFor(plan)[0]!
    expect(probe.incumbentModeledMagiBeforeTaxableWithdrawalGains)
      .toBeCloseTo(result.years[0]!.magi, 6)

    // It always reached a user: the surface gate reads recorded actions only,
    // and an aggregate `qcdAnnual` plan records none.
    expect(optimizerUnsupportedRetirementActions(plan)).toEqual([])
  })
})

/**
 * FINDING 2 — a 72(t) SEPP series moved a balance the LP re-decides no part of,
 * and reached neither movement channel.
 *
 * A SEPP election on a traditional account (`Account.sepp`) debits that account
 * every year of the series. The LP re-decides nothing of it —
 * `incumbentTraditionalDistribution` is `rmdTotal` plus discretionary owner
 * withdrawals and excludes `seppTotal`, and there is no RMD in these years to
 * force `wt` — yet the series' ordinary income IS booked, through
 * `incomeBeforeConversion`'s `+ seppTotal − seppNontaxable`.
 *
 * That is the same one-sided booking the slice fixed for the QCD, with the
 * sides swapped: income charged, balance never debited, and unlike a gift the
 * cash never credited either. The fix routes the series through the same
 * strategy channel — from the runtime OCCURRENCE it publishes at its debit
 * site, which unlike the runtime application is emitted for an employer plan
 * too — with proceeds, because a withdrawal reallocates.
 */
describe('FINDING 2 (closed): a 72(t) SEPP debit reaches the strategy channel', () => {
  function seppPlan(): Plan {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1971-01-01', // 55 in 2026; the series runs 2026–2030
      sex: 'average',
      retirementAge: 54,
      longevity: { planningAge: 63, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.stateEffectiveTaxPct = 0
    plan.assumptions.heirTaxRatePct = 25
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.accounts = [
      { type: 'traditional', id: 's-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 800_000, annualContribution: 0, sepp: { startAge: 55, method: 'amortization' } },
      { type: 'roth', id: 's-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 's-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 500_000, annualContribution: 0 },
    ]
    return validate(plan)
  }

  it('tracks the ledger’s balance through the series instead of holding it', () => {
    const plan = seppPlan()
    const result = simulatePlan(plan, opts)
    const probes = probesFor(plan)
    const input = buildOptimizerInput(plan, opts)

    // The ledger's answer first: five level series payments, each debiting the
    // IRA, each on the year's return.
    const seppYears = result.years.filter((year) => year.sepp > 0)
    expect(seppYears).toHaveLength(5)
    expect(seppYears[0]!.sepp).toBeCloseTo(50_890.72, 2)
    const ledgerClose = Number(result.years[4]!.balances['s-ira'])
    expect(ledgerClose).toBeCloseTo(545_546.38, 2)

    // The income side was always booked; that was never the gap.
    expect(input.years[0]!.ordinaryIncomeBase).toBeCloseTo(50_890.72, 2)

    // CLOSED, on the strategy channel — not the action channel, because a
    // 72(t) election is a strategy and no action is recorded here.
    expect(probes[0]!.exogenousStrategyAccountMovement).toEqual([
      { accountId: 's-ira', amount: -50_890.72 },
    ])
    expect(probes[0]!.committedActionAccountMovement).toEqual([])
    expect(input.years[0]!.committedActionMovement).toBeUndefined()

    // Both sides. A series payment REALLOCATES — the ledger's `baseCashInflows`
    // carries `+ seppTotal` — so the debit comes with its cash credit, which is
    // what separates it from the gift on this same channel.
    expect(input.years[0]!.exogenousStrategyMovement).toEqual({
      trad: -50_890.72,
      inheritedTrad: 0,
      other: 0,
      taxable: 0,
      proceeds: seppYears[0]!.sepp,
    })

    // Roll the LP's own traditional recursion forward with `conv = 0` and `wt`
    // at the ledger's re-decidable draw (zero: no RMD, no discretionary draw).
    // Growth is 0, so the recursion is `trad(t+1) = trad(t) + rhs`.
    let trad = input.openingTrad
    for (let t = 0; t < 5; t++) {
      const modeled = input.years[t]!
      const g = 1 + modeled.growth
      const rhs = g * (
        modeled.tradInflow +
        (modeled.committedActionMovement?.trad ?? 0) +
        (modeled.exogenousStrategyMovement?.trad ?? 0)
      )
      trad = g * trad + rhs
    }
    // Before the fix this read 800,000 — a $254,453.62 phantom, 46.6% of the
    // ledger's real closing balance, that never unwound and grew with every
    // additional series year. It now tracks the ledger to the exact-cent
    // measurement residue: each payment is reported at the cents the ledger
    // would record, so five payments can differ by at most 2.5 cents in total.
    expect(trad - ledgerClose).toBeLessThan(0.05)
    expect(trad - ledgerClose).toBeGreaterThanOrEqual(0)
    expect(trad).toBeCloseTo(ledgerClose, 1)

    // The series ends: 2031 is past age 59½ and the five-year rule, and the
    // channel is empty again rather than repeating the last payment.
    expect(probes[5]!.exogenousStrategyAccountMovement).toEqual([])
    expect(probes[5]!.exogenousStrategyProceeds).toBe(0)

    // It always reached a user: no recorded action, so no surface gate.
    expect(optimizerUnsupportedRetirementActions(plan)).toEqual([])
  })

  it('debits an annuity premium the same way, and credits no cash for it', () => {
    // The verifier flagged `annuityPurchaseFunding` as the same class. It is: a
    // purchase year moves the premium out of a funding account into a contract
    // the LP does not carry, and the LP re-decides none of it. It differs from
    // the series in both directions — no proceeds (the contract pays back later
    // through `incomes.annuity`, already inside `exogenousCash`), and no
    // complete published record (the runtime occurrence is emitted only for a
    // traditional funding source), so it is captured at its mutation site.
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1958-06-15',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 72, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.stateEffectiveTaxPct = 0
    plan.assumptions.heirTaxRatePct = 25
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.accounts = [
      { type: 'traditional', id: 'a-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 400_000, annualContribution: 0 },
      { type: 'roth', id: 'a-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'a-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 300_000, annualContribution: 0 },
      // Cash-funded on purpose: this is exactly the source whose premium
      // publishes no runtime occurrence, so a probe reading only published
      // records would miss it.
      { type: 'annuity', id: 'a-spia', name: 'SPIA', ownerPersonId: 'p1', annualReturnPct: 0, startAge: 70, monthlyAmount: 600, colaPct: 0, taxablePct: 100, purchase: { year: 2027, premium: 100_000, fundingAccountId: 'a-cash', qlac: false, taxQualification: 'nonQualified' } },
    ]
    const purchased = validate(plan)
    const probes = probesFor(purchased)
    const ledger = simulatePlan(purchased, opts)
    const input = buildOptimizerInput(purchased, opts)

    // The ledger's own answer: $100k leaves cash in the purchase year.
    expect(Number(ledger.years[0]!.balances['a-cash'])).toBeGreaterThan(290_000)
    expect(Number(ledger.years[1]!.balances['a-cash'])).toBeCloseTo(195_057.36, 2)

    // Purchase year only, on the strategy channel, in the tax-free bucket the
    // cash account belongs to.
    expect(probes[0]!.exogenousStrategyAccountMovement).toEqual([])
    expect(probes[1]!.exogenousStrategyAccountMovement).toEqual([
      { accountId: 'a-cash', amount: -100_000 },
    ])
    expect(input.years[1]!.exogenousStrategyMovement).toEqual({
      trad: 0,
      inheritedTrad: 0,
      other: -100_000,
      taxable: 0,
      proceeds: 0,
    })
    expect(input.years[0]!.exogenousStrategyMovement).toBeUndefined()
  })
})
