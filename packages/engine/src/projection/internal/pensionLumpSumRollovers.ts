/**
 * Pension lump-sum rollover — the once-per-year annual phase (step 3 of
 * annuity-pension-and-home-equity), lifted out of `simulatePlan` as a pure
 * function ("extract the domain you touch", DOCS/standards.md). The domain, as
 * it was documented at the call site:
 *
 * > An elected lump sum commutes the pension: the offer amount arrives as a
 * > tax-free direct rollover into the named traditional account in the
 * > election year (external plan money — nothing leaves another account),
 * > and the pension income stream never pays (skipped in the income block).
 *
 * WHAT IT TAKES: the plan's account list, the projected year, a NARROWED view
 * of the year's balance states, and the caller's own runtime occurrence-key
 * builder.
 *
 * WHAT IT PRODUCES: one row per electing pension whose rollover target
 * resolves, in `plan.accounts` order, saying which account is credited, by how
 * much, what runtime records the credit publishes, and what the ledger payload
 * is. A pension whose target does not resolve produces NO row, which is what
 * the inlined phase's `continue` did.
 *
 * WHAT IT REFUSES: it never reads or writes a balance, never sums across rows,
 * and never calls a recorder. That refusal is the whole design, and it is what
 * makes an EAGER helper safe here. `target.balance += amount` mutated shared
 * state inside the inlined loop and a later iteration observed it: two DISTINCT
 * pensions electing into ONE traditional account in the SAME year is a valid
 * plan (measured — `parsePlan` returns ok, and the second application's
 * `sourceBalanceBeforePlanDollars` is exactly the first's `after`). A helper
 * that computed the before/after pair itself would have to model that running
 * balance the way `internal/fixedAssetDispositions.ts` models its `closed` set.
 * This one sidesteps it: the input view does not expose `balance` at all, so
 * the compiler — not a comment — enforces that the helper cannot read one, and
 * the caller does the read-mutate-record per row.
 *
 * `destinationIndex` rather than the `BalanceState` object is the price of that
 * refusal, and it is a real trade rather than a free one: the caller pays a `!`
 * assertion on `balances[row.destinationIndex]`. Handing back the state object
 * would remove the `!` and force the input to expose a mutable `balance`,
 * giving up the compiler-checked guarantee. An out-of-range index throws
 * loudly; a helper that could read a running balance would fail silently.
 *
 * TWO GATES THAT LOOK LIKE ONE AND ARE NOT. The runtime OCCURRENCE is gated on
 * `amount > 0 && destination.type === 'traditional'`; the aggregated-IRA
 * APPLICATION adds `isAggregatedIra`, i.e. `kind === 'ira'` and not inherited.
 * Measured reachable: an election into an owned EMPLOYER traditional plan
 * parses ok and produces 1 occurrence and 0 applications. `runtime` is
 * therefore `null` or an object carrying a flag — "an application without an
 * occurrence" is unspellable, so the two gates cannot silently collapse.
 *
 * ZERO-AMOUNT ROWS ARE STILL ROWS. Measured on a 0 offer: `target.balance += 0`
 * still runs, `recordPensionRollover` is still CALLED and then dropped by the
 * sink's non-positive filter, and no occurrence is emitted. Filtering the row
 * out here would move no number and would change the recorder call count.
 *
 * ROWS ARE KEYED BY POSITION, NEVER BY PENSION ID. `model/plan.ts` adds the
 * rollover TARGET to the action-referenced set, so duplicate target ids are
 * rejected — but a pension account's own id is not action-referenced, so two
 * pensions may legally share one and would collide under any map-by-id (and
 * would then also share one `producerOccurrenceKey`, which is a supported
 * shape: duplicate keys with distinct mutation ordinals already exist).
 *
 * THE UNRESOLVED-TARGET SKIP IS PRESERVED, NOT FIXED. `parsePlan` forces the
 * target to be an existing owned traditional account, so the skip is
 * unreachable through a validated plan — but `simulatePlan` takes a `Plan` by
 * TYPE, not by parse. Measured on a hand-built plan naming a property account:
 * 0 occurrences, 0 ledger lines, and `incomes.pension === 0`, because the
 * pension stops paying on the election year alone. That asymmetry is behaviour
 * this refactor carries across unchanged; it is not this module's to repair.
 *
 * THE OCCURRENCE KEY IS CROSS-MODULE LOAD-BEARING, so the caller's builder is
 * passed in rather than re-implemented here:
 * `internal/ownedNonRothIraRuntimeSourceSeries.ts` re-derives
 * `JSON.stringify(['rolloverInflow', pensionId, destinationId])` and refuses
 * the year if the occurrence is missing or its gross differs from the offer by
 * any amount.
 *
 * ONE ALLOCATION THE INLINED PHASE DID NOT MAKE. The `RecordedPensionRollover`
 * literal was built INSIDE `yearSites?.recordPensionRollover({ … })`, and
 * optional chaining does not evaluate a call's arguments when the receiver is
 * nullish — so under default options (every product projection, and every
 * `simulatePlan` re-entry inside Monte Carlo, the optimizer and the spending
 * solver) it was never constructed. The row owns it now, which is what lets the
 * delegation test assert with `toBe` that the object reaching the ledger IS
 * this one. The structural bound is small — each pension has exactly one
 * `lumpSumOffer.electionYear`, so a plan yields at most one row per ELECTED
 * pension across the WHOLE projection, and typical plans yield zero — plus one
 * array per projected year, almost always empty. That is a bound, not a
 * benchmark: no timing was measured, and none is claimed.
 *
 * It mutates nothing — the `Account`s ARE the caller's `Plan` by reference, and
 * are `readonly` here so the compiler checks that rather than the prose
 * asserting it — and it holds no module-scope state, so it is safe under the
 * optimizer's and Monte Carlo's repeated re-entry into `simulatePlan` against
 * the same `Plan` object.
 */
import type { Account } from '../../model/plan.js'
import { isAggregatedIra } from '../../strategies/accountEligibility.js'
import type { RecordedPensionRollover } from '../annualCashFlowYearSites.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../annualRetirementRuntimeJournal.js'

/**
 * A deliberately NARROWED view of the simulator's `balances`: only `account` is
 * visible. `balance` is withheld on purpose — see the module header — and
 * `BalanceState[]` is structurally assignable to this.
 */
export interface PensionLumpSumRolloverBalanceView {
  readonly account: Readonly<Account>
}

/** The year-scoped state this phase reads. */
export interface PensionLumpSumRolloverYearInput {
  /** `plan.accounts`, unsorted and unfiltered. Order is load-bearing. */
  readonly accounts: readonly Readonly<Account>[]
  /** The projected calendar year, matched against the offer's election year. */
  readonly year: number
  /** `balances`, narrowed. Resolution is by index into THIS array. */
  readonly balances: readonly PensionLumpSumRolloverBalanceView[]
  /**
   * The caller's own pure key builder, passed rather than re-implemented so the
   * format stays defined in one place.
   */
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
}

/** One elected pension's rollover for one year. */
export interface PensionLumpSumRolloverRow {
  readonly pensionAccountId: string
  /** Index into the caller's `balances`. The caller applies the credit. */
  readonly destinationIndex: number
  /** `destination.account.id` verbatim — not the election's `rolloverAccountId`. */
  readonly destinationAccountId: string
  /** The offer verbatim: never scaled, never inflated, MAY BE ZERO. */
  readonly amount: number
  /** `destination.account.ownerPersonId`, raw and unnormalized. */
  readonly ownerPersonId: string | null
  /**
   * `null` when this row publishes no runtime record at all. Non-null means the
   * occurrence is emitted, and the flag says whether the aggregated-IRA
   * application follows it.
   */
  readonly runtime: {
    readonly producerOccurrenceKey: string
    readonly creditsAggregatedIra: boolean
  } | null
  /** The ledger payload, handed over UNREBUILT so an identity check is possible. */
  readonly record: RecordedPensionRollover
}

/** One row per electing pension whose target resolves, in `accounts` order. */
export function pensionLumpSumRollovers(
  input: PensionLumpSumRolloverYearInput,
): readonly PensionLumpSumRolloverRow[] {
  const { accounts, year, balances, runtimeOccurrenceKey } = input
  const rows: PensionLumpSumRolloverRow[] = []
  for (const account of accounts) {
    if (account.type !== 'pension' || !account.lumpSumElection || !account.lumpSumOffer) continue
    if (account.lumpSumOffer.electionYear !== year) continue
    const destinationIndex = balances.findIndex(
      (b) => b.account.id === account.lumpSumElection!.rolloverAccountId,
    )
    if (destinationIndex < 0) continue
    const destination = balances[destinationIndex]!
    const amount = account.lumpSumOffer.amount
    const ownerPersonId = destination.account.ownerPersonId
    let runtime: PensionLumpSumRolloverRow['runtime'] = null
    if (amount > 0 && destination.account.type === 'traditional') {
      runtime = {
        producerOccurrenceKey: runtimeOccurrenceKey('rolloverInflow', account.id, destination.account.id),
        creditsAggregatedIra: isAggregatedIra(destination.account),
      }
    }
    rows.push({
      pensionAccountId: account.id,
      destinationIndex,
      destinationAccountId: destination.account.id,
      amount,
      ownerPersonId,
      runtime,
      record: {
        pensionAccountId: account.id,
        destinationAccountId: destination.account.id,
        ownerPersonId: ownerPersonId ?? null,
        amount,
      },
    })
  }
  return rows
}
