/**
 * The seam itself: `simulatePlan` must actually DELEGATE the TIPS-ladder annual
 * cash-flow phase to `internal/tipsLadderAnnualCashFlow.ts`, and must publish
 * exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a byte-for-byte
 * differential oracle, and identical output is that oracle's PASS condition —
 * so a `simulate.ts` reverted to the inlined arithmetic, leaving the helper
 * orphaned but present, passes it, and passes every other suite in the
 * repository too. Nothing else here observes the call. This file does, using
 * the same wrapped-module pattern as
 * `simulate.ownedNonRothIraAnnualSettlement.test.ts`: the real implementation
 * still runs, so no number changes; only the fact of the call is asserted.
 *
 * The FOLD is checked as well as the call, on all four accumulators the phase
 * feeds — `incomes.tipsLadder`, `ladderValueTotal`, `ladderTaxableInterest` and
 * `ordinaryIncome` — always with `toBe`, never `toBeCloseTo`. The caller folds
 * row by row precisely so that IEEE-754 addition order is preserved, and an
 * exact match is what shows it still does.
 *
 * Two of those accumulators need the fixture to be built a particular way, or
 * the assertion is satisfiable by arithmetic the extraction forbids:
 *
 *   - TWO OVERLAPPING LADDERS. A year whose totals fold a single row cannot
 *     tell row-by-row folding from summing first.
 *   - ORDINARY INCOME THAT IS ALREADY NON-ZERO. `ladderTaxableInterest` starts
 *     at zero, and `0 + t1 + t2` IS `0 + (t1 + t2)` in IEEE-754 — folding into
 *     it can never discriminate. `ordinaryIncome` is the accumulator that can,
 *     and only because wages, yield, and other income have already landed in
 *     it. The fixture therefore carries a flat ordinary income stream, and the
 *     taxable-fold test below asserts that at least one year actually
 *     distinguishes the two associations, so the guard cannot quietly go
 *     vacuous if the ladder numbers ever shift.
 *
 * The ladder IDs deliberately contain a character the line-ID grammar has to
 * percent-escape (`DOCS/features/year-cash-flow.md`, Stable line IDs; Plan IDs
 * are any non-empty string). Expected line IDs are built with the exported
 * `cashFlowLineIds` builder, never hand-spliced, so this file cannot drift from
 * the grammar it is checking.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedTipsLadderCash } from './annualCashFlowYearSites.js'
import type { TipsLadderYearInput, TipsLadderYearRow } from './internal/tipsLadderAnnualCashFlow.js'

/**
 * One ordered log of both seam events, so a record can be attributed to the
 * phase call it came from without the sink having to know the year. The annual
 * pass is re-entrant and builds a fresh sink per year (simulate.ts), so
 * position in this log — not a year map — is what ties the two together.
 */
type SeamEvent =
  | { readonly kind: 'phase'; readonly input: TipsLadderYearInput; readonly rows: readonly TipsLadderYearRow[] }
  | { readonly kind: 'recorded'; readonly row: RecordedTipsLadderCash }

const seam = vi.hoisted(() => ({ events: [] as SeamEvent[] }))

vi.mock('./internal/tipsLadderAnnualCashFlow.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/tipsLadderAnnualCashFlow.js')>()
  return {
    ...original,
    tipsLadderAnnualCashFlows: (input: Parameters<typeof original.tipsLadderAnnualCashFlows>[0]) => {
      const rows = original.tipsLadderAnnualCashFlows(input)
      seam.events.push({ kind: 'phase', input, rows })
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
      // real instance. Only the one recorder is observed, and it still forwards.
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordTipsLadderCash') {
            return (row: RecordedTipsLadderCash) => {
              seam.events.push({ kind: 'recorded', row })
              target.recordTipsLadderCash(row)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(target) : value
        },
      })
    },
  }
})

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator, TaxYearInput } from './types.js'

let counter = 0
const START_YEAR = 2026
const END_YEAR = 2034
/** Colons are grammar delimiters in a line ID, so these IDs must be escaped. */
const LADDER_A = 'floor:A'
const LADDER_B = 'floor:B'
/**
 * The fixture's ONLY non-ladder ordinary income: flat, un-indexed, and exactly
 * representable, so the pre-ladder value of `ordinaryIncome` is known to the
 * dollar in every projected year. The taxable-fold test below re-derives it
 * from a year in which the ladders contribute nothing, so this constant is
 * checked rather than trusted.
 */
const OTHER_ORDINARY_INCOME = 70_000

const taxInputs: TaxYearInput[] = []

/** The same flat-tax double the rest of the suite uses, with its input kept. */
function recordingTaxCalculator(): TaxCalculator {
  const inner = createFlatTaxCalculator(15)
  return {
    compute(input: TaxYearInput): number {
      taxInputs.push({ ...input })
      return inner.compute(input)
    },
  }
}

function plan(): Plan {
  const p = createEmptyPlan({ newId: () => `delegation-${++counter}`, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 95, source: 'manual' },
  }
  p.assumptions.inflationPct = 2.5
  p.assumptions.defaultReturnPct = 0
  p.assumptions.healthcareExtraInflationPct = 0
  const cash: Account = { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 400_000, annualContribution: 0 }
  p.accounts = [cash]
  // Ordinary income that lands BEFORE the ladder phase, so `ordinaryIncome` is
  // already non-zero when the phase folds into it — the precondition that makes
  // the fold order observable at all.
  p.incomes = [
    {
      type: 'recurring',
      id: 'inc1',
      label: 'Consulting',
      annualAmount: OTHER_ORDINARY_INCOME,
      startYear: null,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    },
  ]
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  // Two ladders, overlapping from 2029: the year's published totals are then a
  // fold of more than one row, so a caller that dropped, reordered, or
  // pre-summed the fold could not still match exactly.
  p.incomeFloor = {
    ladders: [
      { id: LADDER_A, name: 'Floor A', purpose: 'floor', startYear: 2027, endYear: 2032, annualRealAmount: 12_000 },
      { id: LADDER_B, name: 'Floor B', purpose: 'floor', startYear: 2029, endYear: 2033, annualRealAmount: 9_000, purchase: { year: 2028, fundingAccountId: 'cash1' } },
    ],
  }
  const parsed = parsePlan(p)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(options: { capture?: boolean } = {}) {
  seam.events.length = 0
  taxInputs.length = 0
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: recordingTaxCalculator(),
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
  })
  const phases = seam.events.filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase')
  const byYear = new Map<number, readonly TipsLadderYearRow[]>()
  // A year can be evaluated more than once (the annual pass is re-entrant);
  // the last evaluation is the one whose numbers were published.
  for (const phase of phases) byYear.set(phase.input.year, phase.rows)
  return { result, phases, byYear }
}

/** The flow rows' taxable amounts, in the order the helper returned them. */
function taxablesOf(rows: readonly TipsLadderYearRow[]): number[] {
  return rows.flatMap((row) => (row.kind === 'flow' ? [row.taxable] : []))
}

function taxInputsForYear(year: number): TaxYearInput[] {
  return taxInputs.filter((input) => input.year === year)
}

/** The one value every tax evaluation in a year saw, or a failure if they disagree. */
function soleTaxInput<K extends keyof TaxYearInput>(year: number, key: K): TaxYearInput[K] {
  const calls = taxInputsForYear(year)
  expect(calls.length, `no tax evaluation recorded for ${year}`).toBeGreaterThan(0)
  const distinct = [...new Set(calls.map((call) => call[key]))]
  expect(distinct, `every ${String(key)} evaluation in ${year} must agree`).toHaveLength(1)
  return distinct[0]!
}

describe('simulatePlan delegates the TIPS-ladder annual cash-flow phase', () => {
  it('calls the extracted helper for every projected year', () => {
    const { result, byYear } = run()
    expect(seam.events.some((e) => e.kind === 'phase')).toBe(true)
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect([...byYear.keys()].sort((a, b) => a - b)).toEqual(result.years.map((y) => y.year))
  })

  it('passes the year’s ladder states and scalars, not a re-derived copy', () => {
    const { phases } = run()
    const input = phases[0]!.input
    expect(input.ladderStates.map((ls) => ls.id)).toEqual([LADDER_A, LADDER_B])
    expect(input.year).toBe(START_YEAR)
    expect(input.startYear).toBe(START_YEAR)
    expect(input.anyAlive).toBe(true)
    expect(input.inflFactor).toBe(1)
    expect(typeof input.inflFactorFrom).toBe('function')
    expect(input.ladderLastAliveYear).toBeGreaterThan(START_YEAR)
  })

  it('publishes exactly the rows the helper returned, folded in row order', () => {
    const { result, byYear } = run()
    let yearsWithLadderCash = 0
    let yearsWithTwoRows = 0
    for (const year of result.years) {
      const rows = byYear.get(year.year)
      expect(rows, `no helper call recorded for ${year.year}`).toBeDefined()
      let cash = 0
      let value = 0
      let flowRows = 0
      for (const row of rows!) {
        if (row.kind === 'none') continue
        if (row.kind === 'flow') {
          cash += row.cash
          flowRows++
        }
        value += row.ladderValue
      }
      expect(year.incomes.tipsLadder, `tipsLadder ${year.year}`).toBe(cash)
      expect(year.ladderValue, `ladderValue ${year.year}`).toBe(value)
      if (cash > 0) yearsWithLadderCash++
      if (flowRows >= 2) yearsWithTwoRows++
    }
    // The fixture has to actually exercise the phase for the equalities above
    // to mean anything, including years folding two flow rows at once.
    expect(yearsWithLadderCash).toBeGreaterThan(4)
    expect(yearsWithTwoRows).toBeGreaterThan(2)
  })

  /**
   * The taxable leg leaves no mark on `YearResult`: it is spent on the tax
   * calculator's input, as `ordinaryIncome` (federal) and `usGovernmentInterest`
   * (the state exemption). Injecting the calculator is how it becomes visible,
   * and both accumulators are pinned here — the fold above never touched
   * either, so without this a caller could sum the taxable amounts across
   * ladders and add the total once, changing the IEEE-754 result, and stay
   * green.
   */
  it('folds each row’s taxable amount into the year’s tax input one row at a time', () => {
    const { result, byYear } = run()
    let yearsThatDiscriminateAssociation = 0
    let yearsWithTwoFlowRows = 0
    for (const year of result.years) {
      const taxables = taxablesOf(byYear.get(year.year) ?? [])

      // `ladderTaxableInterest` starts at zero and is handed over whole as the
      // U.S.-government-interest exemption.
      let ladderTaxableInterest = 0
      for (const taxable of taxables) ladderTaxableInterest += taxable
      expect(soleTaxInput(year.year, 'usGovernmentInterest'), `usGovernmentInterest ${year.year}`)
        .toBe(ladderTaxableInterest)

      // `ordinaryIncome` already holds the fixture's other income when the
      // phase runs, so THIS is the accumulator whose addition order is
      // observable. A year with no ladder taxable at all re-proves the base:
      // adding zero is exact, so it pins OTHER_ORDINARY_INCOME rather than
      // assuming it.
      let ordinaryIncome: number = OTHER_ORDINARY_INCOME
      for (const taxable of taxables) ordinaryIncome += taxable
      expect(soleTaxInput(year.year, 'ordinaryIncome'), `ordinaryIncome ${year.year}`).toBe(ordinaryIncome)

      let summedFirst = 0
      for (const taxable of taxables) summedFirst += taxable
      if (!Object.is(ordinaryIncome, OTHER_ORDINARY_INCOME + summedFirst)) yearsThatDiscriminateAssociation++
      if (taxables.length >= 2) yearsWithTwoFlowRows++
    }
    expect(yearsWithTwoFlowRows).toBeGreaterThan(2)
    // Without this the assertions above could all hold for a caller that summed
    // across ladders first. At least one year must actually separate the two.
    expect(
      yearsThatDiscriminateAssociation,
      'fixture no longer contains a year where row-by-row and summed-first folds differ',
    ).toBeGreaterThan(0)
  })

  /**
   * The fold above never touches `row.record`, and the default run never emits
   * it (`yearSites` is null unless the ledger is being captured). This is the
   * only assertion that the caller still hands each row's record to the
   * recorder. It is checked three ways, because the payload is what the
   * cash-flow report is built from:
   *
   *   (a) at the seam, field for field and unfiltered — every flow row's record
   *       reaches the sink, in row order, with all five fields intact. A caller
   *       that rebuilt the DTO with zeros, or dropped a leg, fails here;
   *   (b) in the published source lines, whose amount is the row's cash and
   *       whose `returnOfBasis` character is its maturing principal;
   *   (c) in the published phantom-OID metadata, whose amount is its accretion.
   *
   * Emission order is deliberately not asserted: `annualCashFlowCapture` sorts
   * every line list by line ID before publishing, so order is not observable
   * from a `ProjectionResult` at all.
   */
  it('hands each flow row’s ledger record to the cash-flow capture sites, payload intact', () => {
    const { result, byYear } = run({ capture: true })

    // (a) Seam: walk the interleaved log. The records that follow a phase call,
    // before the next one, are that call's — no year map needed, so this holds
    // even when a year is evaluated more than once.
    let recordedRows = 0
    for (let i = 0; i < seam.events.length; i++) {
      const event = seam.events[i]!
      if (event.kind !== 'phase') continue
      const followed: RecordedTipsLadderCash[] = []
      for (let j = i + 1; j < seam.events.length && seam.events[j]!.kind === 'recorded'; j++) {
        followed.push((seam.events[j] as Extract<SeamEvent, { kind: 'recorded' }>).row)
      }
      const expected = event.rows.flatMap((row) => (row.kind === 'flow' ? [row.record] : []))
      const where = `records for ${event.input.year}`
      // Unfiltered: the caller records EVERY flow row and lets the sink decide
      // what to keep, so an accretion-only row still reaches the ledger.
      expect(followed.length, `${where} count`).toBe(expected.length)
      for (const [k, want] of expected.entries()) {
        const got = followed[k]!
        expect(got.ladderId, `${where} [${k}] ladderId`).toBe(want.ladderId)
        expect(got.cash, `${where} [${k}] cash`).toBe(want.cash)
        expect(got.coupons, `${where} [${k}] coupons`).toBe(want.coupons)
        expect(got.maturingPrincipal, `${where} [${k}] maturingPrincipal`).toBe(want.maturingPrincipal)
        expect(got.accretion, `${where} [${k}] accretion`).toBe(want.accretion)
      }
      recordedRows += followed.length
    }
    expect(recordedRows, 'the capture run never recorded a ladder row').toBeGreaterThan(8)

    // (b) and (c): the same payload, as the report publishes it.
    let checkedYears = 0
    let yearsWithReturnOfBasis = 0
    let yearsWithPhantomOid = 0
    for (const year of result.years) {
      // `cash > 0` is the SOURCE-LINE rule, not the sink's. The sink keeps a
      // row when any of the four legs is positive — deliberately, so an
      // accretion-only row can still carry phantom-OID metadata — and
      // `annualCashFlowCapture` then omits a source line for any kept row with
      // `cash <= 0`. Composed, a `tipsLadderCash` source line exists exactly
      // when cash is positive, which is what this list is compared against.
      // The metadata path, which the broader keep-rule governs, is checked
      // below and is fed by part (a)'s unfiltered record stream.
      const expected = (byYear.get(year.year) ?? []).flatMap((row) =>
        row.kind === 'flow' && row.record.cash > 0 ? [row.record] : [],
      )
      const published = (year.cashFlow?.sourceLines ?? []).filter((line) => line.kind === 'tipsLadderCash')
      expect(published.map((line) => line.id).sort(), `line ids ${year.year}`).toEqual(
        expected.map((record) => cashFlowLineIds.sourceTipsLadderCash(record.ladderId)).sort(),
      )
      for (const record of expected) {
        const where = `${record.ladderId} ${year.year}`
        const line = published.find((candidate) => candidate.id === cashFlowLineIds.sourceTipsLadderCash(record.ladderId))
        expect(line?.amountPlanDollars, where).toBe(record.cash)
        // Maturing principal is a tax-free return of already-taxed dollars, and
        // the report's returnOfBasis column is where it surfaces.
        if (record.maturingPrincipal > 0) {
          expect(line?.taxCharacter, `${where} returnOfBasis`).toEqual([
            { kind: 'returnOfBasis', amountPlanDollars: record.maturingPrincipal },
          ])
          yearsWithReturnOfBasis++
        } else {
          expect(line?.taxCharacter, `${where} no returnOfBasis`).toBeUndefined()
        }
        // Accretion is the phantom OID a taxable holder reports with no cash to
        // pay it, published as standalone tax-character metadata.
        const oid = (year.cashFlow?.taxCharacterMetadata ?? []).find(
          (entry) => entry.id === cashFlowLineIds.metadataTipsPhantomOid(record.ladderId),
        )
        if (record.accretion !== 0) {
          expect(oid?.taxCharacter, `${where} phantom OID`).toEqual({
            kind: 'tipsPhantomOidIncome',
            amountPlanDollars: record.accretion,
          })
          expect(oid?.relatedLineId, `${where} phantom OID relatedLineId`).toBe(
            cashFlowLineIds.sourceTipsLadderCash(record.ladderId),
          )
          yearsWithPhantomOid++
        } else {
          expect(oid, `${where} no phantom OID`).toBeUndefined()
        }
      }
      if (expected.length > 0) checkedYears++
    }
    expect(checkedYears).toBeGreaterThan(4)
    expect(yearsWithReturnOfBasis).toBeGreaterThan(4)
    expect(yearsWithPhantomOid).toBeGreaterThan(4)
  })
})
