/**
 * Property events + growth — the once-per-year annual phase lifted out of
 * `simulatePlan` as a pure function ("extract the domain you touch",
 * DOCS/standards.md). It is the mirror half of
 * `internal/fixedAssetDispositions.ts`: that helper owns the exact-basis sales
 * priced earlier in the year, and this one owns the value growth, the legacy
 * tax-free `expectedNetProceeds` sale, and the accrual on an open HECM line.
 * The domain, as it was documented at the call site:
 *
 * > Exact-taxed sales (costBasis set) already deposited their net proceeds
 * > through the year's cash flow above; the legacy tax-free
 * > expectedNetProceeds path deposits here — net of any HECM payoff, which is
 * > non-recourse (never more than the sale nets).
 * >
 * > An open line compounds at the line's growth rate on both sides: the
 * > unused principal limit grows regardless of home value (the buffer-asset
 * > property), and the loan balance accrues rate + MIP.
 *
 * Property value grows at GENERAL INFLATION, not at the account's
 * `annualReturnPct`. The property variant carries that field and this phase
 * ignores it; that is preserved, not repaired.
 *
 * WHAT IT PRODUCES: one row per PROPERTY account, in `accounts` order, saying
 * what to write back, what to deposit, which HECM line to close, what to
 * compound an open line by, and what ledger row to publish.
 *
 * WHAT IT REFUSES: it will not write either map, will not call `deposit`, and
 * will not push a ledger row. There is NO FOLD in this phase — no `+=` appears
 * anywhere in it — so no fold guard is claimed for it anywhere, and a reader
 * should not go looking for one. What is order-sensitive here is the three
 * read-after-write channels below, which are covered by the materialized-array
 * premise plus per-row replay instead.
 *
 * THE NUMERIC SHADOW, which is the single largest cost of this extraction and
 * the reason it is the hardest of its batch. `internal/fixedAssetDispositions.ts`
 * needed only a MEMBERSHIP shadow — a set of the ids whose line it had already
 * closed. This phase needs a NUMERIC one, on both maps, because THREE separate
 * read-after-write channels cross iterations of the inlined loop. Account ids
 * are not globally unique in a valid `Plan`: `model/plan.ts` raises `duplicate
 * account id` only when a retirement action references the id, so two property
 * accounts may legally share one, and all three channels are then live.
 *
 *   1. `propertyValues` — written at the end of an iteration and read at the
 *      start of the next. MEASURED on two property accounts sharing one id at
 *      10% inflation: 121000.00000000003 after one year (100000 x 1.1 x 1.1)
 *      against 110000.00000000001 for a single row. An eager helper reading a
 *      pre-loop snapshot would give the second row the wrong base.
 *   2. The HECM line's NUMBERS — compounded once per PROPERTY ROW, and the
 *      non-recourse payoff clamp reads the running `loanBalance`. MEASURED on
 *      the same duplicate-id pair with `upfrontCostPct` 10, `growthRatePct` 15,
 *      0% inflation and a legacy sale: ordering the rows [no-sale, sale] yields
 *      2027 cash 569,921.65 and [sale, no-sale] yields 571,905.40 — a 1,983.75
 *      delta that is exactly the growth the first row applied before the
 *      second row's clamp read the balance. A third duplicate row moves it a
 *      further 4,904.821875, matching 15,208.75 x 1.15^2 - 15,208.75 to the
 *      cent. This is why a membership shadow is not sufficient.
 *   3. The line's DELETION, observed INTRA-iteration: `hecmStates.delete(id)`
 *      is re-read seventeen lines later by the same iteration's growth lookup,
 *      so a legacy sale suppresses that row's own line growth. Stated honestly:
 *      no output-observable consequence of channel 3 alone was constructed for
 *      a single account — growth applied to a line that is then removed from
 *      the map is not visible in any published field — so none is claimed. It
 *      becomes observable only in combination with channel 2.
 *
 * So this module keeps a private `Map<string, number>` shadowing the value
 * writes and a private `Map<string, HecmLineNumbers | null>` shadowing the line
 * numbers with deletions applied, both seeded LAZILY per id on first touch from
 * the `ReadonlyMap` inputs. The caller still performs every write; it is told
 * what to write and in what order.
 *
 * NO LAZY WORK BECOMES EAGER HERE, and the contract is shaped so that stays
 * true. The inlined phase built its ledger literal inside
 * `legacyPropertySaleDeposits?.push({ … })`, and that array is null unless the
 * cash-flow capture is on — so on the default path (every product projection,
 * and every `simulatePlan` re-entry inside Monte Carlo, the optimizer and the
 * spending solver) the object was never constructed. `record` is gated on
 * `surplusDestination` being non-null, and the CALLER passes that field only
 * when the array itself is non-null — deliberately, and not because the two
 * happen to be assigned in the same `if (publishCashFlow)` block. That
 * coincidence is true today and nothing enforces it; the call site's ternary
 * is what makes "the payload exists exactly where the array does" hold by
 * construction. The new allocations are the rows and the array, which any pure
 * helper requires.
 *
 * `deposit: number | null` rather than a bare number is deliberate. The inlined
 * phase called `deposit(amount)` UNCONDITIONALLY for a legacy-path sale — the
 * closure itself early-returns on a non-positive amount — while gating the
 * ledger push on `amount > 0`. Modelling "did not sell down the legacy path" as
 * `null` keeps the call graph identical instead of collapsing the two gates
 * into one.
 *
 * TWO THINGS LIFTED VERBATIM RATHER THAN TIDIED. `propertyValues.get(id) ?? 0`
 * is defensive — every property account is seeded at setup — and was not proved
 * unreachable, so it stays. And the sale gate tests `value > 0` on the
 * POST-growth value while the sibling `fixedAssetDispositions` tests
 * `value <= 0` on the PRE-growth value; the two agree for any positive
 * inflation, and no case where they disagree was constructed, so none is
 * claimed either way.
 *
 * It mutates nothing it was handed — the `Account`s ARE the caller's `Plan` by
 * reference, and both maps are `ReadonlyMap` so the compiler checks that rather
 * than the prose asserting it — and it holds no module-scope state, so it is
 * safe under the optimizer's and Monte Carlo's repeated re-entry into
 * `simulatePlan` against the same `Plan` object.
 */
import type { Account } from '../../model/plan.js'
import type { YearCashFlowTransferEndpoint } from './types/cashFlow.js'

/** The two numbers an open HECM line carries into this phase. */
export interface PropertyEventHecmLine {
  readonly principalLimit: number
  readonly loanBalance: number
}

/** The ledger payload for a legacy tax-free property sale. */
export interface LegacyPropertySaleDeposit {
  readonly propertyAccountId: string
  readonly amount: number
  readonly destination: YearCashFlowTransferEndpoint
}

/** The year-scoped state this phase reads. */
export interface PropertyEventYearInput {
  /**
   * `plan.accounts`. Iteration order is load-bearing three ways at once: the
   * `deposit` order, the value-compounding order, and the line-compounding
   * order.
   */
  readonly accounts: readonly Readonly<Account>[]
  /** The projected calendar year. */
  readonly year: number
  /** This year's property values before growth. ReadonlyMap; see the shadow rule. */
  readonly propertyValues: ReadonlyMap<string, number>
  /**
   * The caller's per-year general-inflation lookup (pure, read-only). Passed as
   * a FUNCTION and called once per property row, exactly as the inlined phase
   * did: it closes over the Monte Carlo inflation path, so substituting the
   * plan's flat assumption would silently break every market-path run.
   */
  readonly inflRateAt: (year: number) => number
  /** Open HECM lines by property account id. ReadonlyMap; see the shadow rule. */
  readonly hecmStates: ReadonlyMap<string, PropertyEventHecmLine>
  /**
   * The year's post-solve surplus destination, or null when the caller has no
   * ledger array for the payload to land in. `record` is gated on this, which
   * is what keeps the payload exactly as lazy as it was inlined — so a caller
   * that holds a destination but no array must pass null here.
   */
  readonly surplusDestination: YearCashFlowTransferEndpoint | null
}

/** One property account's events for one year. */
export interface PropertyEventRow {
  readonly propertyAccountId: string
  /** The value to write back, in row order. */
  readonly value: number
  /**
   * `null` means this row did not sell down the legacy path. A number — which
   * MAY be zero or negative — means call `deposit` with it verbatim.
   */
  readonly deposit: number | null
  /** The id whose HECM line this sale closes, or null. Driven by the line EXISTING. */
  readonly closesHecmForAccountId: string | null
  /** The multiplier for a line still open after this row, or null. */
  readonly hecmGrowth: number | null
  /** The ledger row to publish, or null. Built only on the publish path. */
  readonly record: LegacyPropertySaleDeposit | null
}

interface MutableHecmLine {
  principalLimit: number
  loanBalance: number
}

/** One row per property account, in `accounts` order. */
export function propertyEventsAndGrowth(
  input: PropertyEventYearInput,
): readonly PropertyEventRow[] {
  const { accounts, year, propertyValues, inflRateAt, hecmStates, surplusDestination } = input
  const rows: PropertyEventRow[] = []
  // The numeric shadows. See the module header: a membership shadow is not
  // enough here, because the line's NUMBERS are read back across iterations.
  const shadowValues = new Map<string, number>()
  // `null` means "deleted during this call"; a missing key means "not touched
  // yet", which is seeded lazily from `hecmStates`.
  const shadowLines = new Map<string, MutableHecmLine | null>()
  const lineFor = (accountId: string): MutableHecmLine | null => {
    if (shadowLines.has(accountId)) return shadowLines.get(accountId) ?? null
    const live = hecmStates.get(accountId)
    const seeded: MutableHecmLine | null = live
      ? { principalLimit: live.principalLimit, loanBalance: live.loanBalance }
      : null
    shadowLines.set(accountId, seeded)
    return seeded
  }

  for (const account of accounts) {
    if (account.type !== 'property') continue
    const accountId = account.id
    let value = shadowValues.has(accountId)
      ? shadowValues.get(accountId)!
      : (propertyValues.get(accountId) ?? 0)
    value *= 1 + inflRateAt(year)
    let deposit: number | null = null
    let closesHecmForAccountId: string | null = null
    let record: LegacyPropertySaleDeposit | null = null
    if (account.plannedSaleYear === year && value > 0) {
      if (account.costBasis === undefined) {
        const proceeds = account.expectedNetProceeds ?? value
        const line = lineFor(accountId)
        const hecmPayoff = line ? Math.min(line.loanBalance, Math.max(0, proceeds)) : 0
        if (line) {
          shadowLines.set(accountId, null)
          closesHecmForAccountId = accountId
        }
        const amount = proceeds - hecmPayoff
        deposit = amount
        if (amount > 0 && surplusDestination !== null) {
          record = { propertyAccountId: accountId, amount, destination: surplusDestination }
        }
      }
      value = 0
    }
    shadowValues.set(accountId, value)
    const openLine = lineFor(accountId)
    let hecmGrowth: number | null = null
    if (openLine && account.hecm) {
      hecmGrowth = 1 + account.hecm.growthRatePct / 100
      openLine.principalLimit *= hecmGrowth
      openLine.loanBalance *= hecmGrowth
    }
    rows.push({ propertyAccountId: accountId, value, deposit, closesHecmForAccountId, hecmGrowth, record })
  }
  return rows
}
