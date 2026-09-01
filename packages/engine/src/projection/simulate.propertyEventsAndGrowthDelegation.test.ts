/**
 * The seam itself: `simulatePlan` must actually DELEGATE the property
 * events + growth phase to `internal/propertyEventsAndGrowth.ts`, and must
 * apply exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a differential
 * equivalence dump (`scripts/equivalence.mjs` — the app compared against itself
 * across two source trees; DOCS/testing.md reserves "oracle" for a CORRECTNESS
 * oracle, and this is not one). Identical output is that dump's PASS condition,
 * so it cannot see an orphaned helper. It is worth saying how thin the existing
 * coverage of this phase was, because it explains the shape of G3: deleting
 * `line.principalLimit *= growth` outright passed every test in the repository
 * except the ones this work adds — measured on this tree with the eleven new
 * files held back, 285 files / 5,499 tests, all green — and deleting the
 * property value growth failed exactly one test, and that one a neighbouring
 * phase's seam guard rather than a behavioural check.
 *
 * CALIBRATION — every guard below was proved to discriminate by injecting the
 * defect it exists for and recording WHICH named tests failed. Measured over
 * this file and the helper's own unit tests together (7 + 22 = 29 tests):
 *
 *   orphan (call site re-inlined from the pristine   5 fail — G1, G2a, G2b, G4,
 *   block, helper present and never called)          G5. All 22 helper unit
 *                                                    tests still pass, and so
 *                                                    does the differential dump:
 *                                                    measured, the orphaned tree
 *                                                    reproduced the baseline over
 *                                                    all 228 corpus entries at
 *                                                    the same sha256
 *                                                    ed0fb0bb…1382ae. G3, whose
 *                                                    expectations are entirely
 *                                                    fixture-derived, correctly
 *                                                    PASSES — an orphan moves no
 *                                                    number
 *   half-orphan (helper called for effect, the       2 fail — G2a on its `toBe`
 *   inline copy run and its ledger payload           identity line, and G2b
 *   rebuilt at the call site)                        because a caller that
 *                                                    ignores the return value
 *                                                    cannot be moved by
 *                                                    perturbing it. That is the
 *                                                    two halves of G2 doing the
 *                                                    two different jobs the note
 *                                                    below describes
 *   under-production: `if (year === 2029) return`    3 fail. G3 by name, on the
 *   no rows for one in-horizon year                  fixture-derived value
 *                                                    series (437090.8 against
 *                                                    450203.524); G1 and G2a
 *                                                    only through their exact
 *                                                    row counts
 *
 * WHY G2 IS TWO TESTS RATHER THAN ONE, and the honest framing of that. Most of
 * this phase's product is MAP MUTATION — a value written back, a line closed, a
 * line compounded — and value-equality cannot tell a caller that used the
 * returned row from one that recomputed the same numbers itself. Only one
 * object's identity reaches observable output: the legacy-sale ledger payload,
 * which G2a pins with a genuine `toBe`. G2b covers the rest a different way: it
 * TAMPERS with the helper's return value and requires the projection to move.
 * That is a "the return value is load-bearing" guard, not an identity guard,
 * and calling it one would be an overclaim. The two together meet the purpose
 * an identity assertion serves; neither does alone.
 *
 * THERE IS NO FOLD IN THIS PHASE. No `+=` appears anywhere in it: the
 * arithmetic is per-row multiplicative in place plus `deposit()` calls. So no
 * fold guard is written here and none is claimed. The order sensitivity that a
 * fold guard would normally protect is real, and lives instead in the three
 * read-after-write channels the helper's numeric shadow reproduces, together
 * with the once-per-line-id accrual guard — pinned by the helper's own unit
 * tests and the duplicate-id regression below.
 *
 * WHOLE-LOG ACCOUNTING, and where it does NOT apply. `legacyPropertySaleDeposits`
 * is safe to attribute wholesale: this phase is its only producer. `deposit` is
 * NOT — the surplus deposit fires immediately before this phase and the
 * insurance death benefit immediately after — so nothing here attributes a
 * balance change to this phase by proximity.
 */
import { describe, expect, it, vi } from 'vitest'

import type { AssembleYearCashFlowInput } from './annualCashFlowCapture.js'
import type {
  LegacyPropertySaleDeposit,
  PropertyEventRow,
  PropertyEventYearInput,
} from './internal/propertyEventsAndGrowth.js'

type PhaseEvent = {
  readonly input: PropertyEventYearInput
  readonly rows: readonly PropertyEventRow[]
  /** `rows.length` read the instant the helper returned. */
  readonly rowCountAtCall: number
  readonly accountIdsAtCall: readonly string[]
  /** Both live maps, snapshotted at call time. */
  readonly valuesAtCall: readonly (readonly [string, number])[]
  readonly linesAtCall: readonly (readonly [string, { principalLimit: number; loanBalance: number }])[]
}

const seam = vi.hoisted(() => ({
  phases: [] as PhaseEvent[],
  /** One entry per published year, in year order. See G2a. */
  published: [] as (readonly LegacyPropertySaleDeposit[])[],
  /** G2b: when set, the wrapper perturbs the rows before handing them on. */
  tamper: null as null | 'value' | 'hecmGrowth' | 'deposit',
}))

vi.mock('./internal/propertyEventsAndGrowth.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/propertyEventsAndGrowth.js')>()
  return {
    ...original,
    propertyEventsAndGrowth: (input: Parameters<typeof original.propertyEventsAndGrowth>[0]) => {
      const produced = original.propertyEventsAndGrowth(input)
      const rows =
        seam.tamper === null
          ? produced
          : produced.map((row) => {
              if (seam.tamper === 'value') return { ...row, value: row.value + 1_000 }
              if (seam.tamper === 'hecmGrowth') {
                return row.hecmGrowth === null ? row : { ...row, hecmGrowth: row.hecmGrowth + 0.01 }
              }
              return row.deposit === null ? row : { ...row, deposit: row.deposit + 1_000 }
            })
      seam.phases.push({
        input,
        rows,
        rowCountAtCall: rows.length,
        accountIdsAtCall: input.accounts.map((a) => a.id),
        valuesAtCall: [...input.propertyValues].map(([id, v]) => [id, v] as const),
        linesAtCall: [...input.hecmStates].map(
          ([id, l]) => [id, { principalLimit: l.principalLimit, loanBalance: l.loanBalance }] as const,
        ),
      })
      return rows
    },
  }
})

vi.mock('./annualCashFlowCapture.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./annualCashFlowCapture.js')>()
  return {
    ...original,
    assembleYearCashFlow: (input: AssembleYearCashFlowInput) => {
      // The live array `simulate.ts` pushed into, captured element by element
      // at the one point it is handed over — the elements are the payload
      // objects themselves, which is what makes G2a's `toBe` possible. The
      // input carries no year field, so entries are paired with `result.years`
      // POSITIONALLY, and G2a asserts the two lengths match rather than
      // assuming one call per year.
      seam.published.push([...input.passLocals.legacyPropertySaleDeposits])
      return original.assembleYearCashFlow(input)
    },
  }
})

import { parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'

const START_YEAR = 2026
const END_YEAR = 2031
const noTax = createFlatTaxCalculator(0)
const INFLATION_PCT = 3
const LINE_GROWTH_PCT = 7.5

/**
 * Four property accounts, each reaching a different arm of the phase:
 *
 *   grow        value growth alone, and the only row that runs every year
 *   sale        a legacy `expectedNetProceeds` sale, no HECM, mid-horizon
 *   line        a HECM line that opens and just accrues
 *   lineSale    a HECM line repaid non-recourse by a legacy sale with NO
 *               quoted proceeds, so the payoff is clamped against the grown value
 */
const GROW = { id: 'home-grow', value: 400_000 } as const
const SALE = { id: 'home-sale', value: 300_000, saleYear: START_YEAR + 2, proceeds: 250_000 } as const
const LINE = { id: 'home-line', value: 500_000, upfrontPct: 2 } as const
const LINE_SALE = { id: 'home-line-sale', value: 350_000, upfrontPct: 2, saleYear: START_YEAR + 3 } as const

const property = (id: string, value: number, extra: Record<string, unknown> = {}): Account =>
  ({
    type: 'property',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    value,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    ...extra,
  }) as Account

const withHecm = (upfrontCostPct: number) => ({
  primaryResidence: true,
  hecm: {
    openYear: START_YEAR,
    growthRatePct: LINE_GROWTH_PCT,
    drawPolicy: 'lastResort' as const,
    principalLimitPct: 40,
    upfrontCostPct,
  },
})

function plan(): Plan {
  const p = singlePersonPlan({ dob: '1956-01-01', planningAge: 90 })
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  p.assumptions.inflationPct = INFLATION_PCT
  p.assumptions.defaultReturnPct = 0
  p.accounts = [
    property(GROW.id, GROW.value),
    property(SALE.id, SALE.value, { plannedSaleYear: SALE.saleYear, expectedNetProceeds: SALE.proceeds }),
    property(LINE.id, LINE.value, withHecm(LINE.upfrontPct)),
    property(LINE_SALE.id, LINE_SALE.value, { ...withHecm(LINE_SALE.upfrontPct), plannedSaleYear: LINE_SALE.saleYear }),
    traditionalAccount('ira', 400_000),
  ]
  return validatePlan(p)
}

function run(options: { capture?: boolean; tamper?: 'value' | 'hecmGrowth' | 'deposit' } = {}): {
  result: ProjectionResult
  phases: readonly PhaseEvent[]
} {
  seam.phases.length = 0
  seam.published.length = 0
  seam.tamper = options.tamper ?? null
  try {
    const result = simulatePlan(plan(), {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: noTax,
      ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
    })
    return { result, phases: [...seam.phases] }
  } finally {
    seam.tamper = null
  }
}

const yearOf = (result: ProjectionResult, year: number): YearResult => {
  const found = result.years.find((y) => y.year === year)
  if (found === undefined) throw new Error(`the projection published no year ${year}`)
  return found
}

/** The fixture's own value series: repeated multiplication, as the phase does it. */
function grownValue(base: number, years: number): number {
  let value = base
  for (let i = 0; i < years; i++) value *= 1 + INFLATION_PCT / 100
  return value
}

/** The fixture's own line balance: opening upfront cost, compounded once a year. */
function grownLoan(base: number, upfrontPct: number, years: number): number {
  let balance = (upfrontPct / 100) * base
  for (let i = 0; i < years; i++) balance *= 1 + LINE_GROWTH_PCT / 100
  return balance
}

const legacyLineIds = (year: YearResult): string[] =>
  (year.cashFlow?.sourceLines ?? []).filter((l) => l.kind === 'legacyPropertySaleDeposit').map((l) => l.id)

/**
 * G3's premise, CHECKED: `drawPolicy: 'lastResort'` with nothing to spend never
 * draws, so a published loan balance is the opening balance compounded and
 * nothing else.
 */
function noDrawsHappened(result: ProjectionResult): void {
  for (const year of result.years) expect(year.hecmDraw, `hecmDraw ${year.year}`).toBe(0)
}

describe('simulatePlan delegates property events and growth', () => {
  it('advances one parse-valid duplicate-id HECM line exactly once per year', () => {
    /**
     * Repository model contract: `hecmStates` stores exactly one mutable line
     * per property-account id, with one principal limit and one loan balance.
     * Duplicate property rows can legally share an id when no retirement
     * action references it, but the simulation boundary selects one canonical
     * row before this phase. That row creates one contract and one annual
     * accrual; the helper never receives a second alias row.
     *
     * Independent worksheet for one 2026 accrual:
     *   principal limit = $400,000 x 40% x 1.075 = $172,000
     *   loan balance    = $400,000 x  2% x 1.075 =   $8,600
     * A second property row with the same id is neither a second HECM line nor
     * a second helper row, and therefore must not apply another multiplier.
     */
    const project = (propertyRows: number) => {
      const p = singlePersonPlan({ dob: '1956-01-01', planningAge: 90 })
      p.expenses.baseAnnual = 0
      p.expenses.healthcare = {
        pre65MonthlyPremiumPerPerson: 0,
        applyAcaCredit: false,
        medicareExtrasMonthlyPerPerson: 0,
      }
      p.assumptions.inflationPct = 0
      p.assumptions.defaultReturnPct = 0
      p.accounts = [
        ...Array.from({ length: propertyRows }, (_, index) =>
          property('shared-home', 400_000, { ...withHecm(2), name: `shared-home-${index}` }),
        ),
        traditionalAccount('unreferenced-ira', 400_000),
      ]
      const parsed = parsePlan(p)
      expect(parsed.ok, parsed.ok ? undefined : parsed.issues.join('\n')).toBe(true)
      if (!parsed.ok) throw new Error(parsed.issues.join('\n'))

      seam.phases.length = 0
      seam.published.length = 0
      const result = simulatePlan(parsed.plan, {
        startYear: START_YEAR,
        horizonEndYear: START_YEAR + 1,
        taxCalculator: noTax,
      })
      const firstYear = seam.phases.find((phase) => phase.input.year === START_YEAR)!
      const nextYear = seam.phases.find((phase) => phase.input.year === START_YEAR + 1)!
      const carriedLine = new Map(nextYear.linesAtCall).get('shared-home')!
      return {
        parseAccepted: parsed.ok,
        principalLimit: carriedLine.principalLimit,
        loanBalance: yearOf(result, START_YEAR).hecmLoanBalance,
        hecmGrowthRows: firstYear.rows.map((row) => row.hecmGrowth),
      }
    }

    const singleLineControl = project(1)
    expect(singleLineControl).toEqual({
      parseAccepted: true,
      principalLimit: 172_000,
      loanBalance: 8_600,
      hecmGrowthRows: [1.075],
    })
    expect(project(2)).toEqual({
      parseAccepted: true,
      principalLimit: 172_000,
      loanBalance: 8_600,
      hecmGrowthRows: [1.075],
    })
  })

  // G1 — defeats the FULLY ORPHANED helper. The inlined `for (const account of
  // plan.accounts)` ran every projected year.
  it('calls the extracted helper exactly once for every projected year', () => {
    const { result, phases } = run()
    expect(phases.length).toBeGreaterThan(0)
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect(phases.length).toBe(result.years.length)
    expect(phases.map((p) => p.input.year)).toEqual(result.years.map((y) => y.year))
    for (const phase of phases) {
      // `plan.accounts` whole and in order — not pre-filtered to properties.
      expect(phase.accountIdsAtCall, `accounts at ${phase.input.year}`).toEqual([
        GROW.id,
        SALE.id,
        LINE.id,
        LINE_SALE.id,
        'ira',
      ])
      // Four property rows every year, sold ones included: the phase writes a
      // value back for a sold property too.
      expect(phase.rows.length, `rows at ${phase.input.year}`).toBe(4)
    }
    // The maps handed over are the caller's LIVE ones, carrying what earlier
    // years wrote — not a setup-time snapshot. The value the phase is handed in
    // the second year is the value it returned in the first.
    const first = phases[0]!
    const second = phases[1]!
    expect(new Map(first.valuesAtCall).get(GROW.id)).toBe(GROW.value)
    expect(new Map(second.valuesAtCall).get(GROW.id)).toBe(first.rows[0]!.value)
    // Likewise the open lines: absent before the open phase runs in the start
    // year, present afterwards.
    expect(new Map(second.linesAtCall).has(LINE.id)).toBe(true)
  })

  // G2a — THE OBJECT-IDENTITY ASSERTION (defeats the HALF-ORPHANED duplicate).
  // The legacy-sale ledger payload is the one object of this phase's whose
  // identity reaches observable output, so it is the one `toBe` available.
  it('publishes the helper’s own ledger payloads, not look-alike rebuilds', () => {
    const { result } = run({ capture: true })
    // One assembly per published year, in year order: asserted, so the
    // positional pairing below is a check rather than an assumption.
    expect(seam.published.length, 'the cash flow was not assembled once per year').toBe(result.years.length)
    const rowsFor = (year: number) =>
      seam.phases
        .filter((p) => p.input.year === year)
        .flatMap((p) => p.rows)
        .filter((r) => r.record !== null)
    let identityChecks = 0
    for (let y = 0; y < result.years.length; y++) {
      const year = result.years[y]!.year
      const published = seam.published[y]!
      const want = rowsFor(year)
      expect(published.length, `published rows ${year}`).toBe(want.length)
      for (let i = 0; i < want.length; i++) {
        // THE LOAD-BEARING ONE. A caller that invokes the helper for effect and
        // then pushes its own byte-identical rebuild satisfies every other
        // check in the repository and fails only this.
        expect(published[i], `${year} [${i}] is not the helper's own payload`).toBe(want[i]!.record)
        identityChecks++
      }
    }
    // WHOLE-LOG ACCOUNTING: this phase is the only producer of that array, so
    // every payload it ever built must be one of the published ones.
    const builtEverywhere = seam.phases.flatMap((p) => p.rows).filter((r) => r.record !== null).length
    const publishedEverywhere = seam.published.reduce((total, rows) => total + rows.length, 0)
    expect(publishedEverywhere, 'a legacy sale payload was built and never published').toBe(builtEverywhere)
    expect(identityChecks, 'the fixture no longer publishes a legacy property sale').toBe(2)
    // …and the two sales are the ones the fixture scheduled.
    expect(legacyLineIds(yearOf(result, SALE.saleYear))).toEqual([
      cashFlowLineIds.sourceLegacyPropertySaleDeposit(SALE.id),
    ])
    expect(legacyLineIds(yearOf(result, LINE_SALE.saleYear))).toEqual([
      cashFlowLineIds.sourceLegacyPropertySaleDeposit(LINE_SALE.id),
    ])
  })

  // G2b — THE RETURN VALUE IS LOAD-BEARING. Most of this phase's product is map
  // mutation, which value-equality cannot separate from a caller that recomputed
  // the same numbers. Perturbing what the helper hands back must move published
  // money — for each of the three fields the caller applies.
  it('applies the value, the growth multiplier and the deposit the helper returned', () => {
    const clean = run().result
    const tamperedValue = run({ tamper: 'value' }).result
    expect(yearOf(tamperedValue, START_YEAR).balances[GROW.id]).not.toBe(
      yearOf(clean, START_YEAR).balances[GROW.id],
    )
    const tamperedGrowth = run({ tamper: 'hecmGrowth' }).result
    expect(yearOf(tamperedGrowth, START_YEAR).hecmLoanBalance).not.toBe(
      yearOf(clean, START_YEAR).hecmLoanBalance,
    )
    const tamperedDeposit = run({ tamper: 'deposit' }).result
    expect(yearOf(tamperedDeposit, SALE.saleYear).investableTotal).not.toBe(
      yearOf(clean, SALE.saleYear).investableTotal,
    )
  })

  // G3 — THE FIXTURE-DERIVED GUARD, and the only one here that never reads the
  // helper's output. G1, G2a and G5 build their expectations from the rows the
  // helper handed back, so an early-out that returns nothing for some year
  // loses that year's whole contribution and they agree with the loss.
  //
  // HONEST SCOPE: it covers only the years and accounts this fixture simulates,
  // and it CANNOT see `principalLimit` at all — that field is never published,
  // and is observable only through a draw clamped by remaining capacity, which
  // this fixture deliberately does not have (it takes no draws). Deleting
  // `line.principalLimit *= growth` from the engine passed the entire suite
  // before this work; that remains true of everything here.
  it('grows, sells and accrues on the fixture’s own schedule', () => {
    const { result } = run({ capture: true })
    noDrawsHappened(result)
    for (const year of result.years) {
      const n = year.year - START_YEAR + 1
      // Value growth, from the fixture's own base and rate.
      expect(year.balances[GROW.id], `${GROW.id} ${year.year}`).toBe(grownValue(GROW.value, n))
      // The sold properties: grown until their sale year, then exactly zero.
      expect(year.balances[SALE.id], `${SALE.id} ${year.year}`).toBe(
        year.year >= SALE.saleYear ? 0 : grownValue(SALE.value, n),
      )
      expect(year.balances[LINE_SALE.id], `${LINE_SALE.id} ${year.year}`).toBe(
        year.year >= LINE_SALE.saleYear ? 0 : grownValue(LINE_SALE.value, n),
      )
      // The line balances: the `home-line` line accrues all horizon; the
      // `home-line-sale` line is repaid and closed in its sale year, and its
      // last accrual is the year BEFORE — the sale deletes the line before the
      // growth lookup in that same iteration.
      const lineSaleOpen = year.year < LINE_SALE.saleYear
      expect(year.hecmLoanBalance, `hecmLoanBalance ${year.year}`).toBe(
        lineSaleOpen
          ? grownLoan(LINE.value, LINE.upfrontPct, n) + grownLoan(LINE_SALE.value, LINE_SALE.upfrontPct, n)
          : grownLoan(LINE.value, LINE.upfrontPct, n),
      )
    }
    // The quoted-proceeds sale deposits exactly what the fixture quoted.
    const quoted = (yearOf(result, SALE.saleYear).cashFlow?.sourceLines ?? []).find(
      (l) => l.id === cashFlowLineIds.sourceLegacyPropertySaleDeposit(SALE.id),
    )
    expect(quoted?.amountPlanDollars).toBe(SALE.proceeds)
    // The unquoted one deposits the grown value less the non-recourse payoff,
    // which is the line balance after its LAST accrual — three of them, since
    // the sale year's accrual never happens.
    const yearsBeforeSale = LINE_SALE.saleYear - START_YEAR
    const proceeds = grownValue(LINE_SALE.value, yearsBeforeSale + 1)
    const payoff = grownLoan(LINE_SALE.value, LINE_SALE.upfrontPct, yearsBeforeSale)
    expect(payoff, 'the payoff must be clamped by the loan, not by the proceeds').toBeLessThan(proceeds)
    const unquoted = (yearOf(result, LINE_SALE.saleYear).cashFlow?.sourceLines ?? []).find(
      (l) => l.id === cashFlowLineIds.sourceLegacyPropertySaleDeposit(LINE_SALE.id),
    )
    expect(unquoted?.amountPlanDollars).toBe(proceeds - payoff)
    // No legacy sale in any other year.
    for (const year of result.years) {
      if (year.year === SALE.saleYear || year.year === LINE_SALE.saleYear) continue
      expect(legacyLineIds(year), `legacy sale lines ${year.year}`).toEqual([])
    }
  })

  // G4 — THERE IS NO FOLD IN THIS PHASE, so there is no fold guard. Stated as a
  // test rather than only in the header, because "no accumulator" is a property
  // of the phase that a future change could quietly break.
  it('feeds no accumulator of its own — the rows carry no additive leg', () => {
    const { phases } = run()
    const rows = phases.flatMap((p) => p.rows)
    expect(rows.length).toBeGreaterThan(0)
    // Every field is either a per-row scalar the caller writes or multiplies,
    // or a payload. Nothing is summed across rows anywhere in the call site.
    for (const row of rows) {
      expect(typeof row.value).toBe('number')
      expect(row.deposit === null || typeof row.deposit === 'number').toBe(true)
      expect(row.hecmGrowth === null || typeof row.hecmGrowth === 'number').toBe(true)
    }
    // The one thing that IS summed downstream — the year's loan total — is
    // summed by `simulate.ts` over `hecmStates`, not here, and G3 pins it.
    expect(rows.some((r) => r.hecmGrowth !== null)).toBe(true)
  })

  // G5 — THE STRUCTURAL PREMISE. A lazy generator interleaved with the caller's
  // own map writes would feed the three read-after-write channels different
  // inputs and silently change money. `Array.isArray` catches a generator;
  // `rowCountAtCall` catches an array appended to after it was returned. A
  // generator PASSES the count check (both reads are `undefined`), so neither
  // line is redundant.
  it('returns a materialized array that does not grow after it is returned', () => {
    const { phases } = run()
    expect(phases.length).toBeGreaterThan(0)
    for (const phase of phases) {
      const where = `year ${phase.input.year}`
      expect(Array.isArray(phase.rows), `${where} rows are not a materialized array`).toBe(true)
      expect(phase.rows.length, `${where} rows grew after the call returned`).toBe(phase.rowCountAtCall)
    }
  })
})
