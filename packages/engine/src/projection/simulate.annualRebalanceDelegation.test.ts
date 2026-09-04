/**
 * The seam itself: `simulatePlan` must actually DELEGATE the annual
 * rebalance-to-target phase to `internal/annualRebalanceToTarget.ts`, and must
 * fold, mutate and publish exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a differential
 * equivalence dump (`scripts/equivalence.mjs` — the app compared against itself
 * across two source trees; DOCS/testing.md reserves "oracle" for a CORRECTNESS
 * oracle, and this is not one). Identical output is that dump's PASS condition,
 * so it cannot see an orphaned helper. Nothing else in the repository observes
 * the call either. This file does, with the real implementation still running,
 * so no number changes; only the fact of the call is asserted.
 *
 * CALIBRATION — every guard below was proved to discriminate by injecting the
 * defect it exists for and recording WHICH named tests failed. Measured over
 * this file and the helper's own unit tests together (7 + 16 = 23 tests):
 *
 *   orphan (call site re-inlined from the pristine   4 fail — G1, G2, G4, G5.
 *   block, helper present and never called)          Every one of the helper's
 *                                                    16 unit tests still passes,
 *                                                    and so does the differential
 *                                                    dump: measured, not assumed,
 *                                                    the orphaned tree reproduced
 *                                                    the baseline over all 228
 *                                                    corpus entries at the same
 *                                                    sha256 ed0fb0bb…1382ae. G2
 *                                                    fails through its WHOLE-LOG
 *                                                    line — 18 recorded gains fell
 *                                                    outside every phase call
 *   half-orphan (helper called for effect, the       1 fails — ONLY G2, and only
 *   inline copy folded, the payloads rebuilt at      on its `toBe` identity line:
 *   the call site and recorded)                      the rebuilt record is
 *                                                    field-for-field equal
 *   under-production: `if (year === 2029) return`    1 fails — ONLY G3c, on the
 *   all-`none` rows for one in-horizon year          traditional horizon balance
 *                                                    (290994.6454270473 against
 *                                                    290935.8322267589). G2, G4
 *                                                    and G5 all agree with the
 *                                                    loss, because their
 *                                                    expectations come from the
 *                                                    rows the helper returned
 *   under-production: every non-taxable retarget     G3c here, on its `not.toBe`
 *   row downgraded to `none`                         line — the `annual` run
 *                                                    collapses onto the `none`
 *                                                    run's 292171.32557142695 —
 *                                                    plus 5 of the helper's own
 *                                                    unit tests
 *
 * THE TWO UNDER-PRODUCTION ROWS ARE THE POINT OF G3. G2, G4 and G5 build their
 * expectations out of the rows the helper handed back on that same run, so they
 * are self-consistent under a helper that hands back too few. G3's three facts
 * are the only ones here derived from the fixture instead.
 *
 * WHAT THE FOLD GUARD PROVES HERE, and it is less than on the two phases that
 * shipped before it. `rebalanceRealizedGains` is declared `0` one line above
 * the call site and this phase is its FIRST writer (the annuity- and
 * TIPS-purchase phases add to it later in the same year). At a zero base
 * `0 + g1 + g2` IS `0 + (g1 + g2)`, so G4's exact match CANNOT distinguish
 * "the caller folded row by row" from "the helper pre-summed and the caller
 * added once". It DOES discriminate a different summation ORDER — and even
 * that only where the fixture earns it, so G4 COUNTS the years in which a
 * reversed fold lands on a different double and asserts the count is non-zero
 * rather than assuming every year is one. Do not copy a fold-guard sentence
 * from the pass-2 delegation test onto this one: that accumulator had a live
 * non-zero base and this one does not.
 *
 * WHERE THE EXPECTED VALUES COME FROM, which bounds what any of this proves.
 * G2, G4 and G5 all build their expectations out of the rows the helper
 * returned on that same run, which makes them blind to a helper that hands over
 * FEWER rows than it should. G3 is the answer to that: three independent facts,
 * none of which reads the helper's output at all. Its honest scope is stated
 * against each one.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedRebalancingGain } from './annualCashFlowYearSites.js'
import type { AnnualRebalanceRow, AnnualRebalanceYearInput } from './internal/annualRebalanceToTarget.js'

/**
 * One ordered log of both seam events, so a recorded gain can be attributed to
 * the phase call it came from.
 *
 * WHY POSITION IS A SOUND ATTRIBUTION. `annualRebalanceToTarget` returns a
 * materialized array its own loop finishes building before it returns (pinned
 * structurally in G5, not assumed); `simulate.ts` has exactly one call to it;
 * and `recordRebalancingGain` has exactly ONE call site in the repository,
 * inside the loop over that array. Its sink is not a re-entry point — it
 * applies one numeric predicate and either drops the row or pushes it onto a
 * private array in `annualCashFlowYearSites.ts`.
 *
 * NOTE WHERE THE ZERO-GAIN DROP DOES AND DOES NOT APPLY. This log intercepts
 * the recorder ABOVE its sink, so a row whose realized gain is exactly 0 would
 * appear here as a CALL and never reach the published ledger (the sink drops
 * exact zeros and keeps negatives; `annualCashFlowCapture.ts` drops exact zeros
 * a second time). G2 therefore attributes ALL recorder calls unfiltered and
 * reconciles the PUBLISHED lines against rows filtered to a non-zero gain.
 */
type SeamEvent =
  | {
      readonly kind: 'phase'
      readonly input: AnnualRebalanceYearInput
      readonly rows: readonly AnnualRebalanceRow[]
      /** `rows.length` read the instant the helper returned. */
      readonly rowCountAtCall: number
      /** `states` is the caller's live `balances`; its length is snapshotted at call time. */
      readonly stateCountAtCall: number
      readonly accountIdsAtCall: readonly string[]
    }
  | { readonly kind: 'recorded'; readonly row: RecordedRebalancingGain }

const hostile = vi.hoisted(() => ({ events: [] as SeamEvent[] }))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualRebalanceYearInput,
      readonly AnnualRebalanceRow[]
    >(),
)

// Scaffolding and the policy behind it live in
// `simulate.seamGuard.test-support.ts`; the sentinels stay here. The recorder
// owns the call, but the ORDERED log above is the one the sink below also
// appends to, and position in that single log is what G2's attribution and
// G3's whole-log accounting rest on -- so the injector keeps doing the
// pushing rather than the assertions reading two separate arrays. It returns
// `natural` untouched, because this guard injects nothing: what it pins is the
// fact of the call, the identity of the rows, and the association of the fold.
// Its post-return timing is exactly where the hand-written wrapper sat, so
// every "at call" snapshot below is taken at the same moment as before.
vi.mock('./internal/annualRebalanceToTarget.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/annualRebalanceToTarget.js')>(),
    'annualRebalanceToTarget',
    (rows, { input }): readonly AnnualRebalanceRow[] => {
      hostile.events.push({
        kind: 'phase',
        input,
        rows,
        rowCountAtCall: rows.length,
        stateCountAtCall: input.states.length,
        accountIdsAtCall: input.states.map((s) => s.account.id),
      })
      return rows
    },
  ),
)

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      // A Proxy rather than a copy: the buffer's published getters read private
      // fields off `this`, so every other member must keep running against the
      // real instance. Only the one recorder is observed, and it forwards.
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordRebalancingGain') {
            return (row: RecordedRebalancingGain) => {
              hostile.events.push({ kind: 'recorded', row })
              target.recordRebalancingGain(row)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(target) : value
        },
      })
    },
  }
})

import type { AssetAllocationPolicy, Plan } from '../model/plan.js'
import { cashAccount, singlePersonPlan, taxableAccount, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const START_YEAR = 2026
/** dob 1972 / planningAge 60 ⇒ everyone stays under 65, so no Medicare premium forces a withdrawal. */
const DOB = '1972-01-01'
const PLANNING_AGE = 60

const zeroTax: TaxCalculator = { compute: () => 0 }
const W = (usStocks: number, intlStocks: number, bonds: number, cash: number) => ({ usStocks, intlStocks, bonds, cash })
const policy = (
  rebalancing: 'annual' | 'none',
  weights = W(50, 0, 50, 0),
): AssetAllocationPolicy => ({ mode: 'static', rebalancing, weights })

/**
 * Spending and healthcare are zeroed so nothing is ever withdrawn. That is a
 * PREMISE of G4 rather than decoration: `years[].realizedGains` is
 * `withdrawalPlan.realizedGains + rebalanceRealizedGains +
 * retirementActionCapitalGainOrLoss`, and this file reads it as though it were
 * the middle term alone. `noOtherRealizedGainLeg` below checks the two outer
 * terms are really zero instead of leaving that to this comment.
 */
function quiet(plan: Plan): Plan {
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.assumptions.inflationPct = 2.5
  return plan
}

const allocatedTaxable = (id: string, balance: number, basis: number, p: AssetAllocationPolicy) => {
  const a = { ...taxableAccount(id, balance, basis), allocation: p } as Extract<Plan['accounts'][number], { type: 'taxable' }>
  a.interestYieldPct = 0
  a.dividendYieldPct = 0
  return a
}

/**
 * The main fixture. Seven balance states, deliberately covering every row kind
 * this phase can produce:
 *
 *   cash1      no allocation track at all         → `none`
 *   optout     a track with rebalancing: 'none'   → `none`
 *   brokA/B/C  three allocated taxable accounts,  → `sale` from the second
 *              differently sized and differently    projected year on
 *              drifted
 *   trad       an allocated TRADITIONAL account   → `retarget`, realizing nothing
 *   roth       an allocated ROTH account          → `retarget`, realizing nothing
 *
 * Three sale rows rather than two is deliberate: with a zero-based accumulator,
 * reversing TWO addends cannot change the sum (IEEE-754 addition is
 * commutative), so a two-sale fixture would leave G4's order check decorative.
 * The three taxable balances are spread across five orders of magnitude for the
 * same reason, and that part was MEASURED rather than reasoned: a first version
 * with three similarly-sized accounts produced three sale rows a year and still
 * discriminated in ZERO years, because same-scale addends re-associate exactly.
 * As it stands the fixture projects 7 years, folds more than one sale row in 6
 * of them, and lands on a different double under a reversed fold in 2. G4
 * counts that itself rather than trusting this paragraph.
 */
function mainPlan(): Plan {
  const plan = quiet(singlePersonPlan({ dob: DOB, planningAge: PLANNING_AGE }))
  plan.accounts = [
    cashAccount('cash1', 25_000),
    allocatedTaxable('brokA', 200_000, 100_000, policy('annual')),
    allocatedTaxable('optout', 120_000, 40_000, policy('none')),
    allocatedTaxable('brokB', 1_300, 291, policy('annual', W(30, 10, 60, 0))),
    { ...traditionalAccount('trad', 311_000), allocation: policy('annual', W(70, 0, 30, 0)) } as Plan['accounts'][number],
    allocatedTaxable('brokC', 911_777_333, 613_111_222, policy('annual', W(80, 5, 15, 0))),
    {
      type: 'roth',
      id: 'roth',
      name: 'roth',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 90_000,
      annualContribution: 0,
      allocation: policy('annual', W(40, 20, 40, 0)),
    } as Plan['accounts'][number],
  ]
  return validatePlan(plan)
}

function run(plan: Plan, options: { capture?: boolean } = {}) {
  hostile.events.length = 0
  seam.reset()
  const result = simulatePlan(plan, {
    startYear: START_YEAR,
    taxCalculator: zeroTax,
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
  })
  const phases = hostile.events.filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase')
  const byYear = new Map<number, readonly AnnualRebalanceRow[]>()
  for (const phase of phases) byYear.set(phase.input.year, phase.rows)
  return { result, phases, byYear }
}

function rowsFor(byYear: ReadonlyMap<number, readonly AnnualRebalanceRow[]>, year: number): readonly AnnualRebalanceRow[] {
  const rows = byYear.get(year)
  if (rows === undefined) throw new Error(`no annualRebalanceToTarget call was recorded for ${year}`)
  return rows
}

/**
 * G4's premise, CHECKED rather than asserted in prose: on this fixture the
 * year's published `realizedGains` is the rebalance leg alone. Nothing is
 * withdrawn (so `withdrawalPlan.realizedGains` is 0) and the plan carries no
 * retirement actions (so `retirementActionCapitalGainOrLoss` is 0). Pinning the
 * withdrawal total here makes a fixture change that starts forcing withdrawals
 * fail by name instead of moving G4's expected value somewhere unrelated.
 */
function noOtherRealizedGainLeg(year: { withdrawals: { total: number } }, where: string): void {
  expect(year.withdrawals.total, `${where} — G4 reads realizedGains as the rebalance leg alone`).toBe(0)
}

const rebalanceLineIds = (year: { cashFlow?: { taxCharacterMetadata: readonly { id: string }[] } | undefined }): string[] =>
  (year.cashFlow?.taxCharacterMetadata ?? [])
    .filter((line) => line.id.startsWith('metadata:capitalGain:rebalancing:'))
    .map((line) => line.id)

describe('simulatePlan delegates the annual rebalance to target', () => {
  // G1 — defeats the FULLY ORPHANED helper. The inlined phase's `let
  // rebalanceRealizedGains = 0` and its `if (year > startYear)` both ran every
  // projected year, so the call must happen every year INCLUDING the start
  // year, where the helper is the thing that knows to do nothing.
  it('calls the extracted helper exactly once for every projected year, start year included', () => {
    const { result, phases, byYear } = run(mainPlan())
    expect(phases.length).toBeGreaterThan(0)
    expect(phases.length).toBe(result.years.length)
    expect([...byYear.keys()].sort((a, b) => a - b)).toEqual(result.years.map((y) => y.year))
    expect(phases.map((p) => p.input.year)).toEqual(result.years.map((y) => y.year))
    // The start year is called and returns nothing but `none` rows.
    expect(rowsFor(byYear, START_YEAR).every((r) => r.kind === 'none')).toBe(true)
    // And the year gate lives in the helper, not in a caller-side condition:
    // the same call in the very next year does real work.
    expect(rowsFor(byYear, START_YEAR + 1).some((r) => r.kind === 'sale')).toBe(true)
    // The input is the year's real state: `startYear` is the projection's, and
    // the state list is the caller's live `balances`, unsorted and unfiltered.
    for (const phase of phases) {
      expect(phase.input.startYear, `startYear at ${phase.input.year}`).toBe(START_YEAR)
      expect(phase.accountIdsAtCall, `states at ${phase.input.year}`).toEqual([
        'cash1',
        'brokA',
        'optout',
        'brokB',
        'trad',
        'brokC',
        'roth',
      ])
      // The tracks are the caller's live map, so the helper sees the drift the
      // year-end pass wrote — not a snapshot taken at plan setup.
      expect(phase.input.allocationTrack.get('1')).toBeDefined()
      expect(phase.input.allocationTrack.has('0')).toBe(false)
    }
  })

  // G2 — THE OBJECT-IDENTITY ASSERTION (defeats the HALF-ORPHANED duplicate).
  // Capture mode is mandatory: `yearSites` is null under default options, so a
  // default-only run never reaches the recorder at all.
  it('publishes the helper’s own record objects, not look-alike rebuilds', () => {
    const { result } = run(mainPlan(), { capture: true })
    let identityChecks = 0
    let attributedRecords = 0
    for (let i = 0; i < hostile.events.length; i++) {
      const event = hostile.events[i]!
      if (event.kind !== 'phase') continue
      const where = `year ${event.input.year}`
      const followed: Extract<SeamEvent, { kind: 'recorded' }>[] = []
      for (let j = i + 1; j < hostile.events.length; j++) {
        const next = hostile.events[j]!
        if (next.kind === 'phase') break
        followed.push(next)
      }
      attributedRecords += followed.length
      // EVERY sale row is recorded, unfiltered — the sink, not the caller,
      // drops a zero-gain row, and this log sits in front of the sink.
      const saleRows = event.rows.filter((r) => r.kind === 'sale')
      expect(followed.length, `${where} recorded a different number of rows`).toBe(saleRows.length)
      for (let k = 0; k < saleRows.length; k++) {
        const want = saleRows[k]!
        if (want.kind !== 'sale') throw new Error('unreachable')
        // THE LOAD-BEARING ONE. A caller that invokes the helper for effect and
        // then records its own byte-identical rebuild satisfies every field
        // comparison below and every other suite in the repository, and fails
        // only this.
        expect(followed[k]!.row, `${where} [${k}] is not the helper's own record object`).toBe(want.record)
        expect(followed[k]!.row.accountId).toBe(want.accountId)
        expect(followed[k]!.row.realizedCapitalGainOrLoss).toBe(want.realizedCapitalGainOrLoss)
        identityChecks++
      }
    }
    // WHOLE-LOG ACCOUNTING. The loop above claims the records that FOLLOW each
    // phase call, so a record emitted before the first call would belong to no
    // run and be skipped in silence. Every record must be claimed exactly once.
    const recordEvents = hostile.events.filter((e) => e.kind === 'recorded').length
    expect(attributedRecords, 'a recorded rebalancing gain fell outside every phase call').toBe(recordEvents)
    expect(identityChecks, 'the fixture no longer records any rebalancing gain').toBeGreaterThan(10)
    // AND THE PUBLISHED LEDGER, filtered: the sink and the capture pass both
    // drop an exactly-zero gain, so the published set is the sale rows with a
    // non-zero gain, in row order.
    for (const year of result.years) {
      const rows = hostile.events
        .filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase' && e.input.year === year.year)
        .flatMap((e) => e.rows)
      const want = rows
        .filter((r) => r.kind === 'sale' && r.realizedCapitalGainOrLoss !== 0)
        .map((r) => cashFlowLineIds.metadataRebalancingCapitalGain((r as Extract<AnnualRebalanceRow, { kind: 'sale' }>).accountId))
      expect(rebalanceLineIds(year), `published rebalancing lines ${year.year}`).toEqual(want)
    }
  })

  // G3a — FIXTURE-DERIVED, and it never reads the helper's output. Two IDENTICAL
  // allocated taxable accounts with DISTINCT ids realize exactly twice what one
  // of them realizes alone: each account's own gain is the same double `g`, and
  // `0 + g + g` is exactly `2 * g` in IEEE-754. Honest scope: this covers only
  // `years[1]` of the years this fixture simulates, and on its own it would NOT
  // catch a helper that under-produced SYMMETRICALLY for both accounts — which
  // is why G3c is not redundant with it.
  it('realizes exactly twice as much from two identical taxable accounts as from one', () => {
    const twinPlan = (ids: readonly string[]): Plan => {
      const plan = quiet(singlePersonPlan({ dob: DOB, planningAge: PLANNING_AGE }))
      plan.accounts = ids.map((id) => allocatedTaxable(id, 200_000, 100_000, policy('annual')))
      return validatePlan(plan)
    }
    const one = simulatePlan(twinPlan(['brok']), { startYear: START_YEAR, taxCalculator: zeroTax, captureAnnualCashFlow: true })
    const two = simulatePlan(twinPlan(['one', 'two']), { startYear: START_YEAR, taxCalculator: zeroTax, captureAnnualCashFlow: true })
    noOtherRealizedGainLeg(one.years[1]!, 'G3a one-account run')
    noOtherRealizedGainLeg(two.years[1]!, 'G3a two-account run')
    expect(one.years[0]!.realizedGains, 'nothing rebalances in the start year').toBe(0)
    expect(one.years[1]!.realizedGains, 'the one-account run no longer realizes anything').toBeGreaterThan(0)
    expect(two.years[1]!.realizedGains).toBe(2 * one.years[1]!.realizedGains)
    expect(rebalanceLineIds(one.years[1]!)).toEqual(['metadata:capitalGain:rebalancing:brok'])
    expect(rebalanceLineIds(two.years[1]!)).toEqual([
      'metadata:capitalGain:rebalancing:one',
      'metadata:capitalGain:rebalancing:two',
    ])
  })

  // G3b — compatible duplicate rows keep independent physical allocation
  // tracks, so neither row can drift or retarget the other's return mix.
  it('rebalances both physical rows sharing an account id', () => {
    const twinPlan = (ids: readonly string[]): Plan => {
      const plan = quiet(singlePersonPlan({ dob: DOB, planningAge: PLANNING_AGE }))
      plan.accounts = ids.map((id) => allocatedTaxable(id, 200_000, 100_000, policy('annual')))
      return validatePlan(plan)
    }
    const dup = simulatePlan(twinPlan(['dup', 'dup']), { startYear: START_YEAR, taxCalculator: zeroTax, captureAnnualCashFlow: true })
    const one = simulatePlan(twinPlan(['brok']), { startYear: START_YEAR, taxCalculator: zeroTax, captureAnnualCashFlow: true })
    expect(rebalanceLineIds(dup.years[1]!)).toEqual([
      'metadata:capitalGain:rebalancing:dup',
      'metadata:capitalGain:rebalancing:dup',
    ])
    expect(dup.years[1]!.realizedGains).toBe(2 * one.years[1]!.realizedGains)
  })

  // G3c — FIXTURE-DERIVED, and the ONLY guard that can see a helper which
  // silently under-produces the NON-TAXABLE retarget rows. A traditional
  // account realizes nothing when it rebalances, so no gain, no ledger line and
  // no tax moves — but its weights are snapped back to target every year, and
  // that changes the blended return it grows at. Against the same plan with
  // `rebalancing: 'none'` the horizon balance must therefore DIFFER while
  // `realizedGains` stays 0 in both. Measured before it was written: nothing
  // else in the repository fails when those rows go missing.
  it('rebalances a traditional account’s weights without realizing anything', () => {
    const tradPlan = (rebalancing: 'annual' | 'none'): Plan => {
      const plan = quiet(singlePersonPlan({ dob: DOB, planningAge: PLANNING_AGE }))
      plan.accounts = [{ ...traditionalAccount('trad', 200_000), allocation: policy(rebalancing) } as Plan['accounts'][number]]
      return validatePlan(plan)
    }
    const annual = simulatePlan(tradPlan('annual'), { startYear: START_YEAR, taxCalculator: zeroTax })
    const none = simulatePlan(tradPlan('none'), { startYear: START_YEAR, taxCalculator: zeroTax })
    const last = annual.years.length - 1
    expect(none.years.length).toBe(annual.years.length)
    for (const year of [...annual.years, ...none.years]) expect(year.realizedGains, `realizedGains ${year.year}`).toBe(0)
    expect(annual.years[last]!.balances['trad']).not.toBe(none.years[last]!.balances['trad'])
    // Pinned exactly in both directions, so a drift in either run is visible
    // rather than absorbed by the inequality above.
    expect(annual.years[last]!.balances['trad']).toBe(290935.8322267589)
    expect(none.years[last]!.balances['trad']).toBe(292171.32557142695)
  })

  // G4 — THE FOLD, with `toBe` and with its own limits stated. The accumulator
  // is ZERO-BASED at this phase, so this proves SELECTION, PER-ROW VALUES and
  // summation ORDER — and nothing about association. The order half is only
  // live where the fixture earns it, so the discriminating years are COUNTED.
  it('folds the sale rows into the year’s realized gains in row order', () => {
    const { result, byYear } = run(mainPlan())
    let yearsWithTwoSales = 0
    let yearsThatDiscriminateOrder = 0
    for (const year of result.years) {
      noOtherRealizedGainLeg(year, `year ${year.year}`)
      const legs = rowsFor(byYear, year.year)
        .filter((r): r is Extract<AnnualRebalanceRow, { kind: 'sale' }> => r.kind === 'sale')
        .map((r) => r.realizedCapitalGainOrLoss)
      let rowByRow = 0
      for (const leg of legs) rowByRow += leg
      let reversed = 0
      for (const leg of [...legs].reverse()) reversed += leg
      if (legs.length > 1) yearsWithTwoSales++
      if (!Object.is(rowByRow, reversed)) yearsThatDiscriminateOrder++
      expect(year.realizedGains, `realizedGains ${year.year}`).toBe(rowByRow)
    }
    expect(yearsWithTwoSales, 'fixture no longer has a year that folds two sale rows').toBeGreaterThan(0)
    expect(
      yearsThatDiscriminateOrder,
      'fixture no longer contains a year where reversing the sale rows lands on a different double, ' +
        'so this guard proves selection and per-row values only',
    ).toBeGreaterThan(0)
  })

  // G5 — THE STRUCTURAL PREMISES the caller's index-by-index consumption and
  // G2's positional attribution both rest on. All three lines catch different
  // shapes: `Array.isArray` catches a generator, `rowCountAtCall` catches an
  // array appended to after it was returned (a generator PASSES that check —
  // both reads are `undefined`), and the states-length equality catches silent
  // under-production of whole rows.
  it('returns a materialized array holding exactly one row per balance state', () => {
    const { phases } = run(mainPlan())
    expect(phases.length).toBeGreaterThan(0)
    for (const phase of phases) {
      const where = `year ${phase.input.year}`
      expect(Array.isArray(phase.rows), `${where} rows are not a materialized array`).toBe(true)
      expect(phase.rows.length, `${where} rows grew after the call returned`).toBe(phase.rowCountAtCall)
      expect(phase.rows.length, `${where} row count does not match the state count`).toBe(phase.stateCountAtCall)
    }
  })
})
