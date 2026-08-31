/**
 * HECM line open — the once-per-year annual phase (step 4 of
 * annuity-pension-and-home-equity), lifted out of `simulatePlan` as a pure
 * function ("extract the domain you touch", DOCS/standards.md). The domain, as
 * it was documented at the call site:
 *
 * > The initial principal limit is the user's quoted percent of the home's
 * > value at open (or the pack's published PLF approximation by the youngest
 * > borrower's age); financed upfront costs start the loan balance. A line
 * > dated before the projection opens in the first projection year at
 * > today's value (its pre-projection growth is not reconstructed).
 *
 * WHAT IT TAKES: the plan's account list, the two years that gate the open,
 * this year's property values, the lines already open, the household and the
 * caller's own date-of-birth-year accessor, and the year's parameter pack.
 *
 * WHAT IT PRODUCES: one row per property account whose line opens THIS year,
 * in `accounts` order, carrying the line state to store and the age-62 warning
 * string when one is due.
 *
 * WHAT IT REFUSES: it will not write `hecmStates`, will not add to `warnings`,
 * and will not hoist `Math.min(...people.map(…))` out of the loop. That last
 * refusal is deliberate rather than accidental: the youngest age is
 * loop-invariant and hoisting it would be output-identical, but the inlined
 * phase evaluated it only after an account cleared all five guards, and
 * `dobYear` would then be called per person in years with no qualifying
 * account. Keeping it inside the loop means that question does not need
 * answering.
 *
 * THERE IS NO FOLD HERE, and saying otherwise would overclaim. This phase feeds
 * no accumulator of its own. What it does feed, indirectly, is the two
 * zero-based totals `simulate.ts` folds at year end over `hecmStates` in
 * INSERTION order — and this phase is that map's only writer, so it fixes that
 * order. Both totals start at 0, so with TWO open lines `0 + a + b` and
 * `0 + b + a` are exactly equal and no two-line fixture can discriminate a
 * permutation; three or more simultaneously open lines are needed before a
 * reordering can move a bit. Any order guard written against this phase has to
 * say that, and carry 3+ lines, or it is decorative.
 *
 * THE OPEN-AS-YOU-GO RULE, the mirror of `internal/fixedAssetDispositions.ts`'s
 * delete-as-you-go. The inlined phase read `hecmStates.has(id)` and wrote
 * `hecmStates.set(id, …)` on the same map inside the same loop, so a later
 * iteration observed an earlier one's write. Account ids are not globally
 * unique in a valid `Plan`: `model/plan.ts` raises `duplicate account id` only
 * when a retirement action references the id, so two property accounts may
 * legally share one, and today the FIRST opens the line while the second is
 * skipped by the `has` guard. An eager helper handed a snapshot, with the
 * caller applying the writes afterwards, would return TWO rows and open two
 * lines. So this module keeps a private set of the ids it has already opened
 * during THIS call and treats such an id as present. The caller still performs
 * the map write; it is told which id to open, with what, and in what order.
 *
 * EACH ROW CARRIES ITS OWN, DELIBERATELY MUTABLE, STATE OBJECT. Unlike every
 * other row field in this directory, `state` is not `readonly`: `simulate.ts`
 * mutates this exact object in place later in the same year — the coordinated
 * and backstop draws add to `loanBalance`, and the property-events phase
 * multiplies both fields by the line's growth rate. A helper that hoisted one
 * object literal and pushed it twice would alias two independent lines into
 * one. Stated in the other direction so the guard is not oversold: object
 * identity between the returned object and the map entry is NOT observable in
 * projection output, because a caller that stored `{ ...row.state }` would
 * behave identically. The delegation test's `toBe` on this field pins the
 * SEAM, not any number.
 *
 * THE DUPLICATE-ID QUIRK IN `propertyValues` IS PRESERVED, NOT FIXED. The
 * simulator seeds that map with `set(account.id, account.value)` per account,
 * so with two property accounts sharing an id the LAST account's value wins,
 * while the loop below lets the FIRST one open the line — so the line opens
 * against the other account's value. Reading by id preserves that
 * automatically; passing `account.value` instead would silently change it.
 *
 * LESSON 9 DOES NOT APPLY, stated explicitly so nobody invents it: this phase
 * contains no `yearSites?.record(…)` call and builds no ledger payload, so
 * there is no lazy-to-eager trade to measure and none is claimed. The new
 * allocations are the rows and the array, which any pure helper requires.
 *
 * It mutates nothing it was handed — the `Account`s and `Person`s ARE the
 * caller's `Plan` by reference, and both maps are `ReadonlyMap` so the compiler
 * checks that rather than the prose asserting it — and it holds no module-scope
 * state, so it is safe under the optimizer's and Monte Carlo's repeated
 * re-entry into `simulatePlan` against the same `Plan` object.
 */
import type { Account, Person } from '../../model/plan.js'
import { hecmPrincipalLimitFactorPct } from '../../params/index.js'
import type { ParameterPack } from '../../params/types.js'

/** The mutable line state a HECM open creates. See the module header. */
export interface HecmLineState {
  principalLimit: number
  loanBalance: number
}

/** The year-scoped state this phase reads. */
export interface HecmLineOpeningYearInput {
  /**
   * `plan.accounts`. Iteration order is load-bearing twice: duplicate-id
   * resolution, and the insertion order of the caller's `hecmStates` map.
   */
  readonly accounts: readonly Readonly<Account>[]
  /** The projected calendar year. */
  readonly year: number
  /** The projection's first year; a line dated earlier opens in it. */
  readonly startYear: number
  /** This year's property values, before the property-events phase runs. */
  readonly propertyValues: ReadonlyMap<string, number>
  /**
   * Lines already open, by property account id. `ReadonlyMap` so the compiler
   * checks the non-mutation claim; see the open-as-you-go rule.
   */
  readonly openHecmLines: ReadonlyMap<string, Readonly<HecmLineState>>
  /** `plan.household.people`. */
  readonly people: readonly Readonly<Person>[]
  /**
   * The caller's own birth-year accessor, passed as a FUNCTION and called per
   * person exactly where the inlined phase called it.
   */
  readonly dobYear: (person: Readonly<Person>) => number
  /** The year's parameter pack, by reference — never rebuilt here. */
  readonly pack: ParameterPack
}

/** One property account's HECM open for one year. */
export interface HecmLineOpeningRow {
  readonly propertyAccountId: string
  /**
   * The line state to store, BY REFERENCE and deliberately mutable — the caller
   * mutates this exact object later in the year. Each row carries its own; two
   * rows never share one.
   */
  readonly state: HecmLineState
  /**
   * The age-62 warning string, or null. Returned as the string so the copy
   * lives with the phase that owns it; the caller adds it verbatim, and the
   * caller's `warnings` is a Set spread into the result, so both the string and
   * its position among the year's warnings are observable.
   */
  readonly warning: string | null
}

/** One row per property account whose HECM line opens this year, in `accounts` order. */
export function hecmLineOpenings(
  input: HecmLineOpeningYearInput,
): readonly HecmLineOpeningRow[] {
  const { accounts, year, startYear, propertyValues, openHecmLines, people, dobYear, pack } = input
  const rows: HecmLineOpeningRow[] = []
  // Ids whose line an earlier row in THIS year already opened. See the
  // open-as-you-go rule in the module header.
  const opened = new Set<string>()
  for (const account of accounts) {
    if (account.type !== 'property' || !account.hecm) continue
    if (year !== Math.max(account.hecm.openYear, startYear)) continue
    if (openHecmLines.has(account.id) || opened.has(account.id)) continue
    const value = propertyValues.get(account.id) ?? 0
    if (value <= 0) continue
    const youngestAge = Math.min(...people.map((p) => year - dobYear(p)))
    const warning =
      youngestAge < 62
        ? 'A HECM line of credit was modeled before the youngest borrower turns 62 (real HECMs require age 62+).'
        : null
    const plfPct = account.hecm.principalLimitPct ?? hecmPrincipalLimitFactorPct(pack, youngestAge)
    opened.add(account.id)
    rows.push({
      propertyAccountId: account.id,
      state: {
        principalLimit: (plfPct / 100) * value,
        loanBalance: ((account.hecm.upfrontCostPct ?? 0) / 100) * value,
      },
      warning,
    })
  }
  return rows
}
