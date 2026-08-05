import {
  buildAnnualRetirementPhysicalEventInventory,
  type AnnualRetirementPhysicalEvent,
  type AnnualRetirementRuntimeInventoryRecord,
  type CompleteAnnualRetirementRuntimeInventoryAttestation,
  type OwnedNonRothIraAnnualPhysicalEventPoolView,
} from '../actions/annualRetirementPhysicalEventInventory.js'
import type { EvaluateAnnualQcdExecutionPrerequisitesInput } from '../actions/annualQcdExecutionPrerequisite.js'
import type { AccountOpeningBalanceSnapshot } from '../actions/execution.js'
import type { AccountId, PersonId } from '../actions/identity.js'
import { asUsdCents, type UsdCents } from '../actions/money.js'
import type {
  PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
  StagedOwnedNonRothIraAnnualContributionApplicationInput,
  StagedOwnedNonRothIraAnnualEventApplicationInput,
} from '../actions/ownedNonRothIraAnnualPhysicalTransaction.js'
import { deriveActionStructuralId } from '../actions/structuralId.js'

/**
 * Turns the annual pass's sealed runtime journal into the per-owner input the
 * unified owned-IRA physical transaction demands.
 *
 * The two sides speak different languages. The journal records what the
 * simulator *did*, at the mutation site, in mutation order, keyed by a producer
 * occurrence key. The transaction preparer wants a *detached chain*: for each
 * owner's owned non-Roth IRA pool, one staged application per Form 8606
 * line-7/line-8 inventory event and one per settled contribution event, each
 * carrying the source balance before and after, walked in the inventory's own
 * chronological order from the year's opening balances.
 *
 * Recomputing the chain rather than copying the journal's recorded before/after
 * is deliberate. Mutation order and inventory chronology are not the same
 * ordering, and the preparer validates the chain against itself; a copied
 * balance from a different ordering would be internally inconsistent and would
 * surface as `sourceBalanceMismatch` far from its cause. The amounts are still
 * the journal's -- only the running balances are derived.
 *
 * Everything this cannot supply exactly, it refuses. It never guesses an
 * execution, never nets two events together, and never emits a pool it could
 * not walk end to end.
 *
 * NOT YET REACHABLE FROM THE ANNUAL PASS, and the reason is not incidental.
 * The inventory only admits a runtime record that RESOLVED, which needs an
 * execution date, an execution sequence, and a movement authority; one
 * unresolved record refuses the whole year. Every occurrence producer in
 * `simulate.ts` passes null for all three, deliberately -- the journal's own
 * contract says "the annual simulator's loop position is not an execution
 * sequence and its year is not December 31". So the annual pass does not model
 * within-year chronology, and this module cannot be called from it until
 * something does. Supplying synthetic dates to make the inventory build would
 * invent exactly the ordering the post-pass then consumes to decide which gift
 * claims which taxable dollar, so it is not a shortcut that can be taken
 * quietly. The tests below construct the resolved records the annual pass does
 * not yet produce.
 *
 * That is not a gap in the executed-gift path: a committed QCD publishes from
 * the executor's own evidence, exactly as a named Roth conversion does, so this
 * translator's consumer is the future unified annual ledger rather than the
 * publication slice.
 */

export type OwnedIraAnnualPhysicalTransactionInputsIssueKind =
  /** The physical-event inventory did not build from this journal and Plan. */
  | 'inventoryUnavailable'
  /** A pool source had no opening balance, so its chain has no starting point. */
  | 'openingBalanceMissing'
  /**
   * The pool carries owned-IRA activity that is neither a Form 8606 line-7/8
   * candidate, nor a QCD candidate, nor a settled contribution -- a rollover
   * inflow, an annuity funding transfer, or another traditional transfer.
   *
   * Unreachable from a sealed runtime journal, deliberately kept anyway. None
   * of those kinds is a *resolved* runtime kind, so a journal carrying one
   * produces an unresolved record and the inventory refuses the whole year
   * before any pool is walked -- the refusal arrives as `inventoryUnavailable`.
   * This guard is what stops a caller supplying records some other way from
   * walking past activity the pool chain does not model.
   */
  | 'unsupportedPoolActivity'
  /**
   * The pool carries a Plan-declared line-7 or line-8 movement -- a named Roth
   * conversion or a named ordinary withdrawal scheduled in the same year as the
   * gift. The inventory derives those events from the Plan while the journal
   * separately records what executed, and nothing here joins the two, so the
   * same movement would be presented twice with no way to tell which amount is
   * authoritative. Refused rather than netted.
   */
  | 'planDeclaredPoolMovement'
  /**
   * Walking the pool overdrew a source or left the exact-cent safe-integer
   * range. A resolved runtime event is an observation of a movement that
   * already happened, so this means the opening balances and the journal
   * disagree about the year.
   */
  | 'detachedChainUnrepresentable'

export interface OwnedIraAnnualPhysicalTransactionInputsIssue {
  readonly kind: OwnedIraAnnualPhysicalTransactionInputsIssueKind
  readonly detail: string
  readonly ownerPersonId?: PersonId
  readonly sourceAccountId?: AccountId
  readonly inventoryEventId?: string
}

export interface BuildOwnedIraAnnualPhysicalTransactionInputsInput {
  readonly plan: unknown
  readonly taxYear: number
  readonly runtimeInventoryAttestation:
    Readonly<CompleteAnnualRetirementRuntimeInventoryAttestation>
  readonly runtimeRecords:
    readonly Readonly<AnnualRetirementRuntimeInventoryRecord>[]
  /** Every owned-IRA source's balance at the start of the tax year, in exact cents. */
  readonly openingBalances: readonly Readonly<AccountOpeningBalanceSnapshot>[]
  /**
   * The authoritative QCD prerequisite inputs. The preparer rebuilds the
   * prerequisite from these and synthesizes the QCD applications itself, so
   * this translator never stages a gift.
   */
  readonly qcdPrerequisiteInput: Readonly<EvaluateAnnualQcdExecutionPrerequisitesInput>
}

export interface OwnedIraAnnualPhysicalTransactionInputsBuilt {
  readonly status: 'ownedIraAnnualPhysicalTransactionInputsBuilt'
  readonly inputs:
    readonly Readonly<PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput>[]
  readonly issues: readonly []
}

export interface OwnedIraAnnualPhysicalTransactionInputsBlocked {
  readonly status: 'ownedIraAnnualPhysicalTransactionInputsBlocked'
  readonly inputs: readonly []
  readonly issues: readonly [
    Readonly<OwnedIraAnnualPhysicalTransactionInputsIssue>,
    ...Readonly<OwnedIraAnnualPhysicalTransactionInputsIssue>[],
  ]
}

export type BuildOwnedIraAnnualPhysicalTransactionInputsResult =
  | OwnedIraAnnualPhysicalTransactionInputsBuilt
  | OwnedIraAnnualPhysicalTransactionInputsBlocked

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function blocked(
  issues: readonly Readonly<OwnedIraAnnualPhysicalTransactionInputsIssue>[],
): OwnedIraAnnualPhysicalTransactionInputsBlocked {
  const [first, ...rest] = issues
  return deepFreeze({
    status: 'ownedIraAnnualPhysicalTransactionInputsBlocked',
    inputs: [],
    issues: [first ?? {
      kind: 'inventoryUnavailable' as const,
      detail: 'The owned-IRA annual physical transaction inputs could not be built.',
    }, ...rest],
  })
}

function isSettledContribution(event: AnnualRetirementPhysicalEvent): boolean {
  return event.kind === 'ownedIraContribution' ||
    event.kind === 'ownedIraEmployerContribution'
}

/**
 * A QCD candidate event belongs to the gift's own stage. The preparer
 * synthesizes its application from the rebuilt prerequisite, so this walk must
 * still advance the running balance past it without emitting anything.
 */
function isQcdCandidate(event: AnnualRetirementPhysicalEvent): boolean {
  return event.form8606Category === 'qcdCandidateAwaitingAnnualQcdStage'
}

function isLineSevenOrEight(event: AnnualRetirementPhysicalEvent): boolean {
  return event.form8606Category === 'line7DistributionCandidate' ||
    event.form8606Category === 'line8ConversionCandidate'
}

interface PoolWalk {
  readonly actualApplications:
    readonly Readonly<StagedOwnedNonRothIraAnnualEventApplicationInput>[]
  readonly settledContributionApplications:
    readonly Readonly<StagedOwnedNonRothIraAnnualContributionApplicationInput>[]
}

function walkPool(
  pool: Readonly<OwnedNonRothIraAnnualPhysicalEventPoolView>,
  inventoryEvidenceId: string,
  openingBySource: ReadonlyMap<AccountId, UsdCents>,
  issues: OwnedIraAnnualPhysicalTransactionInputsIssue[],
): PoolWalk | null {
  const before = issues.length
  const running = new Map<AccountId, number>()
  for (const sourceAccountId of pool.sourceAccountIds) {
    const opening = openingBySource.get(sourceAccountId)
    if (opening === undefined) {
      issues.push({
        kind: 'openingBalanceMissing',
        detail: 'Every owned-IRA pool source needs one exact opening balance, including unchanged siblings.',
        ownerPersonId: pool.ownerPersonId,
        sourceAccountId,
      })
      continue
    }
    running.set(sourceAccountId, opening)
  }

  const actualApplications: StagedOwnedNonRothIraAnnualEventApplicationInput[] = []
  const settledContributionApplications:
    StagedOwnedNonRothIraAnnualContributionApplicationInput[] = []

  for (const event of pool.events) {
    const balance = running.get(event.sourceAccountId)
    if (balance === undefined) continue

    if (isQcdCandidate(event)) {
      // Advance past the gift without staging it. The preparer debits
      // min(gross, chain balance) here from the rebuilt prerequisite, so the
      // same trim has to be reflected or every later event on this source
      // would start from a balance the preparer does not agree with.
      running.set(event.sourceAccountId, balance - Math.min(event.grossAmount, balance))
      continue
    }

    if (isSettledContribution(event)) {
      const after = balance + event.grossAmount
      if (!Number.isSafeInteger(after)) {
        issues.push({
          kind: 'detachedChainUnrepresentable',
          detail: 'A settled owned-IRA contribution left the exact-cent safe-integer range.',
          ownerPersonId: pool.ownerPersonId,
          sourceAccountId: event.sourceAccountId,
          inventoryEventId: event.eventId,
        })
        continue
      }
      settledContributionApplications.push({
        inventoryEventId: event.eventId,
        sourceBalanceBefore: asUsdCents(balance),
        creditedAmount: asUsdCents(event.grossAmount),
        sourceBalanceAfter: asUsdCents(after),
        stagingEvidenceId: deriveActionStructuralId(
          'projection-owned-ira-annual-staged-contribution',
          [inventoryEvidenceId, event.eventId, balance, event.grossAmount, after],
        ),
      })
      running.set(event.sourceAccountId, after)
      continue
    }

    if (!isLineSevenOrEight(event)) {
      issues.push({
        kind: 'unsupportedPoolActivity',
        detail: 'Owned-IRA activity outside Form 8606 lines 7 and 8, a QCD, or a settled contribution needs a broader physical ledger stage.',
        ownerPersonId: pool.ownerPersonId,
        sourceAccountId: event.sourceAccountId,
        inventoryEventId: event.eventId,
      })
      continue
    }

    if (event.origin === 'planAction') {
      issues.push({
        kind: 'planDeclaredPoolMovement',
        detail: 'A Plan-declared owned-IRA distribution or conversion in the same year as a named gift has no join between its declared and executed amounts.',
        ownerPersonId: pool.ownerPersonId,
        sourceAccountId: event.sourceAccountId,
        inventoryEventId: event.eventId,
      })
      continue
    }

    // A resolved runtime event is an observation, so it executes its exact
    // inventoried gross; the preparer refuses anything else as
    // `runtimeExecutionMismatch`. An overdraft therefore means the opening
    // balances and the journal disagree, which is worth refusing loudly.
    if (event.grossAmount > balance) {
      issues.push({
        kind: 'detachedChainUnrepresentable',
        detail: 'A resolved owned-IRA movement overdrew its source against the year\'s opening balances.',
        ownerPersonId: pool.ownerPersonId,
        sourceAccountId: event.sourceAccountId,
        inventoryEventId: event.eventId,
      })
      continue
    }
    const after = balance - event.grossAmount
    actualApplications.push({
      inventoryEventId: event.eventId,
      sourceBalanceBefore: asUsdCents(balance),
      executedAmount: asUsdCents(event.grossAmount),
      sourceBalanceAfter: asUsdCents(after),
      stagingEvidenceId: deriveActionStructuralId(
        'projection-owned-ira-annual-staged-application',
        [inventoryEvidenceId, event.eventId, balance, event.grossAmount, after],
      ),
    })
    running.set(event.sourceAccountId, after)
  }

  if (issues.length !== before) return null
  return { actualApplications, settledContributionApplications }
}

/**
 * Builds one transaction input per owner whose owned-IRA pool carries a QCD
 * candidate. Owners with no gift are not the unified transaction's business
 * this slice, and emitting them would demand a staged chain for a pool nothing
 * is going to finalize.
 */
export function buildOwnedIraAnnualPhysicalTransactionInputs(
  input: Readonly<BuildOwnedIraAnnualPhysicalTransactionInputsInput>,
): Readonly<BuildOwnedIraAnnualPhysicalTransactionInputsResult> {
  const inventoryInput = {
    plan: input.plan,
    taxYear: input.taxYear,
    runtimeInventoryAttestation: input.runtimeInventoryAttestation,
    runtimeRecords: input.runtimeRecords,
  }
  const inventory = buildAnnualRetirementPhysicalEventInventory(inventoryInput)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    return blocked([{
      kind: 'inventoryUnavailable',
      detail: `The annual physical-event inventory did not build: ${inventory.issues[0]?.detail ?? 'unknown reason'}`,
    }])
  }

  const openingBySource = new Map<AccountId, UsdCents>()
  for (const opening of input.openingBalances) {
    openingBySource.set(opening.accountId, opening.openingBalance)
  }

  const issues: OwnedIraAnnualPhysicalTransactionInputsIssue[] = []
  const inputs: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput[] = []
  const giftPools = inventory.ownedIraPools.filter(
    (pool) => pool.qcdCandidateAwaitingAnnualQcdStage.events.length > 0,
  )
  for (const pool of giftPools) {
    const walk = walkPool(pool, inventory.inventoryEvidenceId, openingBySource, issues)
    if (walk === null) continue
    inputs.push({
      ...inventoryInput,
      ownerPersonId: pool.ownerPersonId,
      openingBalances: pool.sourceAccountIds.map((accountId) => ({
        accountId,
        openingBalance: openingBySource.get(accountId)!,
      })),
      actualApplications: walk.actualApplications,
      settledContributionApplications: walk.settledContributionApplications,
      qcdPrerequisiteInput: input.qcdPrerequisiteInput,
    })
  }

  if (issues.length > 0) return blocked(issues)
  return deepFreeze({
    status: 'ownedIraAnnualPhysicalTransactionInputsBuilt',
    inputs,
    issues: [],
  })
}
