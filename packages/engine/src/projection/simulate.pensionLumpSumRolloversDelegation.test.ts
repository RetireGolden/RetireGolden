/**
 * The seam itself: `simulatePlan` must actually DELEGATE the pension lump-sum
 * rollover phase to `internal/pensionLumpSumRollovers.ts`, and must credit,
 * publish and record exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a differential
 * equivalence dump (`scripts/equivalence.mjs` — the app compared against itself
 * across two source trees; DOCS/testing.md reserves "oracle" for a CORRECTNESS
 * oracle, and this is not one). Identical output is that dump's PASS condition,
 * so it cannot see an orphaned helper. Every existing test that touches this
 * phase observes only its OUTPUT, so on the evidence of the three phases that
 * shipped before it, all of them pass an orphan too. This file does not.
 *
 * CALIBRATION — every guard below was proved to discriminate by injecting the
 * defect it exists for and recording WHICH named tests failed. Measured over
 * this file and the helper's own unit tests together (5 + 19 = 24 tests):
 *
 *   orphan (call site re-inlined from the pristine   4 fail — G1, G2, G4, G5.
 *   block, helper present and never called)          All 19 of the helper unit
 *                                                    tests still pass, and so
 *                                                    does the differential dump:
 *                                                    measured, the orphaned tree
 *                                                    reproduced the baseline over
 *                                                    all 228 corpus entries at
 *                                                    the same sha256
 *                                                    ed0fb0bb…1382ae. G2 fails
 *                                                    through its WHOLE-LOG line —
 *                                                    4 recorded rollovers fell
 *                                                    outside every phase call
 *   half-orphan (helper called for effect, the       1 fails — ONLY G2, on its
 *   inline copy run and its payload rebuilt at       `toBe` identity line: the
 *   the call site)                                   rebuilt record is
 *                                                    field-for-field equal
 *   under-production: `if (year === 2028) return`    3 fail. G3 by name, on the
 *   no rows for the employer election year           fixture-derived
 *                                                    `employer-dest` balance (0
 *                                                    against 5000); G2 and G5
 *                                                    only through their explicit
 *                                                    row-count floors (3 against
 *                                                    4), which is why those
 *                                                    floors are exact counts
 *                                                    rather than `> 0`
 *
 * WHAT THE FOLD GUARD PROVES HERE, and it is MORE than on the rebalance phase
 * that shipped beside it. The accumulator this phase feeds is `target.balance`,
 * and it is genuinely NON-ZERO-based: it starts from the destination account's
 * own opening balance, a direct plan input. Two pensions electing into ONE
 * traditional account in the same year is a valid plan, so `B + a + b` really
 * can differ from `B + (a + b)` — measured on this fixture's own constants,
 * 141234.65899999999 against 141234.659, and the difference reaches PUBLISHED
 * output through `applications[1].sourceBalanceAfterPlanDollars`. G4 asserts
 * with `toBe` and COUNTS the discriminating years rather than assuming any year
 * is one. The liveness comes from the fixture giving the destination a non-zero
 * opening balance AND two same-year elections; a single-election plan folds
 * against a base but has nothing to re-associate.
 *
 * WHY THE CALLER STILL OWNS THE CREDIT. `target.balance += amount` mutated
 * shared state inside the inlined loop and a later iteration observed it: the
 * second application's `sourceBalanceBeforePlanDollars` is exactly the first
 * one's `after`. The helper never reads a balance — its input view does not
 * expose the field, so that is compiler-checked rather than asserted — and the
 * caller does the read-mutate-record per row. G4's before/after chain is what
 * holds the caller to it.
 *
 * WHOLE-LOG ACCOUNTING NEEDS A MARKER HERE, not position. `recordPensionRollover`
 * has exactly one call site in the tree, so the LEDGER events can be attributed
 * positionally. The two runtime recorders cannot: they are called from about
 * twenty other blocks in the same year. So G3 filters on two literals — grepped,
 * and reported as the grep came back rather than as it was hoped:
 *   - `kind: 'rolloverInflow'` is emitted at exactly ONE non-test site,
 *     `simulate.ts:2001`, which is this phase's own.
 *   - `simulatorPhase: 'pensionLumpSumRollover'` appears at TWO:
 *     `simulate.ts:2013`, and
 *     `internal/ownedNonRothIraRuntimeSourceSeries.ts#applicationShape`. That
 *     second site predates this work and emits nothing — it is a `kind` ->
 *     descriptor classifier (`case 'rolloverInflow': return { …,
 *     simulatorPhase: 'pensionLumpSumRollover', … }`) that LABELS this phase's
 *     applications rather than producing a competing record.
 * Filtering published applications on that field is therefore still exact: the
 * classifier can only ever tag a record whose `kind` this phase already
 * selected. "Exclusive to this phase" was simply the wrong word for it.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedPensionRollover } from './annualCashFlowYearSites.js'
import type {
  PensionLumpSumRolloverRow,
  PensionLumpSumRolloverYearInput,
} from './internal/pensionLumpSumRollovers.js'

type SeamEvent =
  | {
      readonly kind: 'phase'
      readonly input: PensionLumpSumRolloverYearInput
      readonly rows: readonly PensionLumpSumRolloverRow[]
      /** `rows.length` read the instant the helper returned. */
      readonly rowCountAtCall: number
      readonly accountIdsAtCall: readonly string[]
      readonly balanceIdsAtCall: readonly string[]
    }
  | { readonly kind: 'recorded'; readonly row: RecordedPensionRollover }

const seam = vi.hoisted(() => ({ events: [] as SeamEvent[] }))

vi.mock('./internal/pensionLumpSumRollovers.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/pensionLumpSumRollovers.js')>()
  return {
    ...original,
    pensionLumpSumRollovers: (input: Parameters<typeof original.pensionLumpSumRollovers>[0]) => {
      const rows = original.pensionLumpSumRollovers(input)
      seam.events.push({
        kind: 'phase',
        input,
        rows,
        rowCountAtCall: rows.length,
        accountIdsAtCall: input.accounts.map((a) => a.id),
        balanceIdsAtCall: input.balances.map((b) => b.account.id),
      })
      return rows
    },
  }
})

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
          if (prop === 'recordPensionRollover') {
            return (row: RecordedPensionRollover) => {
              seam.events.push({ kind: 'recorded', row })
              target.recordPensionRollover(row)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(target) : value
        },
      })
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const START_YEAR = 2026
const END_YEAR = 2030
const noTax = createFlatTaxCalculator(0)

/**
 * The destination's opening balance and the two same-year offers. Deliberately
 * not round: G4 needs a year where `B + a + b` lands on a different double from
 * `B + (a + b)`, and these three constants are what make that true. G4 counts
 * the discriminating years rather than trusting this comment.
 */
const DEST_OPENING = 123_456.789
const OFFER_1 = 10_000.1
const OFFER_2 = 7_777.77
/** An owned EMPLOYER plan: an occurrence with NO aggregated-IRA application. */
const OFFER_EMPLOYER = 5_000
const EMPLOYER_ELECTION_YEAR = 2028
/** Recorded, then dropped by the sink's non-positive filter. */
const ZERO_ELECTION_YEAR = 2029

const traditional = (id: string, balance: number, kind: 'ira' | 'employer'): Account =>
  ({
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind,
    balance,
    annualContribution: 0,
  }) as Account

const pension = (id: string, amount: number, electionYear: number, rolloverAccountId: string): Account =>
  ({
    type: 'pension',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 60,
    monthlyAmount: 0,
    colaPct: 0,
    survivorPct: 0,
    lumpSumOffer: { amount, electionYear },
    lumpSumElection: { rolloverAccountId },
  }) as Account

/**
 * dob 1972 ⇒ age 54 in START_YEAR, so nobody reaches an RMD or a Medicare
 * premium inside the horizon; `annualReturnPct: 0` and zeroed spending mean
 * nothing but this phase moves the destination balance. That is the premise
 * G3's published-balance assertion rests on, and `noOtherBalanceMover` checks
 * it instead of leaving it here.
 */
function plan(): Plan {
  const p = singlePersonPlan({ dob: '1972-01-01', planningAge: 60 })
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  p.assumptions.inflationPct = 0
  p.accounts = [
    traditional('shared-target', DEST_OPENING, 'ira'),
    traditional('employer-dest', 0, 'employer'),
    // ORDER IS THE POINT: pen-1 folds before pen-2, and both credit the SAME
    // destination in the SAME year.
    pension('pen-1', OFFER_1, START_YEAR, 'shared-target'),
    pension('pen-2', OFFER_2, START_YEAR, 'shared-target'),
    pension('pen-emp', OFFER_EMPLOYER, EMPLOYER_ELECTION_YEAR, 'employer-dest'),
    pension('pen-zero', 0, ZERO_ELECTION_YEAR, 'shared-target'),
  ]
  return validatePlan(p)
}

function run(options: { capture?: boolean } = {}) {
  seam.events.length = 0
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: noTax,
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
  })
  const phases = seam.events.filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase')
  const byYear = new Map<number, readonly PensionLumpSumRolloverRow[]>()
  for (const phase of phases) byYear.set(phase.input.year, phase.rows)
  return { result, phases, byYear }
}

function rowsFor(byYear: ReadonlyMap<number, readonly PensionLumpSumRolloverRow[]>, year: number) {
  const rows = byYear.get(year)
  if (rows === undefined) throw new Error(`no pensionLumpSumRollovers call was recorded for ${year}`)
  return rows
}

const yearOf = (result: { years: readonly YearResult[] }, year: number): YearResult => {
  const found = result.years.find((y) => y.year === year)
  if (found === undefined) throw new Error(`the projection published no year ${year}`)
  return found
}

/** Runtime OCCURRENCES this phase produced, by its exclusive kind marker. */
const rolloverOccurrences = (year: YearResult) =>
  (year.retirementRuntimeSource?.runtimeOccurrences ?? []).filter((o) => o.kind === 'rolloverInflow')

/**
 * Runtime APPLICATIONS this phase produced, by its exclusive phase marker.
 *
 * The `applicationKind` narrowing is asserted rather than filtered on: this
 * phase emits `credit` applications and nothing else, and a future kind
 * appearing under this phase marker should fail here by name rather than being
 * quietly dropped out of every count below.
 */
function rolloverApplications(
  year: YearResult,
): readonly Extract<
  NonNullable<YearResult['retirementRuntimeApplicationSource']>['applications'][number],
  { applicationKind: 'credit' }
>[] {
  const marked = (year.retirementRuntimeApplicationSource?.applications ?? []).filter(
    (a) => a.simulatorPhase === 'pensionLumpSumRollover',
  )
  for (const application of marked) {
    expect(application.applicationKind, `${year.year} pensionLumpSumRollover application kind`).toBe('credit')
  }
  return marked as never
}

const rolloverLineIds = (year: YearResult): string[] =>
  (year.cashFlow?.transferLines ?? []).filter((l) => l.kind === 'pensionRollover').map((l) => l.id)

/**
 * G3's premise, CHECKED rather than asserted: on this fixture nothing but this
 * phase moves the destination balance. `annualReturnPct: 0` and no withdrawal
 * are what make the published year-end balance readable as the fold result.
 */
function noOtherBalanceMover(year: YearResult, where: string): void {
  expect(year.withdrawals.total, `${where} — G3 reads the destination balance as this phase's fold`).toBe(0)
  expect(year.contributions, `${where} — a contribution would also move it`).toBe(0)
}

describe('simulatePlan delegates the pension lump-sum rollover', () => {
  // G1 — defeats the FULLY ORPHANED helper. The inlined `for (const account of
  // plan.accounts)` ran every projected year, so the call must happen every
  // year, including the four in which no offer elects.
  it('calls the extracted helper exactly once for every projected year', () => {
    const { result, phases, byYear } = run()
    expect(phases.length).toBeGreaterThan(0)
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect(phases.length).toBe(result.years.length)
    expect(phases.map((p) => p.input.year)).toEqual(result.years.map((y) => y.year))
    // The years with nothing to do are called and return nothing.
    expect(rowsFor(byYear, 2027)).toEqual([])
    expect(rowsFor(byYear, END_YEAR)).toEqual([])
    for (const phase of phases) {
      // `plan.accounts` whole and in order — not pre-filtered to pensions.
      expect(phase.accountIdsAtCall, `accounts at ${phase.input.year}`).toEqual([
        'shared-target',
        'employer-dest',
        'pen-1',
        'pen-2',
        'pen-emp',
        'pen-zero',
      ])
      // The balance view is the caller's live `balances`, which holds only the
      // account types that carry one — the two pensions are absent.
      expect(phase.balanceIdsAtCall, `balances at ${phase.input.year}`).toEqual(['shared-target', 'employer-dest'])
    }
  })

  // G2 — THE OBJECT-IDENTITY ASSERTION (defeats the HALF-ORPHANED duplicate).
  // Capture mode is mandatory: `yearSites` is null under default options.
  it('publishes the helper’s own record objects, not look-alike rebuilds', () => {
    const { result } = run({ capture: true })
    let identityChecks = 0
    let attributedRecords = 0
    for (let i = 0; i < seam.events.length; i++) {
      const event = seam.events[i]!
      if (event.kind !== 'phase') continue
      const where = `year ${event.input.year}`
      const followed: Extract<SeamEvent, { kind: 'recorded' }>[] = []
      for (let j = i + 1; j < seam.events.length; j++) {
        const next = seam.events[j]!
        if (next.kind === 'phase') break
        followed.push(next)
      }
      attributedRecords += followed.length
      // EVERY row is recorded, unfiltered — the sink, not the caller, applies
      // the non-positive drop, and this log sits in front of the sink. The
      // fixture's zero offer is what makes that rule load-bearing.
      expect(followed.length, `${where} recorded a different number of rows`).toBe(event.rows.length)
      for (let k = 0; k < event.rows.length; k++) {
        const want = event.rows[k]!
        // THE LOAD-BEARING ONE. A caller that invokes the helper for effect and
        // then records its own byte-identical rebuild satisfies every field
        // comparison below and every other suite in the repository, and fails
        // only this.
        expect(followed[k]!.row, `${where} [${k}] is not the helper's own record object`).toBe(want.record)
        expect(followed[k]!.row.amount).toBe(want.amount)
        expect(followed[k]!.row.destinationAccountId).toBe(want.destinationAccountId)
        identityChecks++
      }
      // The index the helper hands back must name the account it named.
      for (const row of event.rows) {
        expect(event.input.balances[row.destinationIndex]?.account.id, `${where} destinationIndex`).toBe(
          row.destinationAccountId,
        )
      }
    }
    // WHOLE-LOG ACCOUNTING. `recordPensionRollover` has exactly one call site,
    // so a record that fell outside every phase run would be skipped in silence.
    const recordEvents = seam.events.filter((e) => e.kind === 'recorded').length
    expect(attributedRecords, 'a recorded pension rollover fell outside every phase call').toBe(recordEvents)
    expect(identityChecks, 'the fixture no longer records any pension rollover').toBe(4)
    // AND THE PUBLISHED LEDGER, filtered: the sink drops a non-positive amount,
    // so the published set is the rows with `amount > 0`, in row order.
    for (const year of result.years) {
      const rows = seam.events
        .filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase' && e.input.year === year.year)
        .flatMap((e) => e.rows)
      expect(rolloverLineIds(year), `published rollover lines ${year.year}`).toEqual(
        rows
          .filter((r) => r.amount > 0)
          .map((r) => cashFlowLineIds.transferPensionRollover(r.pensionAccountId, r.destinationAccountId)),
      )
    }
  })

  // G3 — THE FIXTURE-DERIVED GUARD, and the only one here that never reads the
  // helper's output. Every expectation below is counted off `plan()` above.
  // G2, G4 and G5 all build their expectations from the rows the helper handed
  // back, so an early-out that returns nothing for some year loses that year's
  // whole contribution and they all agree with the loss.
  it('pays the fixture’s whole election schedule, on a fixture-derived expectation', () => {
    const { result } = run({ capture: true })
    for (const year of result.years) noOtherBalanceMover(year, `year ${year.year}`)

    // START_YEAR: both offers credit the SAME destination, folded in
    // `plan.accounts` order. Nothing else moves that balance, and the account
    // grows at 0, so the published year-end balance IS the fold.
    let expected = DEST_OPENING
    expected += OFFER_1
    expected += OFFER_2
    expect(yearOf(result, START_YEAR).balances['shared-target']).toBe(expected)
    // And it stays there: no later year credits it (the zero offer moves nothing).
    for (const year of result.years) {
      expect(year.balances['shared-target'], `shared-target ${year.year}`).toBe(expected)
    }
    expect(yearOf(result, EMPLOYER_ELECTION_YEAR).balances['employer-dest']).toBe(OFFER_EMPLOYER)

    // The ledger, year by year, from the fixture's schedule alone.
    expect(rolloverLineIds(yearOf(result, START_YEAR))).toEqual([
      'transfer:pensionRollover:pen-1:shared-target',
      'transfer:pensionRollover:pen-2:shared-target',
    ])
    expect(rolloverLineIds(yearOf(result, 2027))).toEqual([])
    expect(rolloverLineIds(yearOf(result, EMPLOYER_ELECTION_YEAR))).toEqual([
      'transfer:pensionRollover:pen-emp:employer-dest',
    ])
    // Recorded and then dropped: the zero offer never reaches the ledger.
    expect(rolloverLineIds(yearOf(result, ZERO_ELECTION_YEAR))).toEqual([])
    expect(rolloverLineIds(yearOf(result, END_YEAR))).toEqual([])

    // THE TWO GATES, kept apart. The owned IRA gets an occurrence AND an
    // application; the owned EMPLOYER plan gets the occurrence alone; the zero
    // offer gets neither.
    expect(rolloverOccurrences(yearOf(result, START_YEAR)).map((o) => o.producerOccurrenceKey)).toEqual([
      JSON.stringify(['rolloverInflow', 'pen-1', 'shared-target']),
      JSON.stringify(['rolloverInflow', 'pen-2', 'shared-target']),
    ])
    expect(rolloverApplications(yearOf(result, START_YEAR)).length).toBe(2)
    expect(rolloverOccurrences(yearOf(result, EMPLOYER_ELECTION_YEAR)).length).toBe(1)
    expect(
      rolloverApplications(yearOf(result, EMPLOYER_ELECTION_YEAR)),
      'an owned employer plan is not an aggregated IRA, so it publishes no application',
    ).toEqual([])
    expect(rolloverOccurrences(yearOf(result, ZERO_ELECTION_YEAR))).toEqual([])
    expect(rolloverApplications(yearOf(result, ZERO_ELECTION_YEAR))).toEqual([])
    expect(rolloverOccurrences(yearOf(result, 2027))).toEqual([])
  })

  // G4 — THE FOLD, with `toBe`, on a genuinely NON-ZERO-based accumulator. The
  // chain of before/after balances is what holds the caller to crediting row by
  // row: the second row's `before` must be the first row's `after`.
  it('credits the destination row by row, not pre-summed', () => {
    const { result, byYear } = run()
    let yearsWithTwoRows = 0
    let yearsThatDiscriminateAssociation = 0
    for (const year of result.years) {
      const applications = rolloverApplications(year)
      const rows = rowsFor(byYear, year.year).filter((r) => r.runtime?.creditsAggregatedIra === true)
      expect(applications.length, `application count ${year.year}`).toBe(rows.length)
      if (applications.length === 0) continue
      const base = applications[0]!.sourceBalanceBeforePlanDollars
      let rowByRow = base
      let summed = 0
      for (let i = 0; i < applications.length; i++) {
        const application = applications[i]!
        // The chain: each row starts where the previous one ended.
        expect(application.sourceBalanceBeforePlanDollars, `before ${year.year}[${i}]`).toBe(rowByRow)
        rowByRow += rows[i]!.amount
        summed += rows[i]!.amount
        expect(application.sourceBalanceAfterPlanDollars, `after ${year.year}[${i}]`).toBe(rowByRow)
        expect(application.creditedAmountPlanDollars, `credited ${year.year}[${i}]`).toBe(rows[i]!.amount)
      }
      if (applications.length > 1) yearsWithTwoRows++
      if (!Object.is(rowByRow, base + summed)) yearsThatDiscriminateAssociation++
    }
    expect(yearsWithTwoRows, 'fixture no longer has a year that credits two rows to one account').toBeGreaterThan(0)
    expect(
      yearsThatDiscriminateAssociation,
      'fixture no longer contains a year where row-by-row and summed-first credits differ, ' +
        'so this guard proves selection and per-row values only',
    ).toBeGreaterThan(0)
  })

  // G5 — THE STRUCTURAL PREMISES G2's positional attribution rests on.
  // `Array.isArray` catches a generator; `rowCountAtCall` catches an array
  // appended to after it was returned. A generator PASSES the count check
  // (both reads are `undefined`), so neither line is redundant.
  it('returns a materialized array that does not grow after it is returned', () => {
    const { phases } = run()
    expect(phases.length).toBeGreaterThan(0)
    let rowsSeen = 0
    for (const phase of phases) {
      const where = `year ${phase.input.year}`
      expect(Array.isArray(phase.rows), `${where} rows are not a materialized array`).toBe(true)
      expect(phase.rows.length, `${where} rows grew after the call returned`).toBe(phase.rowCountAtCall)
      rowsSeen += phase.rows.length
    }
    expect(rowsSeen, 'the fixture no longer elects any lump sum').toBe(4)
  })
})
