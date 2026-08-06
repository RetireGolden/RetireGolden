import {
  allocateAggregateRothConversionByOwner,
  type AggregateRothConversionBalance,
  type AggregateRothConversionRefusalReason,
  type AggregateRothConversionTrim,
} from '../actions/aggregateRothConversionOwnerAllocation.js'
import { asAccountId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import {
  ledgerCentsToPlanDollars,
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
import { isConvertibleToRoth } from '../strategies/accountEligibility.js'

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
 * No caller consumes this yet. `optimizePlan.ts` is where it belongs — the
 * comparator needs `RetirementActionReadinessVeto.vetoedResult`, which is
 * stripped at the worker boundary (`runOptimize.ts:41-54`), so promotion has to
 * happen engine-side — and the slice that runs the chooser inside the
 * tournament, prices the candidate, and records the comparator's verdict
 * without publishing anything is the next one.
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
 * THE EXACT SET THAT MUST BE PRESENT: every Plan account for which
 * `isConvertibleToRoth` holds — an owned, non-inherited traditional account,
 * employer plans included — and every account of `type: 'roth'`, of BOTH kinds.
 * Everything else may be omitted: cash, taxable, equity comp, HSA, inherited
 * traditional, property, debt.
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
  /** The Plan names nobody, so an unowned account has no owner to fall back to. */
  | 'missingPrimaryPerson'
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
 * Does this account take part in the allocation policy at all?
 *
 * The two ways to take part are supplying dollars and being a Roth account. The
 * second is wider than "can receive a conversion" on purpose: a designated Roth
 * account can receive nothing, and it still decides which of the two trim
 * reasons its owner hears. `AggregateConversionPromotionYearBalances` documents
 * this as the exact set a snapshot must state.
 */
function participatesInAllocation(account: Account): boolean {
  return isConvertibleToRoth(account) || account.type === 'roth'
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
    const cents = planDollarsToLedgerCents(conversion.amount)
    if (cents <= 0 || ledgerCentsToPlanDollars(cents) !== conversion.amount) {
      return issue(
        'invalidWinnerSchedule',
        `winner.conversions.${index}.amount`,
        'The winner amount is not an exact cent figure the ledger could have executed.',
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
    if (!participatesInAllocation(account)) continue
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

    const allocation = allocateAggregateRothConversionByOwner({
      balances,
      desiredPlanDollars: ledgerCentsToPlanDollars(asPositiveUsdCents(winnerCents)),
      primaryPersonId,
    })
    if (allocation.status === 'refused') {
      years.push({
        year,
        winnerCents,
        allocatedCents: 0,
        trims: [],
        refusal: allocation.reason,
        intents: [],
      })
      continue
    }

    const yearIntents: RothConversionCandidateIdentityIntent[] = []
    let allocatedCents = 0
    for (const slice of allocation.slices) {
      const sourceAllocations: RetirementActionCandidateSourceIntent[] = []
      let ownerCents = 0
      for (const draw of allocation.draws) {
        if (draw.ownerPersonId !== slice.ownerPersonId) continue
        // The policy already discharged every movement the exact-cent ledger
        // would record as nothing, so each remaining draw is worth at least one
        // cent and `asPositiveUsdCents` cannot refuse it.
        const drawCents = asPositiveUsdCents(
          planDollarsToLedgerCents(draw.amountPlanDollars),
        )
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

    years.push({
      year,
      winnerCents,
      allocatedCents,
      trims: allocation.trims,
      refusal: null,
      intents: canonicalYearIntents,
    })
    intents.push(...canonicalYearIntents)
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
  if (input.winner.source === 'candidate' &&
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
