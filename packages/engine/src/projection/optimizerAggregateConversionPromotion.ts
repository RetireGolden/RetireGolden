import {
  allocateAggregateRothConversionByOwner,
  participatesInAggregateRothConversionAllocation,
  type AggregateRothConversionBalance,
  type AggregateRothConversionOwnerAllocation,
  type AggregateRothConversionRefusalReason,
  type AggregateRothConversionTrim,
} from '../actions/aggregateRothConversionOwnerAllocation.js'
import { asAccountId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import {
  ledgerCentsToPlanDollars,
  planDollarsToFlooredLedgerCents,
  planDollarsToLedgerCents,
} from '../actions/planBalanceAdapter.js'
import type {
  RetirementActionCandidateSourceIntent,
  RothConversionCandidateIdentityIntent,
} from '../actions/retirementActionCandidateIdentityAllocator.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import {
  adaptFillTargetRothConversionGeneratorCandidate,
  type FillTargetRothConversionCandidateAdaptationResult,
} from '../decisions/rothConversionCandidateAdapter.js'
import type { DecisionCandidate } from '../decisions/types.js'
import type { Account, Plan } from '../model/plan.js'

/**
 * Turn an aggregate optimizer winner into identity-complete conversion intents,
 * and mint the candidate that carries them.
 *
 * The optimizer's answer is a schedule of household amounts and nothing else
 * (`ExactLedgerTournament.winnerConversions`), which is exactly why every
 * positive one of them is vetoed `identityIncomplete`: nobody has said whose
 * dollars move, out of which account, into which. Nothing in the tree chose
 * that before this module. `allocateRetirementActionCandidateIdentity` is a
 * validator and a minter, and the fill-target adapter takes intents that
 * already name all of it.
 *
 * WHAT IT DECIDES, AND WHAT IT REFUSES TO DECIDE.
 *
 * The allocation is not this module's invention: it calls the same
 * `actions/aggregateRothConversionOwnerAllocation.ts` the ledger executes, so a
 * promoted schedule allocates by the rule the projection ran and not by a
 * second rule that happens to agree today. The amounts are not this module's
 * either — each year's household figure is the winner's, taken as given. The
 * only reduction it applies is the one the identity rules themselves impose:
 * an owner with no lawful Roth IRA destination is trimmed, exactly as the
 * ledger trims them, and the household converts less than the winner's figure
 * as a result. That difference is the normal case for a two-owner household,
 * not an edge case, and it is reported per year rather than smoothed away.
 *
 * It re-solves nothing. Re-sizing the schedule under identity constraints would
 * change the optimizer's objective, which is a non-goal; the promoted candidate
 * is priced on its own exact-ledger run by the caller, and ranked by the
 * existing decision engine.
 *
 * WHERE THE BALANCES COME FROM. The policy weights each owner by their gross
 * convertible balance as it stood after that year's forced distributions and
 * before any conversion drain (Treas. Reg. 1.408A-4 A-6(b) puts the RMD first).
 * That snapshot is a fact about a projection, not about the Plan, so this
 * module will not invent it: the caller supplies one snapshot per scheduled
 * year and a year without one is refused rather than allocated against the
 * Plan's opening balances. Given the ledger's own snapshot for a year, the
 * intents name the same sources and the same cents the ledger moved.
 *
 * PROVENANCE (the scheme, and the arm it cannot serve).
 * `compareOptimizerAllocatedCandidate` pins the promoted requests to the arm
 * that won (`optimizerAllocatedCandidateComparison.ts:118-133`), so the ID
 * scheme has to be settled here rather than discovered later:
 *
 *   every minted intent carries `{ source: 'generator', sourceId:
 *   <the winning generator candidate's own ID> }`
 *
 * It is deterministic (nothing is minted — it is the winner's own ID), and
 * collision-free (tournament candidate IDs are unique and deduped, and the
 * fill-target adapter refuses any intent whose `sourceId` differs from the
 * exploratory candidate it is adapting). On the candidate arm the comparator
 * asks for `provenance.source === 'generator'` and `sourceId ===
 * veto.vetoedCandidateId`, which this satisfies by construction — this module
 * requires the caller to hand it the vetoed winner's own candidate and refuses
 * if the two IDs disagree.
 *
 * The MILP arm cannot be served through this path at all, and pretending
 * otherwise would be the defect. The comparator wants `source: 'optimizer'`
 * with `sourceId === evaluation.candidate.id` — the ID of the allocated
 * candidate itself, which the adapter derives from the very requests that would
 * have to contain it, so no assignment satisfies it. The fill-target adapter
 * also mints `generator` provenance and a `heuristic` candidate either way.
 * A MILP winner is therefore refused here with a named issue rather than
 * promoted into evidence that could never be produced.
 *
 * WHERE IT PARTS COMPANY WITH THE LEDGER. The policy attributes an account the
 * Plan records no individual owner for to the primary person, because the
 * ledger does. The identity path refuses one, because a conversion runs inside
 * one individual's own accounts and the Plan has not said whose this is. A
 * `chosen` result has to mean the adapter will take it, so an ownerless account
 * among the sources or destinations a year would NAME is refused here, by name
 * — see `ownerlessSelectedAccounts`, which also records how far the divergence
 * actually reaches (`planSchema` forbids the state; the TypeScript type does
 * not). This is the one place the two arms genuinely disagree rather than one
 * being a subset of the other.
 *
 * WHAT IT INHERITS AND CANNOT FIX. The policy's convertible set is
 * `isConvertibleToRoth`, which admits every owned traditional account including
 * an employer plan and applies no distributability gate --
 * `irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability`,
 * still `approximated`. Promotion raises the stakes on that record rather than
 * changing it: the same ungated balance now appears as the named source account
 * on an identity-bearing request instead of only inside a projection's
 * aggregate arithmetic. The registry record names this module for that reason.
 * A distributability gate belongs in `accountEligibility.ts`, where both
 * callers would pick it up at once, and not here.
 *
 * Two more identities the aggregate schedule does not carry and a request must:
 * the execution date is the last lawful day of the conversion year (see
 * `canonicalExecutionDate`), and the slot inside that day is numbered in
 * canonical person order, so Plan array order cannot reach the minted action
 * IDs through it.
 *
 * Its one caller is `optimizerAggregateConversionPromotionRun.ts`, which reads
 * the ledger's published snapshots off the vetoed projection, runs this
 * chooser, prices the minted candidate on the exact ledger and records what
 * `compareOptimizerAllocatedCandidate` said about the pair. No optimizer entry
 * point calls that runner yet, and no surface publishes its answer: the veto
 * and the `buildOptimizerInput` throw both still stand, and lifting them is the
 * next slice.
 */

/** One year of the winner's schedule, in Plan dollars. */
export interface AggregateConversionPromotionYear {
  readonly year: number
  readonly amount: number
}

/**
 * The tournament winner being promoted.
 *
 * Shaped to be read straight off `RetirementActionReadinessVeto`:
 * `vetoedWinnerSource`, `vetoedCandidateId`, `vetoedConversions`.
 */
export interface AggregateConversionPromotionWinner {
  readonly source: 'candidate' | 'milp'
  readonly candidateId: string | null
  readonly conversions: readonly AggregateConversionPromotionYear[]
}

/**
 * One scheduled year's balances, per Plan account ID, as the ledger held them
 * after the forced distributions and before any conversion drain.
 *
 * WHERE ONE COMES FROM. The ledger publishes exactly this, per year, as
 * `YearResult.aggregateRothConversionAllocationBalances`, captured at the
 * instant the policy read it. That is the snapshot to hand over, and a caller
 * that assembles its own from the Plan's opening balances or from a year's
 * closing ones is answering with weights the projection never used.
 *
 * THE EXACT SET THAT MUST BE PRESENT: every Plan account for which
 * `participatesInAggregateRothConversionAllocation` holds — an owned,
 * non-inherited traditional account, employer plans included, and every account
 * of `type: 'roth'`, of BOTH kinds. Everything else may be omitted: cash,
 * taxable, equity comp, HSA, inherited traditional, property, debt. The
 * requirement and the publication are the same predicate, so a published
 * snapshot satisfies this by construction.
 *
 * A designated Roth account is in that set even though no conversion may land
 * in one, which is the part worth stating plainly. It is what tells an owner
 * who holds only that kind apart from an owner who holds no Roth at all, and
 * those two hear different sentences and are offered different remedies. Its
 * balance is not read; the requirement is on the snapshot, which has to state
 * the household the ledger saw rather than the part of it that happened to
 * matter. Omitting a required account is refused (`missingAccountBalance`)
 * rather than read as a zero nobody stated.
 *
 * At most one entry per year: a second one for the same year is refused rather
 * than resolved.
 */
export interface AggregateConversionPromotionYearBalances {
  readonly year: number
  readonly balances: Readonly<Record<string, number>>
}

export interface AggregateConversionPromotionInput {
  readonly plan: Readonly<Plan>
  readonly winner: AggregateConversionPromotionWinner
  readonly yearBalances: readonly AggregateConversionPromotionYearBalances[]
}

export type AggregateConversionPromotionIssueKind =
  /** The comparator's optimizer arm cannot be satisfied through this adapter. */
  | 'milpWinnerNotPromotable'
  /** A candidate winner arrived without the candidate ID its provenance needs. */
  | 'winnerCandidateIdMissing'
  /** The exploratory candidate is not the one the veto named. */
  | 'exploratoryCandidateMismatch'
  /** Nothing positive to promote. */
  | 'emptyWinnerSchedule'
  /** A year or amount the comparator's own reader would reject. */
  | 'invalidWinnerSchedule'
  /** No balance snapshot for a scheduled year. */
  | 'missingYearBalances'
  /** Two balance snapshots for one year, so which one is authoritative is unstated. */
  | 'duplicateYearBalances'
  /** A participating account with no stated balance in a year. */
  | 'missingAccountBalance'
  /** A stated balance the exact-cent ledger cannot represent. */
  | 'unrepresentableYearBalances'
  /** The Plan names nobody, so an unowned account has no owner to fall back to. */
  | 'missingPrimaryPerson'
  /** An account the year would name records no individual owner. */
  | 'missingAccountOwner'
  /** Every scheduled year allocated nothing, so there is no candidate to mint. */
  | 'noLawfulConversion'

export interface AggregateConversionPromotionIssue {
  readonly kind: AggregateConversionPromotionIssueKind
  readonly field: string
  readonly detail: string
}

/** What the policy did with one scheduled year. */
export interface AggregateConversionPromotionYearOutcome {
  readonly year: number
  /** The winner's household figure for the year, in exact cents. */
  readonly winnerCents: number
  /** What the identity-complete intents actually convert, in exact cents. */
  readonly allocatedCents: number
  /** Owners whose share no lawful destination could receive. */
  readonly trims: readonly AggregateRothConversionTrim[]
  /** Set when the whole household had nowhere to convert to. */
  readonly refusal: AggregateRothConversionRefusalReason | null
  readonly intents: readonly RothConversionCandidateIdentityIntent[]
}

export type AggregateConversionPromotionChoice =
  | Readonly<{
    status: 'chosen'
    intents: readonly [
      RothConversionCandidateIdentityIntent,
      ...RothConversionCandidateIdentityIntent[],
    ]
    years: readonly AggregateConversionPromotionYearOutcome[]
  }>
  | Readonly<{
    status: 'unallocatable'
    years: readonly AggregateConversionPromotionYearOutcome[]
    issues: readonly [
      AggregateConversionPromotionIssue,
      ...AggregateConversionPromotionIssue[],
    ]
  }>

export type AggregateConversionPromotionResult =
  | Readonly<{
    status: 'promoted'
    candidate: DecisionCandidate
    choice: Extract<AggregateConversionPromotionChoice, { status: 'chosen' }>
    adaptation: Extract<
      FillTargetRothConversionCandidateAdaptationResult,
      { status: 'adapted' }
    >
  }>
  | Readonly<{
    status: 'unallocatable'
    choice: Extract<AggregateConversionPromotionChoice, { status: 'unallocatable' }>
  }>
  | Readonly<{
    status: 'blocked'
    choice: Extract<AggregateConversionPromotionChoice, { status: 'chosen' }>
    adaptation: Extract<
      FillTargetRothConversionCandidateAdaptationResult,
      { status: 'blocked' }
    >
  }>

/**
 * The canonical execution date a promoted conversion carries.
 *
 * A conversion is a calendar-year event: the amount is included in the year the
 * distribution is made, and December 31 is the last day it can be. The ledger's
 * aggregate pass has no date at all — it runs after the RMD block and before the
 * withdrawal plan — so the promoted request has to name one, and the last lawful
 * day is the only choice that cannot fall before a forced distribution the
 * regulation requires it to follow.
 */
function canonicalExecutionDate(year: number): string {
  return `${String(year).padStart(4, '0')}-12-31`
}

function issue(
  kind: AggregateConversionPromotionIssueKind,
  field: string,
  detail: string,
): AggregateConversionPromotionIssue {
  return { kind, field, detail }
}

/**
 * One Plan-dollar figure as exact positive cents, or null when the ledger's own
 * arithmetic cannot express it.
 *
 * `planDollarsToLedgerCents` raises `RangeError` for a figure beyond the
 * exact-cent safe-integer range, and `ledgerCentsToPlanDollars` for a cent count
 * that cannot come back as the same number. Both are the right answer for the
 * arithmetic layer and the wrong one for this caller: the winner's schedule is
 * caller data that `winnerCentsByYear` exists to validate, and a contract that
 * promises typed issues must not throw one input class and refuse the rest.
 * `optimizerAllocatedCandidateComparison.ts` keeps its own evidence-or-null
 * contract the same way.
 *
 * This is the opposite case from the allocation policy's deliberate throw, and
 * the two are worth telling apart. There, a non-finite amount is malformed input
 * to an internal module whose callers have already validated — nobody is left to
 * report it to. Here, refusing IS the job.
 */
function exactLedgerCentsOrNull(dollars: number): number | null {
  try {
    const cents = planDollarsToLedgerCents(dollars)
    return cents > 0 && ledgerCentsToPlanDollars(cents) === dollars ? cents : null
  } catch {
    return null
  }
}

/**
 * The winner's schedule as exact cents per year, read by the same rules
 * `optimizerAllocatedCandidateComparison.ts` reads it with: strictly increasing
 * years, positive amounts, and an exact cent round trip. A schedule this
 * rejects could never produce comparable evidence, so it is refused here rather
 * than allocated and discovered later.
 */
function winnerCentsByYear(
  conversions: readonly AggregateConversionPromotionYear[],
): Map<number, number> | AggregateConversionPromotionIssue {
  const byYear = new Map<number, number>()
  let priorYear = 0
  for (const [index, conversion] of conversions.entries()) {
    if (!Number.isSafeInteger(conversion.year) || conversion.year < 1 ||
        conversion.year <= priorYear) {
      return issue(
        'invalidWinnerSchedule',
        `winner.conversions.${index}.year`,
        'Winner years must be whole calendar years in strictly increasing order.',
      )
    }
    if (typeof conversion.amount !== 'number' || !Number.isFinite(conversion.amount) ||
        conversion.amount <= 0) {
      return issue(
        'invalidWinnerSchedule',
        `winner.conversions.${index}.amount`,
        'Every promoted year must carry a positive conversion amount.',
      )
    }
    const cents = exactLedgerCentsOrNull(conversion.amount)
    if (cents === null) {
      return issue(
        'invalidWinnerSchedule',
        `winner.conversions.${index}.amount`,
        'The winner amount is not an exact cent figure inside the ledger’s safe range.',
      )
    }
    byYear.set(conversion.year, cents)
    priorYear = conversion.year
  }
  return byYear
}

interface PromotionBalance extends AggregateRothConversionBalance {
  readonly account: Account
  readonly balance: number
}

/** One caller-supplied snapshot, with the array position it arrived at. */
interface IndexedYearBalances {
  readonly index: number
  readonly year: number
  readonly balances: Readonly<Record<string, number>>
}

/**
 * Join one year's stated balances onto the Plan's own accounts, in Plan order.
 *
 * Plan order is load-bearing three times over — it orders the owner slices, the
 * destination search, and the sources each owner is drawn from — so the join
 * runs over `plan.accounts` rather than over whatever order the caller wrote
 * its balances in.
 */
function promotionBalancesForYear(
  plan: Readonly<Plan>,
  snapshot: IndexedYearBalances,
): PromotionBalance[] | AggregateConversionPromotionIssue {
  const states: PromotionBalance[] = []
  for (const account of plan.accounts) {
    if (!participatesInAggregateRothConversionAllocation(account)) continue
    const balance = snapshot.balances[account.id]
    if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) {
      return issue(
        'missingAccountBalance',
        // The caller's own array position, not the year: `yearBalances` is an
        // array, and a field path that reads like an index has to be one.
        `yearBalances.${snapshot.index}.balances.${account.id}`,
        `Every owned traditional and every Roth account needs a stated nonnegative balance for ${snapshot.year}.`,
      )
    }
    states.push({ account, balance })
  }
  return states
}

/**
 * Every account the year would NAME on a request that the Plan records no
 * individual owner for.
 *
 * THE DIVERGENCE THIS EXISTS FOR. The allocation policy attributes an account
 * with `ownerPersonId: null` to the primary person, because the aggregate
 * ledger does: a household figure has to come from somewhere, and no projection
 * refuses to run over a joint account. The identity path does the opposite and
 * is right to — `allocateRetirementActionCandidateIdentity` answers a null
 * owner with `ambiguousIdentity` and the registered reason
 * `conversion-source-owner-mismatch` (or its destination twin), because a
 * conversion is a rollover inside one individual's own accounts and "the Plan
 * did not say" is not the same claim as "the primary person's". Left alone, the
 * chooser would hand back `chosen` intents the adapter is guaranteed to block,
 * and would launder an arithmetic fallback into an assertion of ownership on a
 * request a person would act on.
 *
 * BE PRECISE ABOUT HOW REACHABLE THIS IS, because the honest scope is narrower
 * than it first looks and a diagnostic that overstates it sends people looking
 * for a plan they cannot have. `planSchema` already refuses `ownerPersonId:
 * null` on every traditional, roth and hsa account (`model/plan.ts`,
 * `individuallyOwnedAccountTypes`), and those are the only account types this
 * policy can select as a source or a destination. So no Plan that has been
 * parsed can reach this, and no user can be in the state it describes. What can
 * reach it is a caller holding a Plan-SHAPED object it never parsed — which the
 * TypeScript type permits, since `ownerPersonId` is `string | null` on the
 * account type and the invariant lives in a `superRefine` a signature cannot
 * show. This function closes that gap; the schema closes the real one, and the
 * suite pins the schema half first for exactly that reason.
 *
 * Only accounts the year actually names are checked. An ownerless account that
 * contributes to a weight but supplies no draw is the ledger's arithmetic, and
 * the request never mentions it.
 *
 * Worth knowing what pins what: the `?? primaryPersonId` fallback is an
 * unregistered ledger convention — `irc-408-d-3-A-i-conversion-benefits-the-distributee`
 * registers the owner boundary, the gross-balance weight, the exact-cent split,
 * the destination search and the trim, and says nothing about an account with no
 * recorded owner. What is registered on this side is the refusal, in the action
 * reason vocabulary. If the fallback is ever to be relied on for anything a user
 * acts on, it needs a record of its own first.
 */
function ownerlessSelectedAccounts<TBalance extends AggregateRothConversionBalance>(
  allocation: Extract<
    ReturnType<typeof allocateAggregateRothConversionByOwner<TBalance>>,
    { status: 'allocated' }
  >,
): Array<{ account: Account; role: 'source' | 'destination' }> {
  const ownerless: Array<{ account: Account; role: 'source' | 'destination' }> = []
  // Sources in Plan order, then the destinations they credit, so two ownerless
  // accounts are always reported in the same order.
  for (const draw of allocation.draws) {
    if (draw.sourceAccount.ownerPersonId === null) {
      ownerless.push({ account: draw.sourceAccount, role: 'source' })
    }
  }
  for (const slice of allocation.slices) {
    const account = slice.destination.destinationAccount
    if (account.ownerPersonId === null) ownerless.push({ account, role: 'destination' })
  }
  return ownerless
}

/** What one scheduled year produced: its outcome, or the issues that stopped it. */
type YearPromotionOutcome =
  | AggregateConversionPromotionYearOutcome
  | AggregateConversionPromotionIssue[]

/** The parts of the run that do not change from year to year. */
interface YearPromotionContext {
  readonly plan: Readonly<Plan>
  readonly primaryPersonId: string
  readonly provenanceSourceId: string
}

/**
 * Allocate one scheduled year and mint that year's intents.
 *
 * Separated from the loop for one reason: it is the whole of the exact-cent
 * arithmetic over caller-supplied balances, so the caller can put a single
 * documented `RangeError` seam around it rather than around each of the three
 * conversions inside. It raises nothing of its own.
 */
function promoteOneYear(
  context: YearPromotionContext,
  year: number,
  winnerCents: number,
  stated: IndexedYearBalances,
  balances: readonly PromotionBalance[],
): YearPromotionOutcome {
  const { plan, primaryPersonId, provenanceSourceId } = context
  const allocation: AggregateRothConversionOwnerAllocation<PromotionBalance> =
    allocateAggregateRothConversionByOwner({
      balances,
      desiredPlanDollars: ledgerCentsToPlanDollars(asPositiveUsdCents(winnerCents)),
      primaryPersonId,
    })
  if (allocation.status === 'refused') {
    return {
      year,
      winnerCents,
      allocatedCents: 0,
      trims: [],
      refusal: allocation.reason,
      intents: [],
    }
  }

  const ownerless = ownerlessSelectedAccounts(allocation)
  if (ownerless.length > 0) {
    return ownerless.map((entry) => {
      const index = plan.accounts.findIndex((account) => account.id === entry.account.id)
      return issue(
        'missingAccountOwner',
        `plan.accounts.${index}.ownerPersonId`,
        `The Plan records no individual owner for “${entry.account.name}” (${entry.account.id}), ` +
        `which ${entry.role === 'source' ? 'supplies' : 'receives'} the ${year} conversion. ` +
        'A conversion request must name whose account it is, and the aggregate ledger’s fallback ' +
        'to the primary person is not a statement of ownership. A parsed Plan cannot be in this ' +
        'state — planSchema requires an individual owner on every traditional, roth and hsa ' +
        'account — so this Plan reached the chooser without being parsed.',
      )
    })
  }

  const yearIntents: RothConversionCandidateIdentityIntent[] = []
  let allocatedCents = 0
  for (const slice of allocation.slices) {
    const sourceAllocations: RetirementActionCandidateSourceIntent[] = []
    let ownerCents = 0
    for (const draw of allocation.draws) {
      if (draw.ownerPersonId !== slice.ownerPersonId) continue
      // Half-up measures the draw, and the source's FUNDABLE cents cap it.
      // The conversion executor snapshots a source at the whole cents its
      // float balance can fund, so an uncapped half-up figure on a drained
      // fractional-cent balance would mint a request one cent past capacity
      // and the executor would block it whole. A partial draw sits below
      // capacity and keeps its half-up figure — flooring it instead would
      // lose a cent to the float noise in the policy's remainder
      // subtraction, which is measurement, not capacity. A draw capped to
      // zero is the same non-event the sub-cent discharge records as
      // nothing, and is skipped on the same reasoning.
      const fundableCents = planDollarsToFlooredLedgerCents(
        stated.balances[draw.sourceAccount.id] ?? draw.amountPlanDollars,
      )
      const measuredCents = planDollarsToLedgerCents(draw.amountPlanDollars)
      const cappedCents = Math.min(measuredCents, fundableCents)
      if (cappedCents === 0) continue
      const drawCents = asPositiveUsdCents(cappedCents)
      sourceAllocations.push({
        sourceAccountId: asAccountId(draw.sourceAccount.id),
        requestedAmount: drawCents,
      })
      ownerCents += drawCents
    }
    if (sourceAllocations.length === 0) continue
    yearIntents.push({
      kind: 'rothConversion',
      year,
      executionDate: canonicalExecutionDate(year),
      // Overwritten below with the canonical slot; a placeholder here would
      // be one more thing to keep in step with the sort.
      executionSequence: 0,
      requestedAmount: asPositiveUsdCents(ownerCents),
      personId: asPersonId(slice.ownerPersonId),
      provenance: { source: 'generator', sourceId: provenanceSourceId },
      sourceAllocations,
      destinationRothAccountId: asAccountId(slice.destination.destinationAccount.id),
      // The aggregate schedule names no funding movement of its own: the
      // year's ordinary withdrawal flow pays the tax, exactly as it does when
      // the ledger converts. `externalCash` is the only other disposition
      // this adapter admits and it requires an attestation about money
      // outside the plan, which no projection can make.
      taxFunding: { kind: 'noneExpected' },
    })
    allocatedCents += ownerCents
  }

  // One execution slot per converting owner, numbered in canonical person
  // order rather than in the order the policy sliced them. Slice order is
  // Plan array order, and the slot number reaches the minted action ID, so
  // numbering by it would make two Plans that differ only in how their
  // accounts were typed in mint two different candidates. What the slot
  // cannot be is arbitrary: it has to be stable, and unique inside the year.
  const canonicalYearIntents = [...yearIntents]
    .sort((left, right) => compareUtf16CodeUnits(left.personId, right.personId))
    .map((intent, index) => ({ ...intent, executionSequence: index + 1 }))

  return {
    year,
    winnerCents,
    allocatedCents,
    trims: allocation.trims,
    refusal: null,
    intents: canonicalYearIntents,
  }
}

/**
 * Choose the owners, sources, destinations and exact cents that make an
 * aggregate winner's schedule executable.
 *
 * Pure: it reads the Plan and the supplied snapshots and returns intents. It
 * simulates nothing, mints no candidate, and mutates neither input.
 */
export function chooseAggregateConversionPromotionIntents(
  input: AggregateConversionPromotionInput,
): AggregateConversionPromotionChoice {
  const { plan, winner, yearBalances } = input
  const issues: AggregateConversionPromotionIssue[] = []
  const years: AggregateConversionPromotionYearOutcome[] = []
  const intents: RothConversionCandidateIdentityIntent[] = []

  if (winner.source === 'milp') {
    return unallocatable(years, [issue(
      'milpWinnerNotPromotable',
      'winner.source',
      'A solver winner needs optimizer provenance whose source ID is the allocated candidate’s own ID, which no adapter-minted request can carry.',
    )])
  }
  if (winner.candidateId === null || winner.candidateId.trim().length === 0) {
    return unallocatable(years, [issue(
      'winnerCandidateIdMissing',
      'winner.candidateId',
      'A candidate winner must name the generator candidate its promoted requests take provenance from.',
    )])
  }
  const provenanceSourceId = winner.candidateId

  const cents = winnerCentsByYear(winner.conversions)
  if (!(cents instanceof Map)) return unallocatable(years, [cents])
  if (cents.size === 0) {
    return unallocatable(years, [issue(
      'emptyWinnerSchedule',
      'winner.conversions',
      'There is no positive conversion year to promote.',
    )])
  }

  // Built by hand rather than by `new Map(entries)`, which resolves a repeated
  // key by keeping the last one silently. Two snapshots for one year is a
  // caller that does not know which balances the ledger read, and allocating
  // against whichever happened to be written second would answer with a
  // schedule nobody could trace back to a projection. Named year and all,
  // because the caller has to find the duplicate to remove it.
  const balancesByYear = new Map<number, IndexedYearBalances>()
  for (const [index, entry] of yearBalances.entries()) {
    if (balancesByYear.has(entry.year)) {
      return unallocatable(years, [issue(
        'duplicateYearBalances',
        `yearBalances.${index}.year`,
        `Year ${entry.year} carries more than one balance snapshot, and which one the ledger read is unstated.`,
      )])
    }
    balancesByYear.set(entry.year, { index, year: entry.year, balances: entry.balances })
  }
  const primaryPersonId = plan.household.people[0]?.id
  if (primaryPersonId === undefined) {
    return unallocatable(years, [issue(
      'missingPrimaryPerson',
      'plan.household.people',
      'A Plan with no person has no owner for an account the Plan records no individual owner for.',
    )])
  }

  for (const [year, winnerCents] of cents) {
    const stated = balancesByYear.get(year)
    if (stated === undefined) {
      issues.push(issue(
        'missingYearBalances',
        // No array position to point at -- the entry the caller has to add is
        // the one that is not there -- so the year goes in the detail.
        'yearBalances',
        `Year ${year} is promoted with no balance snapshot for the policy to weight its owners by.`,
      ))
      continue
    }
    const balances = promotionBalancesForYear(plan, stated)
    if (!Array.isArray(balances)) {
      issues.push(balances)
      continue
    }

    // THE ONE PLACE A THROW CROSSES THIS CONTRACT, AND WHY IT IS CAUGHT HERE.
    //
    // Everything inside `promoteOneYear` measures caller-supplied Plan-dollar
    // figures in exact cents, and the arithmetic layer's answer to a figure it
    // cannot represent is a `RangeError` — from the policy's per-owner weight
    // sum (`planDollarsToLedgerCents` over a whole household's convertible
    // balances, which can exceed the safe-integer cent range even where every
    // account in it is fine), and from the fundable-cents read on a single
    // source balance (`planDollarsToFlooredLedgerCents`, which the policy's
    // single-owner shortcut never reaches through the weight sum). Both mean
    // the same thing to this caller — the snapshot states a figure this ledger
    // cannot hold — and this contract promises typed issues, so both are
    // reported as one rather than escaping to a caller that has no way to tell
    // them from a defect.
    //
    // The catch is by error class and refuses the year, not the run: only a
    // `RangeError` is converted, and anything else is rethrown untouched. A
    // future bug in the minting below therefore still surfaces as itself.
    let outcome: YearPromotionOutcome
    try {
      outcome = promoteOneYear(
        { plan, primaryPersonId, provenanceSourceId },
        year,
        winnerCents,
        stated,
        balances,
      )
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      issues.push(issue(
        'unrepresentableYearBalances',
        `yearBalances.${stated.index}.balances`,
        `The ${year} balances state a figure the exact-cent ledger cannot represent, ` +
        'so the year cannot be allocated: a single balance, or the sum of one owner’s ' +
        'convertible balances, exceeds the safe-integer cent range.',
      ))
      continue
    }
    if (Array.isArray(outcome)) {
      issues.push(...outcome)
      continue
    }
    years.push(outcome)
    intents.push(...outcome.intents)
  }

  if (issues.length > 0) return unallocatable(years, issues)
  const [first, ...rest] = intents
  if (first === undefined) {
    return unallocatable(years, [issue(
      'noLawfulConversion',
      'winner.conversions',
      'No scheduled year could name a lawful owner, source and destination, so there is nothing to promote.',
    )])
  }
  return { status: 'chosen', intents: [first, ...rest], years }
}

function unallocatable(
  years: readonly AggregateConversionPromotionYearOutcome[],
  issues: readonly AggregateConversionPromotionIssue[],
): Extract<AggregateConversionPromotionChoice, { status: 'unallocatable' }> {
  const [first, ...rest] = issues
  if (first === undefined) {
    throw new TypeError('An unallocatable promotion must carry at least one issue')
  }
  return { status: 'unallocatable', years, issues: [first, ...rest] }
}

/**
 * Choose the identities and mint the candidate that carries them.
 *
 * The exploratory candidate must be the vetoed winner's own generator
 * candidate: it supplies the fill-target window every intent year has to fall
 * inside, and its ID is the provenance the comparator pins the candidate arm
 * to. The minted candidate is identity-complete and unpriced — pricing it is
 * `evaluateCandidate`'s job, and ranking it is the tournament's.
 */
export function promoteAggregateConversionSchedule(
  input: AggregateConversionPromotionInput & {
    readonly exploratoryCandidate: Readonly<DecisionCandidate>
  },
): AggregateConversionPromotionResult {
  const { exploratoryCandidate, ...choiceInput } = input
  // A missing or blank candidate ID is its own refusal, reported by the
  // chooser as `winnerCandidateIdMissing`; running the mismatch test over it
  // would name the wrong defect. The mismatch check therefore applies only to
  // a winner that actually names a candidate.
  if (input.winner.source === 'candidate' &&
      input.winner.candidateId !== null &&
      input.winner.candidateId.trim().length > 0 &&
      exploratoryCandidate.id !== input.winner.candidateId) {
    return {
      status: 'unallocatable',
      choice: unallocatable([], [issue(
        'exploratoryCandidateMismatch',
        'exploratoryCandidate.id',
        'The exploratory candidate must be the winner the veto named, or the promoted requests carry provenance the comparator will not accept.',
      )]),
    }
  }

  const choice = chooseAggregateConversionPromotionIntents(choiceInput)
  if (choice.status === 'unallocatable') return { status: 'unallocatable', choice }

  const adaptation = adaptFillTargetRothConversionGeneratorCandidate(
    input.plan,
    exploratoryCandidate,
    choice.intents,
  )
  return adaptation.status === 'adapted'
    ? { status: 'promoted', candidate: adaptation.candidate, choice, adaptation }
    : { status: 'blocked', choice, adaptation }
}
