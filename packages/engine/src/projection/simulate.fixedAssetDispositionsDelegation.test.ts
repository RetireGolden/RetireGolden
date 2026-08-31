/**
 * The seam itself: `simulatePlan` must actually DELEGATE the fixed-asset
 * disposition phase to `internal/fixedAssetDispositions.ts`, and must publish
 * exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a byte-for-byte
 * differential oracle, and identical output is that oracle's PASS condition —
 * so a `simulate.ts` reverted to the inlined arithmetic, leaving the helper
 * orphaned but present, passes it, and passes every other suite in the
 * repository too. Nothing else here observes the call. This file does, with
 * the real implementation still running, so no number changes; only the fact
 * of the call is asserted.
 *
 * Matching numbers alone cannot pin that call. A `simulate.ts` that invokes
 * the helper for effect and then folds its own verbatim inline copy, recording
 * its own byte-identical payloads, is numerically indistinguishable from real
 * delegation. So the record test below asserts the published record IS the
 * helper's own object (`toBe`), not merely one that looks like it. Without
 * that identity check the extraction could quietly stop being load-bearing
 * while every suite in the repository stayed green, and the two copies of the
 * orchestration would then be free to drift apart.
 *
 * The FOLD is checked as well as the call, always with `toBe`, never
 * `toBeCloseTo`: IEEE-754 addition order is precisely what is being pinned.
 * What an exact match PROVES is not the same for every accumulator, and the
 * difference is worth stating rather than implying:
 *
 *   - `ordinaryIncome` and `oneTimeGains` are both already NON-ZERO when this
 *     phase runs — the first from wages, yield and other ordinary income, the
 *     second from a one-time capital-gain stream in the same year. For them
 *     `B + g1 + g2` and `B + (g1 + g2)` genuinely differ in IEEE-754, so an
 *     exact match rules out a caller that summed the gain legs across rows and
 *     added each total once. Both guards additionally COUNT the years that
 *     really separate the two associations and assert that count is non-zero,
 *     so neither can go quietly vacuous if the fixture's numbers ever shift.
 *   - `propertySaleProceedsTotal` is NOT asserted anywhere in this file. Two
 *     different things are true of it and only one of them is a non-issue. Its
 *     ASSOCIATION is uncatchable and nothing is missing there: it starts at
 *     ZERO each year, and `0 + a + b` IS `0 + (a + b)`, so summing across rows
 *     first is bit-identical. Its PRESENCE is a real regression that this file
 *     does NOT catch — deleting the caller's one `propertySaleProceedsTotal`
 *     fold leaves all 18 tests this extraction adds green, and fails only the
 *     pre-existing `projection/accountDepth`, `annualCashFlow.propertyHecm`
 *     and `annualCashFlow.sources` suites (measured). What this file does pin
 *     for those rows is their SELECTION and their per-row VALUES, in G5, from
 *     the published ledger rather than from the total.
 *
 * TWO SALES IN ONE YEAR. The fixture needs a year that folds more than one
 * row, or the association check has nothing to bite on. Note what that does
 * not buy: re-ORDERING the rows is a permutation, not a re-association, and
 * these guards do not catch one. Do not read that as a licence to reorder. In
 * IEEE-754 a permutation CAN change the last bit whenever the accumulator is
 * non-zero, because `(B + a) + b` and `(B + b) + a` are different computations;
 * it is only THIS fixture's ordinary addends that land on the same double
 * either way (measured: `(70000 + 35000.01) + 55000.04` and
 * `(70000 + 55000.04) + 35000.01` are both 160000.05000000002). Row ORDER is
 * pinned elsewhere — reversing the helper's returned rows fails three of the
 * helper's own unit tests in `internal/fixedAssetDispositions.test.ts`. (The
 * differential oracle sees one consequence of order too: two rows sharing a
 * property account id collide on one ledger line ID and the published line
 * lists are STABLY sorted, so reversing rows moved exactly one corpus entry.)
 *
 * The property account IDs deliberately contain a character the line-ID
 * grammar has to percent-escape (`DOCS/features/year-cash-flow.md`, Stable
 * line IDs; Plan IDs are any non-empty string). Expected line IDs are built
 * with the exported `cashFlowLineIds` builder, never hand-spliced, so this
 * file cannot drift from the grammar it is checking.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedPropertySale } from './annualCashFlowYearSites.js'
import type {
  FixedAssetDispositionRow,
  FixedAssetDispositionYearInput,
} from './internal/fixedAssetDispositions.js'

/**
 * One ordered log of both seam events, so a record can be attributed to the
 * phase call it came from without the sink having to know the year. The annual
 * pass is re-entrant and builds a fresh sink per year, so position in this log
 * — not a year map — is what ties the two together.
 */
type SeamEvent =
  | {
      readonly kind: 'phase'
      readonly input: FixedAssetDispositionYearInput
      readonly rows: readonly FixedAssetDispositionRow[]
      /**
       * `propertyValues` and `hecmStates` cross the seam BY REFERENCE — they
       * are the simulator's own live maps, which later phases go on mutating
       * (the property-events block zeroes a sold home's value; the caller
       * deletes the closed line). Reading them after the run would show final
       * state, not what this call saw, so the two facts the input test cares
       * about are snapshotted here, at call time. The real `input` still flows
       * through to the real helper untouched.
       */
      readonly propertyValuesAtCall: ReadonlyMap<string, number>
      readonly hecmBalancesAtCall: ReadonlyMap<string, number>
    }
  | { readonly kind: 'recorded'; readonly row: RecordedPropertySale }

const seam = vi.hoisted(() => ({ events: [] as SeamEvent[] }))

vi.mock('./internal/fixedAssetDispositions.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/fixedAssetDispositions.js')>()
  return {
    ...original,
    fixedAssetDispositions: (input: Parameters<typeof original.fixedAssetDispositions>[0]) => {
      const rows = original.fixedAssetDispositions(input)
      seam.events.push({
        kind: 'phase',
        input,
        rows,
        propertyValuesAtCall: new Map(input.propertyValues),
        hecmBalancesAtCall: new Map([...input.hecmStates].map(([id, line]) => [id, line.loanBalance])),
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
      // real instance. Only the one recorder is observed, and it still forwards.
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordPropertySaleProceeds') {
            return (row: RecordedPropertySale) => {
              seam.events.push({ kind: 'recorded', row })
              target.recordPropertySaleProceeds(row)
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
import { productionTaxCalculator } from '../testing/planFixtures.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator, TaxYearInput } from './types.js'

let counter = 0
const START_YEAR = 2026
const END_YEAR = 2050
/** The year both exact-taxed sales land in — the association discriminator. */
const TWO_SALE_YEAR = 2030
/** A sale-free year, used to RE-DERIVE both fold bases from output. */
const QUIET_YEAR = 2029
const HECM_SALE_YEAR = 2032
const HECM_ZERO_SALE_YEAR = 2033
/** Far enough out that the line has outgrown the house — a non-recourse clamp to zero net. */
const HECM_UNDERWATER_SALE_YEAR = 2049
/** Colons are grammar delimiters in a line ID, so these IDs must be escaped. */
const SALE_A = 'lot:A'
const SALE_B = 'lot:B'
const HECM_HOME = 'lot:HECM'
const HECM_ZERO_HOME = 'lot:HECM0'
const HECM_UNDERWATER_HOME = 'lot:UW'

/**
 * The fixture's ONLY non-sale ordinary income: flat, un-indexed and exactly
 * representable, so `ordinaryIncome` is non-zero before the phase folds into
 * it. The fold test re-derives the actual base from `QUIET_YEAR` rather than
 * trusting this constant.
 */
const OTHER_ORDINARY_INCOME = 70_000
/**
 * A one-time capital gain in EVERY projected year, so `oneTimeGains` is already
 * non-zero when the phase folds into it — and so the base is re-derivable from
 * a sale-free year rather than assumed. Only `oneTime` streams reach
 * `oneTimeGains`; a recurring stream with the same tax treatment does not.
 *
 * Like the recapture pair, this value is chosen so the two associations land on
 * different doubles against THIS fixture's capital legs: a round 33_000 base
 * folded bit-identically both ways and would have made the capital association
 * guard vacuous. The guard measures that rather than assuming it.
 */
const ONE_TIME_GAIN = 12_345.67

/**
 * Recapture drives `ordinaryGain` exactly (the calculator clamps the ordinary
 * leg to `min(gain, recapture)`), so these two values ARE the two ordinary
 * addends this fixture folds. They are deliberately not round, and not chosen
 * by eye: with the base below, `B + a + b` and `B + (a + b)` must land on
 * DIFFERENT doubles or the association guard proves nothing. The first pair
 * tried here (40_137.11 / 60_291.11) folded bit-identically both ways and was
 * replaced. The guard asserts that non-vacuity rather than trusting it.
 */
const RECAPTURE_A = 35_000.01
const RECAPTURE_B = 55_000.04

const taxInputs: TaxYearInput[] = []

/** The production federal+state stack, with every input kept. */
function recordingTaxCalculator(): TaxCalculator {
  const inner = productionTaxCalculator()
  return {
    compute(input: TaxYearInput): number {
      taxInputs.push({ ...input })
      return inner.compute(input)
    },
  }
}

function property(id: string, over: Partial<Extract<Account, { type: 'property' }>>): Account {
  return {
    type: 'property',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: null,
    value: 500_000,
    expectedNetProceeds: 0,
    sellingCostPct: 6,
    ...over,
  } as Account
}

function plan(): Plan {
  const p = createEmptyPlan({ newId: () => `delegation-${++counter}`, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1956-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 95, source: 'manual' },
  }
  p.household.filingStatus = 'single'
  p.household.state = 'KY'
  p.assumptions.inflationPct = 2.5
  p.assumptions.defaultReturnPct = 0
  p.assumptions.healthcareExtraInflationPct = 0
  const cash: Account = {
    type: 'cash',
    id: 'cash1',
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 400_000,
    annualContribution: 0,
  }
  p.accounts = [
    cash,
    // Two exact-taxed sales in ONE year. Both non-primary, so the §121
    // exclusion cap is zero and both rows carry a positive CAPITAL leg; both
    // carry recapture, so both carry a positive ORDINARY leg too. Without both
    // legs positive on both rows the two association guards have nothing to
    // discriminate.
    property(SALE_A, {
      value: 480_000,
      plannedSaleYear: TWO_SALE_YEAR,
      costBasis: 210_000,
      depreciationRecapture: RECAPTURE_A,
      primaryResidence: false,
    }),
    property(SALE_B, {
      value: 610_000,
      plannedSaleYear: TWO_SALE_YEAR,
      costBasis: 260_000,
      depreciationRecapture: RECAPTURE_B,
      primaryResidence: false,
    }),
    // A HECM line that is drawn (upfront costs seed the balance) and must be
    // CLOSED by its own collateral's sale.
    property(HECM_HOME, {
      value: 300_000,
      plannedSaleYear: HECM_SALE_YEAR,
      costBasis: 150_000,
      primaryResidence: true,
      hecm: { openYear: 2027, principalLimitPct: 50, upfrontCostPct: 3, growthRatePct: 4, drawPolicy: 'lastResort' },
    }),
    // A line opened and never drawn: the payoff is zero but the line still closes.
    property(HECM_ZERO_HOME, {
      value: 280_000,
      plannedSaleYear: HECM_ZERO_SALE_YEAR,
      costBasis: 140_000,
      primaryResidence: true,
      hecm: { openYear: 2027, principalLimitPct: 50, upfrontCostPct: 0, growthRatePct: 4, drawPolicy: 'lastResort' },
    }),
    // A line that outgrows its collateral. The non-recourse clamp takes the
    // sale's net to exactly zero while the gain character stays non-zero — the
    // one shape that reaches the ledger's STANDALONE tax-character path, where
    // the zero-net source line is omitted but the character still publishes.
    property(HECM_UNDERWATER_HOME, {
      value: 300_000,
      plannedSaleYear: HECM_UNDERWATER_SALE_YEAR,
      costBasis: 100_000,
      depreciationRecapture: 30_000,
      sellingCostPct: 25,
      primaryResidence: true,
      hecm: { openYear: 2027, principalLimitPct: 75, upfrontCostPct: 10, growthRatePct: 15, drawPolicy: 'lastResort' },
    }),
  ]
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
    // One per projected year, so every year's `oneTimeGains` base is the same
    // known non-zero amount and a sale-free year can supply it.
    ...Array.from({ length: END_YEAR - START_YEAR + 1 }, (_unused, i) => ({
      type: 'oneTime' as const,
      id: `gain-${START_YEAR + i}`,
      label: 'Partnership distribution',
      year: START_YEAR + i,
      amount: ONE_TIME_GAIN,
      taxTreatment: 'capitalGain' as const,
    })),
  ]
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
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
  const byYear = new Map<number, readonly FixedAssetDispositionRow[]>()
  // A year can be evaluated more than once (the annual pass is re-entrant);
  // the last evaluation is the one whose numbers were published.
  for (const phase of phases) byYear.set(phase.input.year, phase.rows)
  return { result, phases, byYear }
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

describe('simulatePlan delegates the fixed-asset disposition phase', () => {
  // G1 — defeats the FULLY ORPHANED helper. This is the assertion a
  // `simulate.ts` reverted to the inlined arithmetic fails while the
  // differential oracle and every other suite in the repository stay green.
  it('calls the extracted helper for every projected year', () => {
    const { result, byYear } = run()
    expect(seam.events.some((e) => e.kind === 'phase')).toBe(true)
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect([...byYear.keys()].sort((a, b) => a - b)).toEqual(result.years.map((y) => y.year))
  })

  // G2 — the input is the year's real state: the right values, and the
  // simulator's own live maps rather than per-call rebuilds.
  it('passes the year’s real state, and its live maps by reference', () => {
    const { phases } = run()
    expect(phases.length).toBeGreaterThan(1)
    const first = phases[0]!.input
    expect(first.accounts.map((a) => a.id)).toEqual([
      'cash1',
      SALE_A,
      SALE_B,
      HECM_HOME,
      HECM_ZERO_HOME,
      HECM_UNDERWATER_HOME,
    ])
    expect(first.year).toBe(START_YEAR)
    expect(first.filingStatus).toBe('single')
    expect(typeof first.inflRateAt).toBe('function')
    expect(first.pack.federalTax.section121Exclusion.single).toBeGreaterThan(0)
    // The property values are the projected ones, and grow year over year.
    expect(phases[0]!.propertyValuesAtCall.get(SALE_A)).toBe(480_000)
    const saleYear = phases.find((p) => p.input.year === TWO_SALE_YEAR)!
    expect(saleYear.propertyValuesAtCall.get(SALE_A)!).toBeGreaterThan(480_000)
    // The open HECM line is still in the map when its own sale year arrives.
    const hecmYear = phases.find((p) => p.input.year === HECM_SALE_YEAR)!
    expect(hecmYear.hecmBalancesAtCall.get(HECM_HOME)!).toBeGreaterThan(0)
    // The two maps cross the seam BY REFERENCE — the simulator's own, declared
    // once outside the year loop, not a snapshot rebuilt per call. Without this
    // a caller that handed the helper `new Map(propertyValues)` each year
    // satisfied every other assertion in this file (measured). Be exact about
    // what it buys: it is a STRUCTURAL pin, not a numeric one — such a copy
    // carries identical contents, so no projection number would move — and it
    // is also what lets the snapshots above be read as what the call saw.
    // `accounts` and `inflRateAt` are deliberately NOT pinned by identity: a
    // copied array or a re-wrapped lookup cannot change a number.
    expect(phases[1]!.input.propertyValues).toBe(phases[0]!.input.propertyValues)
    expect(phases[1]!.input.hecmStates).toBe(phases[0]!.input.hecmStates)
  })

  // G3 — THE OBJECT-IDENTITY ASSERTION (defeats the HALF-ORPHANED duplicate).
  // Capture mode is mandatory here: `yearSites` is null under default options,
  // so a default-only run never reaches `recordPropertySaleProceeds` at all.
  it('publishes the helper’s own record objects, not look-alike rebuilds', () => {
    run({ capture: true })
    let recordedRows = 0
    for (let i = 0; i < seam.events.length; i++) {
      const event = seam.events[i]!
      if (event.kind !== 'phase') continue
      // The records that follow this phase call, before the next one, are its.
      const followed: RecordedPropertySale[] = []
      for (let j = i + 1; j < seam.events.length; j++) {
        const next = seam.events[j]!
        if (next.kind === 'phase') break
        followed.push(next.row)
      }
      // Every row is recorded; the sink, not the caller, decides what to keep.
      const expected = event.rows
      const where = `year ${event.input.year}`
      expect(followed.length, `${where} recorded a different number of rows`).toBe(expected.length)
      for (let k = 0; k < expected.length; k++) {
        const want = expected[k]!.record
        const got = followed[k]!
        // The load-bearing one. A caller that invokes the helper for effect and
        // then records its own byte-identical rebuild satisfies every field
        // comparison below and every other suite in the repository, and fails
        // only this. Because both sides are then the SAME object, the field
        // comparisons cannot catch a caller that MUTATED a leg of the helper's
        // record in place — G5 catches that, from the published report.
        expect(got, `${where} [${k}] is not the helper's own record object`).toBe(want)
        expect(got.propertyAccountId).toBe(want.propertyAccountId)
        expect(got.netProceedsAfterHecm).toBe(want.netProceedsAfterHecm)
        expect(got.ordinaryGain).toBe(want.ordinaryGain)
        expect(got.capitalGain).toBe(want.capitalGain)
        recordedRows++
      }
    }
    // An explicit floor, so the identity check can never silently degrade to a
    // call-count check if the fixture ever stops selling anything.
    expect(recordedRows, 'the fixture no longer records any property sale').toBeGreaterThan(3)
  })

  // G4(a) — LIVE ASSOCIATION GUARD on `ordinaryIncome`.
  it('folds the ordinary legs into the year’s tax base row by row, not pre-summed', () => {
    const { result, byYear } = run()
    // Re-derived from a sale-free year: adding nothing is exact, so the base is
    // checked against output rather than trusted from the fixture constant.
    const base = soleTaxInput(QUIET_YEAR, 'ordinaryIncome')
    expect(base).toBe(OTHER_ORDINARY_INCOME)
    let yearsWithTwoRows = 0
    let yearsThatDiscriminateAssociation = 0
    for (const year of result.years) {
      const rows = byYear.get(year.year)
      expect(rows, `no helper call recorded for ${year.year}`).toBeDefined()
      let rowByRow = base
      let summed = 0
      for (const row of rows!) {
        rowByRow += row.ordinaryGain
        summed += row.ordinaryGain
      }
      if (rows!.length > 1) yearsWithTwoRows++
      if (!Object.is(rowByRow, base + summed)) yearsThatDiscriminateAssociation++
      // `toBe`, never `toBeCloseTo`: addition ORDER is what is being pinned.
      expect(soleTaxInput(year.year, 'ordinaryIncome'), `ordinaryIncome ${year.year}`).toBe(rowByRow)
    }
    expect(yearsWithTwoRows, 'fixture no longer has a year that folds two rows').toBeGreaterThan(0)
    expect(
      yearsThatDiscriminateAssociation,
      'fixture no longer contains a year where row-by-row and summed-first ordinary folds differ',
    ).toBeGreaterThan(0)
  })

  // G4(b) — SECOND LIVE ASSOCIATION GUARD, on `oneTimeGains`. Which published
  // field carries it was determined by inspecting the captured tax inputs for
  // this fixture, not assumed: with no taxable account, no allocation policy
  // and no retirement actions, nothing else reaches `capitalGains`, so it is
  // `oneTimeGains` unmixed.
  it('folds the capital legs into the year’s tax base row by row, not pre-summed', () => {
    const { result, byYear } = run()
    const base = soleTaxInput(QUIET_YEAR, 'capitalGains')
    expect(base).toBe(ONE_TIME_GAIN)
    let yearsThatDiscriminateAssociation = 0
    for (const year of result.years) {
      const rows = byYear.get(year.year)!
      let rowByRow = base
      let summed = 0
      for (const row of rows) {
        rowByRow += row.capitalGain
        summed += row.capitalGain
      }
      if (!Object.is(rowByRow, base + summed)) yearsThatDiscriminateAssociation++
      expect(soleTaxInput(year.year, 'capitalGains'), `capitalGains ${year.year}`).toBe(rowByRow)
    }
    expect(
      yearsThatDiscriminateAssociation,
      'fixture no longer contains a year where row-by-row and summed-first capital folds differ',
    ).toBeGreaterThan(0)
  })

  // G4(d) — HECM closure, observed from published output rather than the seam.
  it('closes the HECM line on the sold home', () => {
    const { result, byYear } = run()
    const balanceIn = (year: number): number => result.years.find((y) => y.year === year)!.hecmLoanBalance
    // The drawn line: open and compounding right up to its sale year, and gone
    // from the year-end total the moment its own collateral sells. A line that
    // stayed open would have GROWN, so a strict decrease can only be closure.
    expect(balanceIn(HECM_SALE_YEAR - 1)).toBeGreaterThan(0)
    expect(balanceIn(HECM_SALE_YEAR)).toBeLessThan(balanceIn(HECM_SALE_YEAR - 1))
    // Every line is closed by its own sale, so once the last one sells the
    // published year-end total is exactly zero for the rest of the horizon.
    for (const year of result.years) {
      if (year.year < HECM_UNDERWATER_SALE_YEAR) continue
      expect(balanceIn(year.year), `hecmLoanBalance ${year.year}`).toBe(0)
    }
    // Which rows claimed a closure, and the zero-balance case among them. That
    // line contributes 0 to `hecmLoanBalance` whether it is open or closed, so
    // its closure is NOT observable in `ProjectionResult`; the helper's own
    // unit test pins the contract, and the differential oracle measured that
    // dropping the delete moves output for the drawn cases.
    const closures = [...byYear].flatMap(([year, rows]) =>
      rows.filter((r) => r.closesHecmForAccountId !== null).map((r) => [year, r.closesHecmForAccountId] as const),
    )
    expect(closures).toEqual([
      [HECM_SALE_YEAR, HECM_HOME],
      [HECM_ZERO_SALE_YEAR, HECM_ZERO_HOME],
      [HECM_UNDERWATER_SALE_YEAR, HECM_UNDERWATER_HOME],
    ])
    const zeroRow = byYear.get(HECM_ZERO_SALE_YEAR)![0]!
    expect(zeroRow.propertyAccountId).toBe(HECM_ZERO_HOME)
    expect(zeroRow.netProceedsAfterHecm).toBeGreaterThan(0)
  })

  // G5 — catches an in-place mutation of the helper's record, the one residual
  // G3 cannot reach: this reads the PUBLISHED report rather than the seam.
  //
  // The year's proceeds TOTAL is not itself a published field, so what is
  // pinned here is narrower and exact: every row's own published amount and
  // gain character, `toBe`-exact. It pins nothing about the caller's
  // `propertySaleProceedsTotal` fold, whose presence and association are both
  // discussed in the file header.
  it('publishes each row’s amount and gain character to the ledger', () => {
    const { result, byYear } = run({ capture: true })
    let rowsPublished = 0
    let rowsWithStandaloneCharacter = 0
    for (const year of result.years) {
      const cashFlow = year.cashFlow
      expect(cashFlow, `no cash flow captured for ${year.year}`).toBeDefined()
      const rows = byYear.get(year.year)!
      const sourceLines = cashFlow!.sourceLines.filter((l) => l.kind === 'propertySaleProceeds')
      const positive = rows.filter((r) => r.netProceedsAfterHecm > 0)
      // Line IDs come from the exported builder, never hand-spliced, so this
      // cannot drift from the grammar it checks.
      expect(new Set(sourceLines.map((l) => l.id))).toEqual(
        new Set(positive.map((r) => cashFlowLineIds.sourcePropertySaleProceeds(r.propertyAccountId))),
      )
      for (const row of positive) {
        const line = sourceLines.find(
          (l) => l.id === cashFlowLineIds.sourcePropertySaleProceeds(row.propertyAccountId),
        )!
        expect(line.amountPlanDollars, `${year.year} ${row.propertyAccountId}`).toBe(row.netProceedsAfterHecm)
        const legs = line.taxCharacter ?? []
        const leg = (kind: string): number =>
          legs.filter((c) => c.kind === kind).reduce((total, c) => total + c.amountPlanDollars, 0)
        if (row.ordinaryGain !== 0) expect(leg('ordinaryIncome')).toBe(row.ordinaryGain)
        if (row.capitalGain !== 0) expect(leg('capitalGain')).toBe(row.capitalGain)
        rowsPublished++
      }
      // The zero-net rows the sink deliberately keeps: their source line is
      // omitted, and the gain character publishes standalone instead.
      for (const row of rows) {
        if (row.netProceedsAfterHecm > 0) continue
        if (row.ordinaryGain === 0 && row.capitalGain === 0) continue
        const standaloneAt = (id: string): number => {
          const found = cashFlow!.taxCharacterMetadata.filter((m) => m.id === id)
          expect(found, `${year.year} ${row.propertyAccountId} standalone ${id}`).toHaveLength(1)
          return found[0]!.taxCharacter.amountPlanDollars
        }
        if (row.ordinaryGain !== 0) {
          expect(standaloneAt(cashFlowLineIds.metadataPropertySaleOrdinaryIncome(row.propertyAccountId))).toBe(
            row.ordinaryGain,
          )
        }
        if (row.capitalGain !== 0) {
          expect(standaloneAt(cashFlowLineIds.metadataPropertySaleCapitalGain(row.propertyAccountId))).toBe(
            row.capitalGain,
          )
        }
        rowsWithStandaloneCharacter++
      }
    }
    expect(rowsPublished, 'no property sale reached the ledger as a source line').toBeGreaterThan(0)
    expect(
      rowsWithStandaloneCharacter,
      'no zero-net property sale reached the ledger as standalone tax character',
    ).toBeGreaterThan(0)
  })
})
