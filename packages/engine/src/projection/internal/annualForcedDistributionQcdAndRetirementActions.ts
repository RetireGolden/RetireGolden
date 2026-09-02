import type { Account, Person, Plan } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import type { IraProRataYear } from '../../strategies/iraBasis.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../annualRetirementRuntimeJournal.js'
import type {
  PersonYearState,
  SimulatorRetirementRuntimeApplication,
} from '../types.js'

import type { InheritedAccountYearEvidence } from '../types.js'
import {
  isAggregatedIra,
  isTreatAsOwnEffective,
  type NonpersistedActionPersonAliveEvidence,
} from '../../strategies/accountEligibility.js'
import { type RothBasisState } from '../../strategies/rothBasis.js'
import { annualOwnerRmdPlan } from './annualOwnerRmdPlan.js'
import { annualSeppDistributions } from './annualSeppDistributions.js'
import {
  annualInheritedIraDistributions,
  type AnnualInheritedIraClassCacheEntry,
} from './annualInheritedIraDistributions.js'
import { annualLegacyQcdGiftPlan } from './annualLegacyQcdGiftPlan.js'
import {
  annualLegacyQcdOwnerCharacterPlan,
  materializeAnnualLegacyQcdOwnerCharacterPlanResult,
} from './annualLegacyQcdOwnerCharacterPlan.js'
import { annualRetirementActionPreflight } from './annualRetirementActionPreflight.js'
import { annualQcdExecutionInput } from './annualQcdExecutionInput.js'
import {
  annualOrdinaryWithdrawalBoundary,
  type AnnualOrdinaryWithdrawalBoundaryResult,
} from './annualOrdinaryWithdrawalBoundary.js'
import { annualRothConversionExecutionInput } from './annualRothConversionExecutionInput.js'
import {
  computeRmdShortfallExcise,
  type RmdApplicablePlan,
  type RmdShortfallExciseResult,
  type RmdShortfallObligation,
  type RmdShortfallReliefElection,
} from '../../rmd/rmdShortfallExcise.js'
import {
  asUsdCents,
  executeAnnualQcds,
  executeRothConversions,
  ledgerCentsToPlanDollars,
  planDollarsMoveNoLedgerCent,
  type ActionId,
  type ConversionLinkedWithdrawalGroupLiabilityRun,
  type ExecuteAnnualQcdsResult,
  type ExecuteRothConversionsResult,
  type PersonId,
} from '../../actions/index.js'
import { compareUtf16CodeUnits } from '../../actions/structuralId.js'
import type { SimulatorAnnualPassDeferredFirstRmd } from '../annualPassTransaction.js'
import type {
  AnnualConversionLinkedWithdrawalRelease,
} from './annualConversionLinkedWithdrawalFunding.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'

type TreatAsOwnAccount = Parameters<typeof isTreatAsOwnEffective>[0]
type SimulatorRetirementRuntimeApplicationWithoutOrdinal =
  SimulatorRetirementRuntimeApplication extends infer Application
    ? Application extends SimulatorRetirementRuntimeApplication
      ? Omit<Application, 'mutationOrdinal'>
      : never
    : never

interface DeferredLegacyQcdDistribution {
  readonly ownerId: string
  readonly amount: number
  readonly producerOccurrenceKey: string
  readonly sourceAccountId: string
  readonly mutationOrdinal: number
}

export interface AnnualForcedDistributionQcdRetirementActionsFacts {
  readonly year: number
  readonly startYear: number
  readonly pack: Readonly<ParameterPack>
  readonly plan: Readonly<Plan>
  readonly passPlan: Readonly<Plan>
  readonly passRetirementActions: readonly Readonly<Plan['strategies']['retirementActions'][number]>[]
  readonly primary: Readonly<Person>
  readonly people: readonly Readonly<Person>[]
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly peopleStates: readonly Readonly<PersonYearState>[]
  readonly inflFactor: number
  readonly limitGrowth: number
  readonly birthMonthByPerson: ReadonlyMap<string, number>
  readonly rmdFirstYearDeferrals: readonly Readonly<{
    readonly distributionCalendarYear: number
    readonly applicablePlan: RmdApplicablePlan
  }>[]
  readonly isStandIn: boolean
  readonly qcdSection219ByDonor: ReadonlyMap<string, number>
  readonly preProjectionQcdOffsetUnprovable: ReadonlySet<string>
}

export interface AnnualForcedDistributionQcdRetirementActionsLedger {
  readonly balances: PhysicalBalanceState[]
  readonly annualIdKeyedBalances: PhysicalBalanceState[]
  readonly ownersWithOmittedNondeductibleBasis: Set<string>
  readonly iraProRata: Map<string, IraProRataYear>
  readonly qcdProRataIdentityByReadSnapshot: WeakMap<IraProRataYear, IraProRataYear>
  readonly iraBasisByOwner: ReadonlyMap<string, number>
  readonly deferredFirstRmdByApplicablePlan: Map<string, SimulatorAnnualPassDeferredFirstRmd>
  readonly seppAmortAmount: Map<string, number>
  readonly namedQcdOffsetConsumedByDonor: Map<string, number>
  readonly namedQcdOffsetHistoryUnprovable: Set<string>
  readonly rothBasis: Map<string, RothBasisState>
  readonly warnings: Set<string>
  readonly annuityContractDistributions: readonly Readonly<{
    readonly poolOwnerPersonId: string
    readonly annuityAccountId: string
    readonly producerOccurrenceKey: string
    readonly mutationOrdinal: number
    readonly grossAmountPlanDollars: number
  }>[]
  readonly initialRmdNontaxable: number
  readonly initialSeppNontaxable: number
}

export interface AnnualForcedDistributionQcdRetirementActionsCallbacks {
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly isTreatAsOwnEffective: (
    account: Readonly<TreatAsOwnAccount>,
    taxYear: number,
  ) => boolean
  readonly rmdApplicablePlanForAccount: (
    account: Readonly<Extract<Account, { type: 'traditional' }>>,
  ) => RmdApplicablePlan
  readonly startOfYearBalance: ReadonlyMap<string, number>
  readonly inheritedClassCache: ReadonlyMap<string, AnnualInheritedIraClassCacheEntry>
  readonly rmdReliefElectionFor: (
    obligationId: string,
  ) => RmdShortfallReliefElection | undefined
  readonly splitWithAssumedCharacter: (
    state: IraProRataYear,
    amount: number,
    input: Readonly<{
      ownerPersonId: string
      calculationScope:
        | 'form8606Line7Distributions'
        | 'form8606Line8NetConversions'
      occurrenceKind:
        | 'ownedIraRmd'
        | 'annuityContractDistribution'
        | 'automaticSeppDistribution'
        | 'legacyNeedBasedWithdrawal'
        | 'legacyQcd'
        | 'legacyRothConversion'
        | 'namedRothConversion'
      producerOccurrenceKey: string
      sourceAccountId: string
      mutationOrdinal: number
    }>,
  ) => {
    readonly nontaxable: number
    readonly taxable: number
    readonly next: IraProRataYear
  }
  readonly resolveAssumedCharacter: (input: Readonly<{
    ownerPersonId: string
    calculationScope:
      | 'form8606Line7Distributions'
      | 'form8606Line8NetConversions'
    occurrenceKind:
      | 'ownedIraRmd'
      | 'annuityContractDistribution'
      | 'automaticSeppDistribution'
      | 'legacyNeedBasedWithdrawal'
      | 'legacyQcd'
      | 'legacyRothConversion'
      | 'namedRothConversion'
    producerOccurrenceKey: string
    sourceAccountId: string
    mutationOrdinal: number
    grossAmountPlanDollars: number
    remainingBasisPlanDollars?: number
  }>) => { basisReturn: number; ordinaryIncome: number } | null
  readonly noteForm8606Taxable: (
    ownerPersonId: string,
    taxable: number,
    channel: 'distributions' | 'conversions' | 'annuityPayments',
  ) => void
  readonly recordAnnualRetirementRuntimeOccurrence: (
    occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  ) => void
  readonly recordAnnualRetirementRuntimeApplication: (
    application: SimulatorRetirementRuntimeApplicationWithoutOrdinal,
  ) => SimulatorRetirementRuntimeApplication
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
  readonly annualActionTaxUnit: Readonly<import('./annualOrdinaryWithdrawalBoundary.js').AnnualOrdinaryWithdrawalTaxUnit> | null
  readonly linkedGroupRelease: Readonly<AnnualConversionLinkedWithdrawalRelease>
  readonly annualLiabilityBaseline:
    Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
}

export interface AnnualForcedDistributionQcdRetirementActionsCapture {
  seppByAccountId: Map<string, { ownerPersonId: string | null; take: number }>
  rmdNontaxableByOwner: Map<string, number>
  seppNontaxableByAccountId: Map<string, number>
  qcdExclusionFromRmdByOwner: Map<string, number>
  qcdExclusionBeyondRmdByOwner: Map<string, number>
  qcdOrdinaryBeyondRmdByOwner: Map<string, number>
  qcdBeyondRmdCharacterByOccurrence: {
    ownerId: string
    sourceAccountId: string
    exclusion: number
    ordinary: number
  }[]
  qcdOrdinaryFromRmdByOwner: Map<string, number>
  qcdBasisFromRmdByOwner: Map<string, number>
  annuityBasisReturnByAccountId: Map<string, number>
}

export interface AnnualForcedDistributionQcdRetirementActionsInput {
  readonly facts: AnnualForcedDistributionQcdRetirementActionsFacts
  readonly ledger: AnnualForcedDistributionQcdRetirementActionsLedger
  readonly callbacks: AnnualForcedDistributionQcdRetirementActionsCallbacks
  readonly capture: AnnualForcedDistributionQcdRetirementActionsCapture | null
}

export interface AnnualForcedDistributionQcdRetirementActionsResult {
  readonly rmdTotal: number
  readonly rmdNontaxable: number
  readonly ownedIraRmdTotal: number
  readonly seppTotal: number
  readonly seppNontaxable: number
  readonly inheritedTotal: number
  readonly inheritedOrdinaryIncome: number
  readonly inheritedRothForced: number
  readonly inheritedYearEvidenceDraft: InheritedAccountYearEvidence[]
  readonly rmdShortfallObligations: RmdShortfallObligation[]
  readonly rmdShortfallExciseResults: RmdShortfallExciseResult[]
  readonly rmdShortfallExciseTax: number
  readonly iraRmdRequiredByOwner: ReadonlyMap<string, number>
  readonly iraRmdUnsatisfiedByOwner: ReadonlyMap<string, number>
  readonly qcd: number
  readonly qcdIncomeOffset: number
  readonly qcdNonQualifiedOrdinaryIncome: number
  readonly qcdFromRmd: number
  readonly namedQcdExecuted: number
  readonly namedQcdRmdSatisfied: number
  readonly namedQcdIncomeOffset: number
  readonly annuityPaymentNontaxable: number
  readonly retirementActionExecution:
    AnnualOrdinaryWithdrawalBoundaryResult['execution'] | undefined
  readonly retirementActionCash: number
  readonly retirementActionEquityCompensation: number
  readonly retirementActionProceeds: number
  readonly retirementActionTaxableProceeds: number
  readonly retirementActionCapitalGainOrLoss: number
  readonly retirementActionOrdinaryIncome: number
  readonly namedRothConversionExecuted: number
  readonly namedRothConversionNontaxable: number
  readonly rothConversionActionExecution: ExecuteRothConversionsResult | undefined
  readonly effectiveLinkedWithdrawalGroups:
    ReturnType<typeof annualRothConversionExecutionInput>['effectiveLinkedWithdrawalGroups']
  readonly legacyQcdCharacterizations: readonly Readonly<{
    readonly producerOccurrenceKey: string
    readonly ownerPersonId: string
    readonly grossAmountPlanDollars: number
    readonly nonQualifiedLine7GrossPlanDollars: number
  }>[]
  readonly qcdActionExecution: ExecuteAnnualQcdsResult | undefined
  readonly currentYearConversionActions: readonly Readonly<Plan['strategies']['retirementActions'][number]>[]
  readonly mixedKindScheduleBlocked: boolean
  readonly linkedGroupAssessmentRequests:
    ReturnType<typeof annualRetirementActionPreflight>['linkedGroupAssessmentRequests']
  readonly observedLinkedWithdrawalGroups:
    ReturnType<typeof annualRetirementActionPreflight>['observedConversionLinkedWithdrawalGroups']
  readonly conversionLinkedWithdrawalGroups:
    ReturnType<typeof annualRetirementActionPreflight>['conversionLinkedWithdrawalGroups']
  readonly isAggregatedIraThisYear: (account: Account) => boolean
  readonly rmdBalances: PhysicalBalanceState[]
  readonly rmdObligationByAccount: ReadonlyMap<string, number>
  readonly rmdTakeByAccount: ReadonlyMap<string, number>
  readonly ownedIraRmdGrossByOwner: ReadonlyMap<string, number>
  readonly qcdFromRmdByOwner: ReadonlyMap<string, number>
  readonly qcdGrossByOwner: ReadonlyMap<string, number>
  readonly qcdQualifiedFromRmdByOwner: ReadonlyMap<string, number>
  readonly deferredLegacyQcdDistributions: readonly DeferredLegacyQcdDistribution[]
  readonly qcdActionPrerequisiteResult:
    ReturnType<typeof annualQcdExecutionInput>['prerequisite']
  readonly ownedRothAssumedBasisConsequentialByOwner: Map<string, number>
  readonly employerRothAssumedBasisConsequentialByAccount: Map<string, number>
}

function immutablePlainSnapshot<T>(value: T): T {
  return structuredClone(value)
}

export function annualForcedDistributionQcdAndRetirementActions(
  input: AnnualForcedDistributionQcdRetirementActionsInput,
): AnnualForcedDistributionQcdRetirementActionsResult {
  const { facts, ledger, callbacks, capture } = input
  const {
    year,
    startYear,
    pack,
    plan,
    passPlan,
    passRetirementActions,
    primary,
    people,
    personById,
    peopleStates,
    inflFactor,
    limitGrowth,
    birthMonthByPerson,
    rmdFirstYearDeferrals,
    isStandIn,
    qcdSection219ByDonor,
    preProjectionQcdOffsetUnprovable,
  } = facts
  const {
    balances,
    annualIdKeyedBalances,
    ownersWithOmittedNondeductibleBasis,
    iraProRata,
    qcdProRataIdentityByReadSnapshot,
    iraBasisByOwner,
    deferredFirstRmdByApplicablePlan,
    seppAmortAmount,
    namedQcdOffsetConsumedByDonor,
    namedQcdOffsetHistoryUnprovable,
    rothBasis,
    warnings,
    annuityContractDistributions,
  } = ledger
  const {
    stateOf,
    isTreatAsOwnEffective,
    rmdApplicablePlanForAccount,
    startOfYearBalance,
    inheritedClassCache,
    rmdReliefElectionFor,
    splitWithAssumedCharacter,
    resolveAssumedCharacter,
    noteForm8606Taxable,
    recordAnnualRetirementRuntimeOccurrence,
    recordAnnualRetirementRuntimeApplication,
    runtimeOccurrenceKey,
    annualActionTaxUnit,
    linkedGroupRelease,
    annualLiabilityBaseline,
  } = callbacks
  const publishCashFlow = capture !== null
  const seppByAccountId = capture?.seppByAccountId ?? null
  const rmdNontaxableByOwner = capture?.rmdNontaxableByOwner ?? null
  const seppNontaxableByAccountId = capture?.seppNontaxableByAccountId ?? null
  const qcdExclusionFromRmdByOwner = capture?.qcdExclusionFromRmdByOwner ?? null
  const qcdExclusionBeyondRmdByOwner = capture?.qcdExclusionBeyondRmdByOwner ?? null
  const qcdOrdinaryBeyondRmdByOwner = capture?.qcdOrdinaryBeyondRmdByOwner ?? null
  const qcdBeyondRmdCharacterByOccurrence = capture?.qcdBeyondRmdCharacterByOccurrence ?? null
  const qcdOrdinaryFromRmdByOwner = capture?.qcdOrdinaryFromRmdByOwner ?? null
  const qcdBasisFromRmdByOwner = capture?.qcdBasisFromRmdByOwner ?? null
  const annuityBasisReturnByAccountId = capture?.annuityBasisReturnByAccountId ?? null
  let rmdNontaxable = ledger.initialRmdNontaxable
  let seppNontaxable = ledger.initialSeppNontaxable
  const legacyQcdCharacterizations: {
    producerOccurrenceKey: string
    ownerPersonId: string
    grossAmountPlanDollars: number
    nonQualifiedLine7GrossPlanDollars: number
  }[] = []
  const rothPoolKey = (account: Extract<Account, { type: 'roth' }>): string =>
    account.kind === 'ira'
      ? `rothira:${account.ownerPersonId ?? primary.id}`
      : `roth:${account.id}`
// This year's FALLBACK Form-8606 pro-rata denominator per owner (step 5):
// the aggregated pre-distribution IRA balance — after contributions, before
// any RMD/SEPP/conversion/withdrawal depletes it. Fallback because the
// owned-non-Roth-IRA annual settlement below measures the same denominator
// at the close of the year, as §408(d)(2)(C) requires, and the characters it
// settles come back through `resolveAssumedCharacter` and supersede every
// split this opens. What is opened here is what the year keeps only when the
// settlement publishes nothing usable for it. Registered as
// `irc-408-d-2-C-projection-pro-rata-measurement-instant`.
//
// OBSERVED HERE, OPENED LATER. The fraction cannot be fixed yet, because
// IRC 408(d)(8)(D) takes the year's qualified charitable distribution out of
// the section 72 computation entirely and the gift is not sized until the
// forced distributions it may be routed out of are known. So the forced
// distributions below RECORD their Form 8606 line-7 gross instead of
// splitting it, and the 408(d)(8)(D) block immediately after the QCD block
// opens the year against the reduced denominator and commits them in the
// order they moved. Conversions and need-based withdrawals are sized after
// that point and are unaffected by the deferral.
// S2 treat-as-own year-scoped gates (projection only; conversion/contribution
// validators stay static — WS5 residual). Defined once per year so RMD
// aggregation, penalty, Form 8606 denominator, and post-growth sources agree.
// Written without `isAggregatedIra`/`followsOwnerRmds` type predicates: those
// return `account is TraditionalAccount`, so a false result wrongly excludes
// every traditional account (including post-election S2).
//
// §1.408-8(c)(3): when the treat-as-own election year equals ownerDeathYear,
// the spouse takes no owner RMD that year (owner-side aggregation begins the
// following year) but must still take the decedent's unsatisfied year-of-
// death RMD on the inherited path below.
const isAggregatedIraThisYear = (account: Account): boolean => {
  if (account.type !== 'traditional' || account.kind !== 'ira') return false
  if (account.inherited === undefined) return true
  if (!isTreatAsOwnEffective(account, year)) return false
  if (year === account.inherited.ownerDeathYear) return false
  return true
}
// ID-keyed forced-distribution, IRA-character, and optimizer evidence all
// observe one aggregate live state per compatible logical account ID. The
// selected facts come from the last physical row and ID order from the
// first, while positional phases such as contributions retain every row.
const rmdBalances = annualIdKeyedBalances
// Year-scoped omitted-basis owners: same aggregation membership the
// Form 8606 settlement uses this year (includes post-election treat-as-own).
ownersWithOmittedNondeductibleBasis.clear()
for (const { account } of balances) {
  if (!isAggregatedIraThisYear(account)) continue
  // isAggregatedIraThisYear is not a type predicate (S2 post-flip accounts
  // stay TraditionalAccount with inherited set); re-narrow for basis field.
  if (account.type !== 'traditional' || account.kind !== 'ira') continue
  const ownerPersonId = account.ownerPersonId ?? primary.id
  if (account.nondeductibleBasis === undefined) {
    ownersWithOmittedNondeductibleBasis.add(ownerPersonId)
  }
}
const followsOwnerRmdsThisYear = (account: Account): boolean => {
  if (account.type !== 'traditional') return false
  if (account.inherited === undefined) return true
  if (!isTreatAsOwnEffective(account, year)) return false
  if (year === account.inherited.ownerDeathYear) return false
  return true
}
const preDistributionAggregateIraBalance = new Map<string, number>()
for (const state of rmdBalances) {
  if (!isAggregatedIraThisYear(state.account)) continue
  const ownerId = state.account.ownerPersonId ?? primary.id
  preDistributionAggregateIraBalance.set(
    ownerId,
    (preDistributionAggregateIraBalance.get(ownerId) ?? 0) + state.balance,
  )
}
/**
 * One owned-IRA forced distribution, held back from the Form 8606 pro-rata
 * split until the year's charitable gift is known.
 *
 * Everything the split needs travels with it — the identity the exact-cent
 * settlement replay is keyed on, and the gross — so committing later
 * reproduces exactly what committing in place would have, for any gift of
 * zero.
 */
interface DeferredForcedIraDistribution {
  readonly ownerId: string
  readonly amount: number
  readonly occurrenceKind: 'ownedIraRmd' | 'automaticSeppDistribution'
  readonly producerOccurrenceKey: string
  readonly sourceAccountId: string
  readonly mutationOrdinal: number
}
const deferredRmdDistributions: DeferredForcedIraDistribution[] = []
const deferredSeppDistributions: DeferredForcedIraDistribution[] = []
/**
 * One beyond-requirement charitable draw, held back for the same reason and
 * carrying the same identity.
 *
 * Its own kind, because what is deferred about it is the opposite question.
 * A forced distribution is deferred to learn how much of it LEFT section 72
 * as a gift; this draw is deferred to learn how much of it never became one.
 * IRC 408(d)(8)(B)'s closing sentence treats a distribution as a qualified
 * charitable distribution "only to the extent that the distribution would be
 * includible in gross income", and (D) caps that at the owner's aggregate
 * includible amount, so a gift past the cap is an ordinary distribution: it
 * belongs on Form 8606 line 7, in the line-9 denominator, and it recovers
 * basis pro rata.
 */
interface DeferredLegacyQcdDistribution {
  readonly ownerId: string
  readonly amount: number
  readonly producerOccurrenceKey: string
  readonly sourceAccountId: string
  readonly mutationOrdinal: number
}
const deferredLegacyQcdDistributions: DeferredLegacyQcdDistribution[] = []
/**
 * Per-occurrence characterization of the moving half of the gift, published
 * with the year so the replay never has to re-derive it.
 *
 * The routed half rides the nonmoving overlay because it moves no dollars of
 * its own and has no occurrence to ride. This half does have one, so the
 * split travels on it and the replay reads rather than reconstructs — which
 * is what keeps the two arms' Form 8606 line-7 grosses identical to the cent
 * instead of merely convergent.
 */
/** Owned-IRA required-distribution gross by owner, for gift attribution. */
const ownedIraRmdGrossByOwner = new Map<string, number>()
/**
 * The same pre-distribution observation, kept per account and for every
 * owner rather than only the ones carrying basis.
 *
 * A named QCD's exclusion is capped by its donor's otherwise-taxable pool,
 * and this measure is invariant ACROSS THE YEAR'S DEBITS: the ledger credits
 * growth after distributions, so every later debit moves a dollar out of the
 * balance and into the annual line it belongs to, leaving
 * `balance + distributions` unchanged. That is what makes measuring here
 * safe against the ordering of the distributions, and here is the only point
 * at which it is available -- the gift settles before the conversions and
 * withdrawals that finish consuming the pool.
 *
 * IT IS NOT INVARIANT ACROSS THE GROWTH CREDIT, and an earlier version of
 * this note overreached by saying it was "the same number the year end would
 * produce". `balance + distributions` is year-end-BEFORE-growth plus
 * distributions. Form 8606 line 9 is line 6 plus distributions, and line 6
 * is the December 31 value after the year's return on the retained balance
 * -- the instant §408(d)(2)(C) fixes the §72 contract value at. The two
 * differ by that growth. Registered as
 * `irc-408-d-2-C-projection-pro-rata-measurement-instant`; it is a
 * pre-existing departure of THIS LEDGER'S pro-rata denominator, not of the
 * engine's -- the owned-non-Roth-IRA annual settlement measures at the
 * close of the year and supersedes what is computed here wherever it
 * publishes -- and not of this pool measure's use as a 408(d)(8)(D)
 * ceiling. It is not corrected here.
 */
const preDistributionOwnedIraBalance = new Map<string, number>()
for (const state of rmdBalances) {
  if (!isAggregatedIraThisYear(state.account)) continue
  preDistributionOwnedIraBalance.set(state.account.id, state.balance)
}
// --- RMDs: forced traditional distributions (SECURE 2.0) ---------------
// Treas. Reg. 1.408-8(e)(1)(i) requires that "the required minimum
// distribution must be calculated separately for each IRA and the sum of
// those separately calculated required minimum distributions may be
// distributed from any one or more of the IRAs". Flooring each account at
// its own balance and moving on drops the difference rather than moving
// it, and the difference is reachable: the rebalance, annuity-purchase and
// TIPS-ladder passes all run before this block and can empty an account
// whose RMD base was already fixed at the prior Dec 31 balance. So the
// annualOwnerRmdPlan decides the amounts in two steps — each logical
// account's separately calculated share, then the owner's unmet remainder
// swept across their other IRAs. The caller executes only the settled
// takes, once per logical ID; executing while planning would record two
// occurrences against one account under the same key.
//
// The sweep is IRA-only and owner-only. Under (e)(2)(i) "only amounts in
// IRAs that an individual holds as the IRA owner are aggregated", which
// excludes an inherited IRA and a spouse's IRA alike, and an employer plan
// is outside section 408 entirely, so it must still distribute its own
// amount and can neither absorb nor supply a shortfall. `isAggregatedIra`
// already draws exactly that line for the Form 8606 pro-rata rule.
//
// S2 treat-as-own: from treatAsOwnElectionYear the spouse's account joins
// this owner aggregation (Treas. Reg. §1.408-8(c)(1)); before that year it
// stays on the inherited schedule below. Contribution/conversion validators
// stay static (WS5 residual). Helpers `isAggregatedIraThisYear` /
// `followsOwnerRmdsThisYear` are defined just above the pre-distribution
// Form 8606 denominator so every owner-side gate in the year agrees.
//
// Satisfying the sum here is also what keeps the Roth conversion pass that
// follows lawful: 1.408A-4 A-6(b) bars converting "to the extent that the
// required minimum distribution for the traditional IRA for the year has
// not been distributed", and after the sweep an owner's IRA RMD can only
// remain unsatisfied when every one of their IRAs is empty — leaving
// nothing for that pass to convert.
let rmdTotal = 0
/**
 * The owned-IRA share of `rmdTotal`. A QCD may only come out of an
 * individual retirement plan (408(d)(8)(B)), so employer-plan RMD dollars
 * -- which `rmdTotal` also carries -- can never back one, and the QCD
 * routing below caps against this rather than the whole forced total.
 */
let ownedIraRmdTotal = 0
const ownerRmdPlan = annualOwnerRmdPlan({
  balances: rmdBalances,
  startOfYearBalance,
  people,
  personById,
  stateOf,
  primaryPersonId: primary.id,
  followsOwnerRmdsThisYear,
  applicablePlanForAccount: rmdApplicablePlanForAccount,
  deferredFirstRmdByApplicablePlan,
  firstYearDeferrals: rmdFirstYearDeferrals,
  pack,
  year,
})
for (const operation of ownerRmdPlan.deferredFirstRmdOperations) {
  if (operation.kind === 'delete') {
    deferredFirstRmdByApplicablePlan.delete(operation.applicablePlanKey)
  } else {
    deferredFirstRmdByApplicablePlan.set(
      operation.applicablePlanKey,
      operation.value,
    )
  }
}
const {
  rmdTakeByAccount: plannedRmdTakeByAccount,
  rmdObligationByAccount,
  iraRmdRequiredByOwner,
  iraRmdUnsatisfiedByOwner,
  rmdShortfallObligations,
} = ownerRmdPlan
const rmdTakeByAccount = new Map(
  [...plannedRmdTakeByAccount].map(([accountId, take]) => [accountId, Number(take)]),
)
for (const state of rmdBalances) {
  // Only traditional accounts were ever entered above; the guard is here
  // so the account narrows for `kind` rather than being asserted.
  if (state.account.type !== 'traditional') continue
  const take = rmdTakeByAccount.get(state.account.id) ?? 0
  // A draw the exact-cent ledger records as zero is not a small
  // distribution, it is no distribution: a fraction of a cent is not
  // transferable in currency, and the runtime journal -- which must be able
  // to explain every movement -- admits no occurrence for a gross that
  // rounds to nothing. So the draw is skipped whole: no balance change, no
  // occurrence, no income, and nothing added to `rmdTotal`, which is what
  // the year publishes as its required distribution.
  //
  // The remainder is DISCHARGED here, not left unsatisfied, and that is the
  // half with teeth. `iraRmdUnsatisfiedByOwner` is settled above from
  // `rmd - take` and the sweep, so a quantum skipped here never reaches it
  // -- and it must not, because Treas. Reg. 1.408-8(e)(1)(i) shortfall is
  // read downstream (the conversion executor's 1.408A-4 A-6(b) reserve, and
  // the named gift's RMD coordination) as proof that every one of the
  // owner's IRAs was exhausted. A residue too small to move is not that
  // proof, and reporting it as a shortfall would block lawful conversions
  // and gifts for as long as the residue survived, which is forever. What
  // is genuinely undistributed is a knowable sub-cent-per-account-per-year
  // deviation from the computed requirement and nothing more.
  if (take <= 0 || planDollarsMoveNoLedgerCent(take)) continue
  const ownerId = state.account.ownerPersonId ?? primary.id
  const sourceBalanceBefore = state.balance
  state.balance -= take
  const kind = state.account.kind === 'ira' ? 'ownedIraRmd' as const : 'employerPlanRmd' as const
  const producerOccurrenceKey = runtimeOccurrenceKey(kind, state.account.id)
  recordAnnualRetirementRuntimeOccurrence({
    producerOccurrenceKey,
    kind,
    grossAmountPlanDollars: take,
    ownerPersonId: state.account.ownerPersonId,
    sourceAccountId: state.account.id,
    executionDate: null,
    executionSequence: null,
    movementAuthorityId: null,
  })
  let ownedIraApplication:
    SimulatorRetirementRuntimeApplication | null = null
  if (isAggregatedIraThisYear(state.account)) {
    ownedIraApplication = recordAnnualRetirementRuntimeApplication({
      applicationKind: 'debit',
      producerOccurrenceKey,
      simulatorPhase: 'ownerRmdDistribution',
      ownerPersonId: state.account.ownerPersonId,
      sourceAccountId: state.account.id,
      sourceBalanceBeforePlanDollars: sourceBalanceBefore,
      appliedAmountPlanDollars: take,
      sourceBalanceAfterPlanDollars: state.balance,
    })
  }
  rmdTotal += take
  if (isAggregatedIraThisYear(state.account)) {
    ownedIraRmdTotal += take
    ownedIraRmdGrossByOwner.set(
      ownerId,
      (ownedIraRmdGrossByOwner.get(ownerId) ?? 0) + take,
    )
  }
  // Pro-rata return of basis on IRA RMDs (step 5), RECORDED here and
  // committed after the QCD block: 408(d)(8)(D) deems whatever share of this
  // requirement is routed to charity to consist of includible dollars, and
  // that share is not known until the gift is sized.
  if (
    state.account.kind === 'ira' &&
    ownedIraApplication?.applicationKind === 'debit'
  ) {
    deferredRmdDistributions.push({
      ownerId,
      amount: take,
      occurrenceKind: 'ownedIraRmd',
      producerOccurrenceKey,
      sourceAccountId: state.account.id,
      mutationOrdinal: ownedIraApplication.mutationOrdinal,
    })
  }
}

// --- 72(t) SEPP: forced penalty-free early distributions (roadmap V8) ----
// A substantially-equal periodic payment is taken like an RMD — outside the
// need-based withdrawal flow, so it never attracts the early-withdrawal
// penalty — and is taxable ordinary income that also supplies spending cash.
const seppPlan = annualSeppDistributions({
  balances: rmdBalances,
  year,
  primaryPersonId: primary.id,
  resolveOwnerState: stateOf,
  resolveOwnerRetirementAge: (ownerPersonId) =>
    personById.get(ownerPersonId)!.retirementAge,
  startOfYearBalance,
  amortizationAmountByAccountId: seppAmortAmount,
  pack,
})
const seppTotal = seppPlan.total
for (const operation of seppPlan.operations) {
  if (operation.kind === 'amortizationCacheWrite') {
    seppAmortAmount.set(operation.accountId, operation.amount)
    continue
  }

  const state = rmdBalances[operation.balanceIndex]!
  state.balance = operation.sourceBalanceAfter
  const kind = 'automaticSeppDistribution' as const
  const producerOccurrenceKey = runtimeOccurrenceKey(kind, operation.accountId)
  recordAnnualRetirementRuntimeOccurrence({
    producerOccurrenceKey,
    kind,
    grossAmountPlanDollars: operation.take,
    ownerPersonId: operation.ownerPersonId,
    sourceAccountId: operation.accountId,
    executionDate: null,
    executionSequence: null,
    movementAuthorityId: null,
  })
  let ownedIraApplication:
    SimulatorRetirementRuntimeApplication | null = null
  if (operation.recordsOwnedIraApplication) {
    ownedIraApplication = recordAnnualRetirementRuntimeApplication({
      applicationKind: 'debit',
      producerOccurrenceKey,
      simulatorPhase: 'automaticSeppDistribution',
      ownerPersonId: operation.ownerPersonId,
      sourceAccountId: operation.accountId,
      sourceBalanceBeforePlanDollars: operation.sourceBalanceBefore,
      appliedAmountPlanDollars: operation.take,
      sourceBalanceAfterPlanDollars: operation.sourceBalanceAfter,
    })
  }
  seppByAccountId?.set(operation.accountId, {
    ownerPersonId: operation.ownerPersonId,
    take: operation.take,
  })
  if (
    operation.defersIraCharacter &&
    ownedIraApplication?.applicationKind === 'debit'
  ) {
    deferredSeppDistributions.push({
      ownerId: operation.characterOwnerPersonId,
      amount: operation.take,
      occurrenceKind: kind,
      producerOccurrenceKey,
      sourceAccountId: operation.accountId,
      mutationOrdinal: ownedIraApplication.mutationOrdinal,
    })
  }
}

// --- Inherited IRA: exact-ledger execution (WS4) ------------------------
// Classify and plan the whole logical-ID phase before touching any live
// balance. This keeps compatible duplicate physical rows behind one
// aggregate distribution, evidence row, runtime occurrence, and §4974
// application while the logical ledger commits the debit pro rata.
const inheritedPlan = immutablePlainSnapshot(
  annualInheritedIraDistributions({
    year,
    startYear,
    pack,
    primaryPersonId: primary.id,
    balances: rmdBalances,
    startOfYearBalance,
    classCache: inheritedClassCache,
    beneficiaryState: (personId) => stateOf(personId),
  }),
)
const inheritedOperations = inheritedPlan.rows.flatMap((row) =>
  row.distribution === null ? [] : [row.distribution])
const inheritedTotal = inheritedPlan.totals.inherited
const inheritedOrdinaryIncome = inheritedPlan.totals.ordinaryIncome
const inheritedRothForced = inheritedPlan.totals.rothForced
const inheritedYearEvidenceDraft: InheritedAccountYearEvidence[] =
  inheritedPlan.rows.map((row) => row.evidence)
const inheritedRmdShortfallObligations =
  inheritedPlan.rmdShortfallObligations
const inheritedOperationIndexes = new Set<number>()
for (const operation of inheritedOperations) {
  const state = rmdBalances[operation.balanceIndex]
  if (state === undefined || state.account.id !== operation.accountId) {
    throw new Error(
      'Inherited-IRA distribution operation lost its balance position',
    )
  }
  if (
    inheritedOperationIndexes.has(operation.balanceIndex) ||
    (state.account.type !== 'traditional' &&
      state.account.type !== 'roth') ||
    state.account.inherited === undefined ||
    state.account.ownerPersonId !== operation.ownerPersonId ||
    state.balance !== operation.sourceBalanceBefore ||
    !Number.isFinite(operation.sourceBalanceAfter) ||
    operation.sourceBalanceAfter < 0 ||
    !Number.isFinite(operation.executed) ||
    operation.executed <= 0 ||
    operation.executed > operation.sourceBalanceBefore ||
    planDollarsMoveNoLedgerCent(operation.executed) ||
    operation.sourceBalanceBefore - operation.executed !==
      operation.sourceBalanceAfter
  ) {
    throw new Error(
      `invalid annual inherited-IRA distribution operation for account id "${operation.accountId}"`,
    )
  }
  inheritedOperationIndexes.add(operation.balanceIndex)
}
for (const operation of inheritedOperations) {
  const state = rmdBalances[operation.balanceIndex]!
  state.balance = operation.sourceBalanceAfter
  const kind = 'inheritedIraRmd' as const
  const producerOccurrenceKey = runtimeOccurrenceKey(kind, operation.accountId)
  recordAnnualRetirementRuntimeOccurrence({
    producerOccurrenceKey,
    kind,
    grossAmountPlanDollars: operation.executed,
    ownerPersonId: operation.ownerPersonId,
    sourceAccountId: operation.accountId,
    executionDate: null,
    executionSequence: null,
    movementAuthorityId: null,
  })
}
rmdShortfallObligations.push(...inheritedRmdShortfallObligations)
const rmdShortfallExciseResults: RmdShortfallExciseResult[] =
  rmdShortfallObligations.map((obligation) =>
    computeRmdShortfallExcise(
      obligation,
      rmdReliefElectionFor(obligation.obligationId),
    ))
const rmdShortfallExciseTax = rmdShortfallExciseResults.reduce(
  (total, result) => total + result.tax,
  0,
)
if (rmdShortfallExciseTax > 0) {
  warnings.add(
    'An IRC §4974 excise tax was charged on a required-minimum-distribution shortfall.',
  )
}

// QCD: charitable dollars distributed from an IRA and excluded from income.
//
// IRC 408(d)(8) turns on the donor having attained age 70½ and does not
// require an RMD, so this is not "dollars routed out of the RMD". Gating on
// rmdTotal > 0 removed the entire pre-RMD window -- ages 70½ to the
// applicable age, which is 75 for the 1960-and-later cohort, about four and
// a half years -- and that window is where a QCD is most valuable, because
// there is no RMD to carry the gift out of income.
//
// Age 70½ is resolved from the birth month rather than approximated: a
// person born in months 1-6 reaches 70½ inside the year they attain 70.
// Within-year timing is not modelled, so a gift dated before the
// half-birthday counts; that is the annual-granularity convention.
let qcd: number
// Income reduction. Only the RMD entered income, so this is the routed
// owned-IRA GROSS that qualified under 408(d)(8)(D) -- never the part taken
// beyond the RMD, which never entered income at all and would be a phantom
// deduction, and never a share of the routed dollars, because (D) deems the
// gift to consist of includible dollars and it therefore returns no basis.
// Its ceiling is the statute's aggregate measure, settled per owner below.
let qcdIncomeOffset = 0
/**
 * Charitable dollars that could NOT be a QCD, because the gift ran past the
 * owner's whole 408(d)(8)(D) aggregate includible amount, and that were
 * taken beyond the required distribution rather than out of it.
 *
 * They are an ordinary distribution: they belong on Form 8606 line 7, they
 * recover basis pro-rata, and their taxable share is income the required
 * distribution never booked for them. The from-RMD half of the same excess
 * needs no term of its own -- those dollars are already inside `rmdTotal`,
 * and leaving them out of `qcdIncomeOffset` is the whole of their treatment.
 */
let qcdNonQualifiedOrdinaryIncome = 0
// A named QCD request is authoritative for the year, exactly as a named
// conversion is at the aggregate conversion gate below: "an aggregate
// fallback would debit different sources and hide that result". Without
// this the two arms both run and the household gives twice — once from the
// scalar and once from the action. Nothing in the suite combined the two
// arms before this guard, which is why the defect could have shipped
// unnoticed; simulate.qcdNamedSuppression.test.ts now does, and fails
// without the condition below.
//
// Counted directly from this pass's action array rather than waiting for
// the annual retirement-action preflight boundary below. Moving this block
// down to reuse the preflight result would reorder the balance mutations
// that the owned-IRA runtime source series validates in mutation order,
// which is a much larger change than the guard is worth.
//
// This suppressed nothing when it was written — the QCD executor published
// a named request's prerequisite and nothing else — and it is load-bearing
// now: PR #213 made a committed named QCD debit its source below, so
// without this gate the scalar arm would give a second time from the same
// IRAs in the same year.
const hasNamedQcdRequest = passRetirementActions.some(
  (request) => request.year === year && request.kind === 'qcd',
)
/**
 * The scalar gift, charged to the owners whose IRAs actually funded it.
 *
 * 408(d)(8)(D) measures the gift against ONE owner's individual retirement
 * plans treated as one contract, and every owner has their own Form 8606
 * denominator, so an unattributed household scalar cannot be measured at
 * all. The from-RMD half is attributed in proportion to each owner's share
 * of the owned-IRA required distribution the gift is capped against; the
 * beyond-RMD half is attributed exactly, at the account it drains.
 */
const qcdGiftPlan = annualLegacyQcdGiftPlan({
  qcdAnnual: plan.strategies.qcdAnnual,
  inflFactor,
  perDonorLimit: pack.rmd.qcdAnnualLimit * limitGrowth,
  hasNamedQcdRequest,
  people: peopleStates.map((state) => ({
    personId: state.personId,
    alive: state.alive,
    ageAttained: state.ageAttained,
    birthMonth: birthMonthByPerson.get(state.personId) ?? 1,
  })),
  ownedIraRmdTotal,
  ownedIraRmdGrossByOwner,
  balances: rmdBalances.map((state, balanceIndex) => ({
    balanceIndex,
    accountId: state.account.id,
    ownerId: state.account.ownerPersonId ?? primary.id,
    isAggregatedIra: isAggregatedIra(state.account),
    balance: state.balance,
  })),
})
qcd = qcdGiftPlan.qcd
// Gross dollars routed out of the owned-IRA RMD. That RMD already counted
// these as a cash inflow, so this is what cash must give back. The cap is
// the owned-IRA share of the forced total, not the whole of it:
// 408(d)(8)(B) reaches only a distribution from an individual retirement
// plan, so an employer-plan RMD cannot carry a gift out of income and a
// donor with no IRA RMD at all has nothing here to route.
const qcdFromRmd = qcdGiftPlan.qcdFromRmd
const qcdGrossByOwner = qcdGiftPlan.qcdGrossByOwner
/** The part of each owner's gift routed out of their required distribution. */
const qcdFromRmdByOwner = qcdGiftPlan.qcdFromRmdByOwner

// Validate the complete intent sequence before its first mutation or
// runtime write. The shadow also makes repeated hostile intents validate
// sequentially without partially applying an earlier one.
const validatedQcdGiftDebitIntents: Array<{
  balanceIndex: number
  sourceAccountId: string
  ownerId: string
  runtimeOwnerPersonId: string | null
  sourceBalanceBefore: number
  sourceBalanceAfter: number
  amount: number
}> = []
const remainingQcdGiftBalanceByIndex = new Map<number, number>()
for (const intent of qcdGiftPlan.debitIntents) {
  // Read every helper-owned property exactly once. Only these normalized
  // scalars cross into apply, so a getter-backed result cannot change
  // identity or throw after an earlier intent has already committed.
  const balanceIndex = intent.balanceIndex
  const sourceAccountId = intent.sourceAccountId
  const ownerId = intent.ownerId
  const sourceBalanceBefore = intent.sourceBalanceBefore
  const amount = intent.amount
  const state = rmdBalances[balanceIndex]
  const remainingBalance = remainingQcdGiftBalanceByIndex.get(
    balanceIndex,
  ) ?? state?.balance
  if (
    state === undefined ||
    !isAggregatedIra(state.account) ||
    state.account.id !== sourceAccountId ||
    (state.account.ownerPersonId ?? primary.id) !== ownerId ||
    remainingBalance !== sourceBalanceBefore ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    planDollarsMoveNoLedgerCent(amount) ||
    remainingBalance === undefined ||
    amount > remainingBalance
  ) {
    throw new Error(
      'Legacy scalar QCD debit intent lost its live source identity',
    )
  }
  const sourceBalanceAfter = remainingBalance - amount
  remainingQcdGiftBalanceByIndex.set(
    balanceIndex,
    sourceBalanceAfter,
  )
  validatedQcdGiftDebitIntents.push({
    balanceIndex,
    sourceAccountId,
    ownerId,
    runtimeOwnerPersonId: state.account.ownerPersonId,
    sourceBalanceBefore,
    sourceBalanceAfter,
    amount,
  })
}
const qcdGiftOffsetHistoryUnprovableDonorIds = [
  ...qcdGiftPlan.offsetHistoryUnprovableDonorIds,
]
const qcdGiftPersonIds = new Set(
  peopleStates.map((person) => person.personId),
)
if (qcdGiftOffsetHistoryUnprovableDonorIds.some((donorId) =>
  !qcdGiftPersonIds.has(donorId))) {
  throw new Error(
    'Legacy scalar QCD history write lost its donor identity',
  )
}

for (const debit of validatedQcdGiftDebitIntents) {
  const state = rmdBalances[debit.balanceIndex]!
  // This logical setter commits the exact aggregate closing balance pro
  // rata across every compatible physical row for the account ID.
  state.balance = debit.sourceBalanceAfter
  const kind = 'legacyQcd' as const
  const producerOccurrenceKey = runtimeOccurrenceKey(
    kind,
    debit.sourceAccountId,
  )
  recordAnnualRetirementRuntimeOccurrence({
    producerOccurrenceKey,
    kind,
    grossAmountPlanDollars: debit.amount,
    ownerPersonId: debit.runtimeOwnerPersonId,
    sourceAccountId: debit.sourceAccountId,
    executionDate: null,
    executionSequence: null,
    movementAuthorityId: null,
  })
  const giftApplication = recordAnnualRetirementRuntimeApplication({
    applicationKind: 'debit',
    producerOccurrenceKey,
    simulatorPhase: 'legacyQcdDistribution',
    ownerPersonId: debit.runtimeOwnerPersonId,
    sourceBalanceBeforePlanDollars: debit.sourceBalanceBefore,
    sourceAccountId: debit.sourceAccountId,
    appliedAmountPlanDollars: debit.amount,
    sourceBalanceAfterPlanDollars: debit.sourceBalanceAfter,
  })
  if (giftApplication.applicationKind === 'debit') {
    deferredLegacyQcdDistributions.push({
      ownerId: debit.ownerId,
      amount: debit.amount,
      producerOccurrenceKey,
      sourceAccountId: debit.sourceAccountId,
      mutationOrdinal: giftApplication.mutationOrdinal,
    })
  }
}
for (const donorId of qcdGiftOffsetHistoryUnprovableDonorIds) {
  namedQcdOffsetHistoryUnprovable.add(donorId)
}

// --- IRC 408(d)(8)(D): the gift first, then this year's section 72 -------
//
// "Notwithstanding section 72, in determining the extent to which a
// distribution is a qualified charitable distribution, the entire amount of
// the distribution shall be treated as includible in gross income ... to the
// extent that such amount does not exceed the aggregate amount which would
// have been so includible if all amounts in all individual retirement plans
// of the individual were distributed during such taxable year and all such
// plans were treated as 1 contract ... Proper adjustments shall be made in
// applying section 72 to other distributions in such taxable year".
//
// Three things follow, and this block is all three:
//
// 1. THE CEILING is the owner's whole aggregate includible amount --
//    pre-distribution aggregated owned-IRA balance minus aggregate basis --
//    and not the taxable share of this year's requirement. A required
//    distribution is a small fraction of a balance, so the statutory ceiling
//    is normally far higher and simply does not bind.
// 2. THE GIFT RETURNS NO BASIS, because (D) deems it to consist of
//    includible dollars. So `qcdIncomeOffset` is the routed GROSS.
// 3. THE PROPER ADJUSTMENT for the year's other distributions is the one the
//    Form 8606 line-7 instructions spell out -- "Don't include any of the
//    following on line 7 ... Qualified charitable distributions (QCDs)" --
//    so the gift leaves the line-7 numerator AND the annual denominator,
//    while the whole of the year's basis survives as the numerator of the
//    ratio. Line 6 is already net of the gift and line 7 never gains it, so
//    the denominator is the pre-distribution pool less the qualified gift.
//
// This is the same arithmetic the named arm settles in exact cents --
// `annualQcdTaxCharacterPostPass.ts`, registered as
// `irc-408-d-8-D-qcd-taxable-first`, where the residual denominator is
// likewise `taxablePoolGrossBalanceBefore − qualifiedCharitableDistribution`
// against an unreduced basis numerator. Reaching it here required deferring
// the forced distributions' splits past the gift, not a second derivation.
//
// A gift that runs past the aggregate includible amount is NOT a QCD in the
// excess, under (D) read with (B)'s closing sentence ("A distribution shall
// be treated as a qualified charitable distribution only to the extent that
// the distribution would be includible in gross income"). The excess is an
// ordinary distribution: it stays in the denominator, stays on line 7, and
// recovers basis. It is charged against the from-RMD half of the gift first,
// where those dollars are already inside `rmdTotal` and inside the line-7
// gross, so no term has to be invented for them; only what is left over is
// carried on `qcdNonQualifiedOrdinaryIncome` below.
//
// (d)(8)(A)'s own limit is separate and applies earlier: `requested` is
// already capped at the year's sourced annual limit, so the exclusion can
// never exceed it and no second clamp is needed here. The (A) second
// sentence then reduces that exclusion, but not below zero, by the excess
// of deductible §219 contributions for years ending on or after 70½ over
// reductions already taken — the same lifetime running total the named
// arm settles in `applyIrc408d8AContributionOffset`. Leftover is ordinary
// income and does not lower MAGI; a §170 itemized deduction for that
// leftover is not booked here.
const qcdQualifiedFromRmdByOwner = new Map<string, number>()
const qcdNonQualifiedBeyondRmdByOwner = new Map<string, number>()
const expectedQcdOwnerIds = new Set<string>(qcdGrossByOwner.keys())
for (const [ownerId, basis] of iraBasisByOwner) {
  if (basis > 0) expectedQcdOwnerIds.add(ownerId)
}
const qcdOwnerCharacterPlan =
  materializeAnnualLegacyQcdOwnerCharacterPlanResult(
    annualLegacyQcdOwnerCharacterPlan({
      qcdGrossByOwner,
      qcdFromRmdByOwner,
      iraBasisByOwner,
      preDistributionAggregateIraBalance,
      qcdSection219ByDonor,
      qcdOffsetConsumedByDonor: namedQcdOffsetConsumedByDonor,
      preProjectionQcdOffsetUnprovable,
      publishCashFlow,
    }),
    [...expectedQcdOwnerIds],
  )
for (const row of qcdOwnerCharacterPlan.rows) {
  if (row.contradictoryOffsetLedger) {
    const ownerName = personById.get(row.ownerId)?.name ?? row.ownerId
    warnings.add(
      `${ownerName}’s recurring QCD was treated as ordinary income because its recorded post-70½ deductible-contribution offset exceeds the deductible-contribution total. Review the contribution and QCD history.`,
    )
  }
  if (row.qcdOffsetConsumedWrite !== null) {
    namedQcdOffsetConsumedByDonor.set(
      row.ownerId,
      row.qcdOffsetConsumedWrite,
    )
  }
  qcdQualifiedFromRmdByOwner.set(row.ownerId, row.qualifiedFromRmd)
  qcdNonQualifiedBeyondRmdByOwner.set(
    row.ownerId,
    row.nonQualifiedBeyondRmd,
  )
  qcdIncomeOffset += row.incomeOffsetDelta
  if (row.nonQualifiedOrdinaryIncomeDelta > 0) {
    qcdNonQualifiedOrdinaryIncome +=
      row.nonQualifiedOrdinaryIncomeDelta
  }
  for (const write of row.cashFlowWrites) {
    switch (write.target) {
      case 'exclusionFromRmd':
        qcdExclusionFromRmdByOwner!.set(write.ownerId, write.value)
        break
      case 'ordinaryFromRmd':
        qcdOrdinaryFromRmdByOwner!.set(write.ownerId, write.value)
        break
      case 'exclusionBeyondRmd':
        qcdExclusionBeyondRmdByOwner!.set(write.ownerId, write.value)
        break
      case 'ordinaryBeyondRmd':
        qcdOrdinaryBeyondRmdByOwner!.set(write.ownerId, write.value)
        break
      default: {
        const exhaustive: never = write.target
        throw new Error(`Unknown legacy QCD cash-flow target: ${String(exhaustive)}`)
      }
    }
  }
  if (row.iraProRataWrite !== null) {
    const readSnapshot = row.iraProRataReadSnapshot!
    iraProRata.set(row.ownerId, readSnapshot)
    qcdProRataIdentityByReadSnapshot.set(
      readSnapshot,
      row.iraProRataWrite,
    )
  }
}
/**
 * Commit the forced distributions held back above, in the order they moved,
 * carving each owner's qualified gift out of the line-7 gross first.
 *
 * The carve is greedy across an owner's entries rather than spread over
 * them, and the owner's TOTAL basis recovery is the same either way: the
 * year's fraction is owner-wide and `splitIraDistribution` caps every draw
 * at the basis that is left.
 *
 * A CARVE YEAR SETTLES, and the carve is half of what makes it settle. This
 * note said the opposite until 2026-08-07: a carve existed only where the
 * gift was routed out of a required distribution, that was exactly the shape
 * `ownedNonRothIraRuntimeSourceSeries.ts` refused with `qcdStageRequired`,
 * and `assumedEffects` was empty for the whole year. The refusal is gone.
 * The nonmoving overlay now carries the per-owner attribution settled just
 * above -- the routed gross, and the qualified part of it -- and the source
 * series carves that qualified amount out of the owner's line-7 gross by
 * walking the same applications in the same mutation order this loop walks
 * its entries in.
 *
 * SO THE ORDER HERE IS LOAD-BEARING, where it used to be arbitrary. The
 * settlement matches an assumed effect only when its gross agrees to the
 * cent, so an entry whose carve the replay placed differently would find no
 * effect and fall back to the pro-rata computation -- correct, but not
 * settled. Greedy-in-mutation-order on both sides is what makes the two
 * agree; the owner's TOTAL basis recovery would be the same either way,
 * which is why the choice is free and why it has to be the same choice.
 *
 * `splitWithAssumedCharacter` is therefore what is called, and its fallback
 * is the honest one for an entry no effect describes: a settlement effect
 * computed for a whole distribution does not describe the part that went to
 * charity.
 */
/**
 * The basis share this year's annuity-contract payments recovered.
 *
 * IRC 408(d)(2)(B) treats all distributions during a taxable year as one
 * distribution, so a payment out of a contract an owned IRA bought takes
 * the same fraction of basis as every other distribution the aggregate
 * makes -- Publication 590-B says so in terms for an IRA holding both
 * deductible and nondeductible contributions. The income block already
 * added the whole payment to `ordinaryIncome`, because the year's fraction
 * is not knowable there; this takes the settled basis part back out, in
 * exactly the way `rmdNontaxable` does for a required distribution.
 *
 * IT DRAWS ON NO FALLBACK, and that is deliberate. Where the settlement
 * publishes nothing for a payment, the payment stays fully ordinary rather
 * than being split against the legacy pro-rata state. That state is opened
 * on a pre-distribution pool the contract is NOT in, so splitting against
 * it would hand the payment a share of a fraction computed as though the
 * contract did not exist -- a second approximation invented to paper over
 * the first. Fully ordinary is the registered legacy treatment; a year that
 * cannot settle keeps it and says so.
 *
 * ASKED UNDER THE POOL OWNER, which is the funding IRA's and not the
 * contract's. The settlement allocates the year's basis one owner-wide
 * aggregate at a time and publishes each effect under that owner, so a
 * lookup keyed on the contract's own `ownerPersonId` finds nothing whenever
 * a Plan names one spouse's contract against the other's IRA -- and finding
 * nothing here is silent, because the settlement has already spent the
 * basis on the allocation it published. The recovery is charged to the same
 * owner's pro-rata basis so the year's other distributions cannot recover
 * it a second time.
 */
let annuityPaymentNontaxable = 0
for (const payment of annuityContractDistributions) {
  const assumed = resolveAssumedCharacter({
    ownerPersonId: payment.poolOwnerPersonId,
    calculationScope: 'form8606Line7Distributions',
    occurrenceKind: 'annuityContractDistribution',
    producerOccurrenceKey: payment.producerOccurrenceKey,
    sourceAccountId: payment.annuityAccountId,
    mutationOrdinal: payment.mutationOrdinal,
    grossAmountPlanDollars: payment.grossAmountPlanDollars,
  })
  if (assumed === null) {
    // No settlement character: payment stays fully ordinary (registered
    // ASSUMPTION-FREE legacy). Do not publish an assumed-basis verdict —
    // the settlement never priced this payment over assumed-zero basis.
    continue
  }
  // Settlement priced the payment: ordinary share under the year's fraction
  // (assumed-zero basis → full ordinary) is the consequential channel.
  noteForm8606Taxable(
    payment.poolOwnerPersonId,
    Math.max(0, payment.grossAmountPlanDollars - assumed.basisReturn),
    'annuityPayments',
  )
  if (assumed.basisReturn <= 0) continue
  annuityPaymentNontaxable += assumed.basisReturn
  if (publishCashFlow) {
    annuityBasisReturnByAccountId!.set(
      payment.annuityAccountId,
      (annuityBasisReturnByAccountId!.get(payment.annuityAccountId) ?? 0) +
        assumed.basisReturn,
    )
  }
  const proRata = iraProRata.get(payment.poolOwnerPersonId)
  if (proRata !== undefined) {
    iraProRata.set(payment.poolOwnerPersonId, {
      basis: Math.max(0, proRata.basis - assumed.basisReturn),
      nontaxableFraction: proRata.nontaxableFraction,
    })
  }
}
const qcdNonQualifiedFromRmdRemaining = new Map<string, number>()
if (publishCashFlow) {
  for (const [ownerId, fromRmd] of qcdFromRmdByOwner) {
    if (fromRmd <= 0) continue
    const nq = Math.max(0, fromRmd - (qcdQualifiedFromRmdByOwner.get(ownerId) ?? 0))
    if (nq > 0) qcdNonQualifiedFromRmdRemaining.set(ownerId, nq)
  }
}
const commitDeferredForcedDistributions = (
  entries: readonly DeferredForcedIraDistribution[],
  carveByOwner: Map<string, number>,
  credit: (nontaxable: number) => void,
) => {
  for (const entry of entries) {
    const carve = Math.min(carveByOwner.get(entry.ownerId) ?? 0, entry.amount)
    if (carve > 0) {
      carveByOwner.set(entry.ownerId, (carveByOwner.get(entry.ownerId) ?? 0) - carve)
    }
    const line7Gross = entry.amount - carve
    const proRata = iraProRata.get(entry.ownerId)
    if (line7Gross <= 0) continue
    const nqThis = publishCashFlow && entry.occurrenceKind === 'ownedIraRmd'
      ? Math.min(qcdNonQualifiedFromRmdRemaining.get(entry.ownerId) ?? 0, line7Gross)
      : 0
    if (nqThis > 0) {
      qcdNonQualifiedFromRmdRemaining.set(
        entry.ownerId,
        (qcdNonQualifiedFromRmdRemaining.get(entry.ownerId) ?? 0) - nqThis,
      )
    }
    const nqShare = nqThis === 0 ? 0 : nqThis / line7Gross
    const snapshotFromRmdSplit = (taxable: number, nontaxable: number): void => {
      if (!publishCashFlow || entry.occurrenceKind !== 'ownedIraRmd') return
      const nqTaxable = taxable * nqShare
      const nqBasis = nontaxable * nqShare
      if (nqTaxable > 0) {
        qcdOrdinaryFromRmdByOwner!.set(
          entry.ownerId,
          (qcdOrdinaryFromRmdByOwner!.get(entry.ownerId) ?? 0) + nqTaxable,
        )
      }
      if (nqBasis > 0) {
        qcdBasisFromRmdByOwner!.set(
          entry.ownerId,
          (qcdBasisFromRmdByOwner!.get(entry.ownerId) ?? 0) + nqBasis,
        )
      }
      const netBasis = nontaxable - nqBasis
      if (netBasis > 0) {
        rmdNontaxableByOwner!.set(
          entry.ownerId,
          (rmdNontaxableByOwner!.get(entry.ownerId) ?? 0) + netBasis,
        )
      }
    }
    if (proRata === undefined) {
      // Zero aggregate basis: entire line-7 gross is ordinary income.
      noteForm8606Taxable(entry.ownerId, line7Gross, 'distributions')
      snapshotFromRmdSplit(line7Gross, 0)
      continue
    }
    const split = splitWithAssumedCharacter(proRata, line7Gross, {
      ownerPersonId: entry.ownerId,
      calculationScope: 'form8606Line7Distributions',
      occurrenceKind: entry.occurrenceKind,
      producerOccurrenceKey: entry.producerOccurrenceKey,
      sourceAccountId: entry.sourceAccountId,
      mutationOrdinal: entry.mutationOrdinal,
    })
    iraProRata.set(entry.ownerId, split.next)
    credit(split.nontaxable)
    if (publishCashFlow) {
      if (entry.occurrenceKind === 'ownedIraRmd') {
        snapshotFromRmdSplit(split.taxable, split.nontaxable)
      } else if (entry.occurrenceKind === 'automaticSeppDistribution') {
        seppNontaxableByAccountId!.set(
          entry.sourceAccountId,
          (seppNontaxableByAccountId!.get(entry.sourceAccountId) ?? 0) +
            split.nontaxable,
        )
      }
    }
  }
}
commitDeferredForcedDistributions(
  deferredRmdDistributions,
  new Map(qcdQualifiedFromRmdByOwner),
  (nontaxable) => { rmdNontaxable += nontaxable },
)
commitDeferredForcedDistributions(
  deferredSeppDistributions,
  new Map<string, number>(),
  (nontaxable) => { seppNontaxable += nontaxable },
)
// The beyond-RMD excess, last, because the gift moves after both forced
// distributions.
//
// CHARGED TO THE OCCURRENCES THAT MOVED IT, one draw at a time, rather than
// as one lump per owner. IRC 408(d)(8)(B)'s closing sentence treats a
// distribution as a qualified charitable distribution "only to the extent
// that the distribution would be includible in gross income", so the part of
// this gift past the (D) aggregate cap was never a QCD at all: it is an
// ordinary distribution belonging on Form 8606 line 7, inside the line-9
// denominator, recovering basis pro rata. The Form 8606 line-7 instructions
// exclude "Qualified charitable distributions (QCDs)" by name and nothing
// else, which is the whole of the authority for keeping the qualified part
// off the line and none at all for keeping the rest off it.
//
// A LUMP CANNOT SAY WHICH ACCOUNT'S DRAW IT WAS, and the replay needs that:
// it prices Form 8606 line by line, per occurrence. So the owner's excess is
// charged greedily across their own draws in mutation order -- the same
// convention, and the same order, the drain above created them in -- and the
// per-occurrence result is published on the year so the replay reads it
// instead of reconstructing it.
//
// ITS TAXABLE SHARE IS PROVABLY ZERO ON THIS LEDGER, and the term is here
// anyway because the proof is what makes the surrounding arithmetic safe to
// change. Any excess at all means the qualified amount took the owner's
// WHOLE aggregate includible amount, so this ledger's residual denominator
// is the basis itself, its fraction is exactly 1, and every dollar the pool
// still holds is basis. The excess could only be taxed if the forced
// distributions had already spent that basis — and they cannot have, because
// the dollars available to fund a beyond-requirement gift are what survives
// them. The proof is about THIS ledger's pre-distribution denominator and
// not about the settlement's close-of-year one, which is why the split now
// asks for the assumed character first: where the settlement priced the
// year, its figure supersedes, and it is not required to agree that the
// fraction was 1.
const legacyQcdExcessByOwner = new Map(qcdNonQualifiedBeyondRmdByOwner)
// Reporting copies taken before this walk adds Form 8606 taxable onto
// the owner ordinary map. Leftover is already there; exclusion is the
// post-offset remainder. Charged onto each draw after the statutory
// excess, in this same order, so the cash-flow transfer matches the
// ledger instead of re-deriving exclusion-first from owner totals.
const legacyQcdLeftoverRemainingForCapture = publishCashFlow
  ? new Map(qcdOrdinaryBeyondRmdByOwner)
  : null
const legacyQcdExclusionRemainingForCapture = publishCashFlow
  ? new Map(qcdExclusionBeyondRmdByOwner)
  : null
for (const entry of deferredLegacyQcdDistributions) {
  const remainingExcess = Math.max(
    0, legacyQcdExcessByOwner.get(entry.ownerId) ?? 0,
  )
  const nonQualified = Math.min(remainingExcess, entry.amount)
  legacyQcdCharacterizations.push({
    producerOccurrenceKey: entry.producerOccurrenceKey,
    ownerPersonId: entry.ownerId,
    grossAmountPlanDollars: entry.amount,
    nonQualifiedLine7GrossPlanDollars: nonQualified,
  })
  let taxableFromExcess = 0
  if (nonQualified > 0) {
    legacyQcdExcessByOwner.set(entry.ownerId, remainingExcess - nonQualified)
    const proRata = iraProRata.get(entry.ownerId)
    if (proRata === undefined) {
      noteForm8606Taxable(entry.ownerId, nonQualified, 'distributions')
      qcdNonQualifiedOrdinaryIncome += nonQualified
      if (publishCashFlow) {
        qcdOrdinaryBeyondRmdByOwner!.set(
          entry.ownerId,
          (qcdOrdinaryBeyondRmdByOwner!.get(entry.ownerId) ?? 0) + nonQualified,
        )
      }
      taxableFromExcess = nonQualified
    } else {
      const split = splitWithAssumedCharacter(proRata, nonQualified, {
        ownerPersonId: entry.ownerId,
        calculationScope: 'form8606Line7Distributions',
        occurrenceKind: 'legacyQcd',
        producerOccurrenceKey: entry.producerOccurrenceKey,
        sourceAccountId: entry.sourceAccountId,
        mutationOrdinal: entry.mutationOrdinal,
      })
      iraProRata.set(entry.ownerId, split.next)
      qcdNonQualifiedOrdinaryIncome += split.taxable
      if (publishCashFlow && split.taxable > 0) {
        qcdOrdinaryBeyondRmdByOwner!.set(
          entry.ownerId,
          (qcdOrdinaryBeyondRmdByOwner!.get(entry.ownerId) ?? 0) + split.taxable,
        )
      }
      taxableFromExcess = split.taxable
    }
  }
  if (publishCashFlow && entry.amount > 0) {
    const leftoverRemaining = Math.max(
      0, legacyQcdLeftoverRemainingForCapture!.get(entry.ownerId) ?? 0,
    )
    const afterExcess = Math.max(0, entry.amount - nonQualified)
    const leftoverTake = Math.min(leftoverRemaining, afterExcess)
    legacyQcdLeftoverRemainingForCapture!.set(
      entry.ownerId, leftoverRemaining - leftoverTake,
    )
    const exclusionRemaining = Math.max(
      0, legacyQcdExclusionRemainingForCapture!.get(entry.ownerId) ?? 0,
    )
    const exclusionTake = Math.min(
      exclusionRemaining, afterExcess - leftoverTake,
    )
    legacyQcdExclusionRemainingForCapture!.set(
      entry.ownerId, exclusionRemaining - exclusionTake,
    )
    qcdBeyondRmdCharacterByOccurrence!.push({
      ownerId: entry.ownerId,
      sourceAccountId: entry.sourceAccountId,
      exclusion: exclusionTake,
      ordinary: leftoverTake + taxableFromExcess,
    })
  }
}

// --- exact-cent identity-bearing ordinary withdrawals ------------------
// The exact-cent executor owns current-year action ordering and debits named
// sources here. Its movement remains outside the legacy withdrawal map so
// the final legacy apply loop cannot debit an action source a second time.
const retirementActionPreflight = annualRetirementActionPreflight(Object.freeze({
  taxYear: year,
  retirementActions: Object.freeze([...passRetirementActions]),
  balances: Object.freeze(annualIdKeyedBalances.map((state) =>
    Object.freeze({
      accountId: state.account.id,
      balancePlanDollars: state.balance,
    }))),
  annualLiabilityBaseline:
    annualLiabilityBaseline === null ? 'unavailable' : 'read',
  linkedGroupRelease,
}))
const currentYearOrdinaryActions = retirementActionPreflight.ordinaryActions
const currentYearConversionActions =
  retirementActionPreflight.conversionActions
const currentYearQcdExecutionActions =
  retirementActionPreflight.qcdExecutionActions
const currentYearOrdinaryExecutionActions =
  retirementActionPreflight.ordinaryExecutionActions
const mixedKindScheduleBlocked =
  retirementActionPreflight.mixedKindScheduleBlocked
const linkedGroupAssessmentRequests =
  retirementActionPreflight.linkedGroupAssessmentRequests
const observedLinkedWithdrawalGroups =
  retirementActionPreflight.observedConversionLinkedWithdrawalGroups
const conversionLinkedWithdrawalGroups =
  retirementActionPreflight.conversionLinkedWithdrawalGroups
// The ordinary executor still mints its alive facts at the caller boundary;
// named-QCD evidence is now prepared by `annualQcdExecutionInput` below.
const actionPersonAliveEvidence = (
  actionId: ActionId,
  personId: PersonId,
  actionDate: string | null,
): NonpersistedActionPersonAliveEvidence => ({
  evidenceId: `projection-alive:${JSON.stringify([
    actionId,
    personId,
    year,
    actionDate,
  ])}`,
  actionId,
  personId,
  actionYear: year,
  actionDate,
  alive: stateOf(personId).alive,
})
// Identity/legal preflight, runtime evidence, exact-cent source/RMD
// snapshots, and complete Form 8606 pool inputs are one immutable
// preparation boundary. The executor and every economic write stay here.
const qcdExecutionInput = annualQcdExecutionInput(Object.freeze({
  taxYear: year,
  plan: passPlan,
  primaryPersonId: primary.id,
  requests: currentYearQcdExecutionActions,
  people: Object.freeze(people.map((person) => Object.freeze({
    personId: person.id,
    dob: person.dob,
    alive: stateOf(person.id).alive,
  }))),
  balances: Object.freeze(rmdBalances.map((state) => Object.freeze({
    accountId: state.account.id,
    ownerPersonId: state.account.ownerPersonId ?? null,
    isAggregatedIra: isAggregatedIra(state.account),
    balancePlanDollars: state.balance,
    preDistributionBalancePlanDollars:
      preDistributionOwnedIraBalance.get(state.account.id) ?? 0,
  }))),
  ownerRmd: Object.freeze([...new Set(
    currentYearQcdExecutionActions.map((request) =>
      String(request.donorPersonId)),
  )].map((ownerPersonId) => Object.freeze({
    ownerPersonId,
    requiredPlanDollars: iraRmdRequiredByOwner.get(ownerPersonId) ?? 0,
    unsatisfiedPlanDollars:
      iraRmdUnsatisfiedByOwner.get(ownerPersonId) ?? 0,
  }))),
  ownerBasis: Object.freeze([...iraBasisByOwner].map(
    ([ownerPersonId, basisPlanDollars]) => Object.freeze({
      ownerPersonId,
      basisPlanDollars,
    }),
  )),
  priorOffsets: Object.freeze([...namedQcdOffsetConsumedByDonor].map(
    ([donorPersonId, consumedAmountCents]) => Object.freeze({
      donorPersonId,
      consumedAmountCents,
    }),
  )),
  offsetHistoryUnprovableDonorIds: Object.freeze([
    ...namedQcdOffsetHistoryUnprovable,
  ]),
}))
const qcdActionPrerequisiteResult = qcdExecutionInput.prerequisite
/**
 * The named charitable gift, settled and committed at phase rank 6.
 *
 * Position is the statute's, not convenience: Treas. Reg. 1.408-8(g)(1)
 * counts every IRA distribution against section 401(a)(9) and names a
 * qualified charitable distribution as its example, so the gift belongs
 * after the forced distributions it may count against; and Treas. Reg.
 * 1.408A-4 A-6(b) forbids a conversion from absorbing an unsatisfied RMD,
 * so it belongs before the conversions. The aggregate arm has already stood
 * down for this year, so the two can never sum.
 */
let qcdActionExecution: ExecuteAnnualQcdsResult | undefined
/** Gross dollars a named gift moved out of an owned IRA this year. */
let namedQcdExecuted = 0
/**
 * The share of that gift that satisfied a still-unmet owned-IRA RMD, and
 * the income reduction riding on it.
 *
 * Both are structurally zero today, not merely usually zero, and the proof
 * is worth writing down because it is also the warning. `rmdSatisfiedByAction`
 * is `min(executed, rmdRemainingBefore)`, and `rmdRemainingBefore` is this
 * owner's unmet IRA requirement after the sweep above -- which can only be
 * positive when every one of the owner's aggregated IRAs is empty. An empty
 * IRA is also an empty gift source, so `executed` is zero whenever
 * `rmdRemainingBefore` is not, and the product is zero either way. Dollars
 * taken beyond the RMD never entered income or cash, so offsetting them
 * would be a phantom deduction; the exclusion shows up instead as a
 * distribution that produced no income at all.
 *
 * The seams are wired anyway because the RMD-reserve slice named in
 * `treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd` makes them
 * reachable. When it lands, DO NOT trust the two lines below: a reserve
 * holds gift dollars out of the forced distribution, so those dollars never
 * become cash and never enter income in the first place, and giving them
 * back here would subtract them a second time. The give-back arithmetic has
 * to be re-derived against whatever the reserve actually leaves in
 * `rmdTotal` and `rmdNontaxable`, not carried forward from this shape.
 */
let namedQcdRmdSatisfied = 0
let namedQcdIncomeOffset = 0
if (qcdExecutionInput.status === 'ready') {
  qcdActionExecution = executeAnnualQcds(qcdExecutionInput.executorInput)
  if (qcdActionExecution.committed) {
    const accountOrder = new Map(
      plan.accounts.map((account, index) => [account.id, index] as const),
    )
    const balanceByAccountId = new Map(
      balances.map((state) => [state.account.id, state] as const),
    )
    const committedGifts = qcdActionExecution.evidence
      .filter((entry) => entry.executedAmount > 0)
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) =>
        (accountOrder.get(String(left.entry.sourceAccountId)) ?? Number.MAX_SAFE_INTEGER) -
          (accountOrder.get(String(right.entry.sourceAccountId)) ?? Number.MAX_SAFE_INTEGER) ||
        left.index - right.index)
    for (const { entry } of committedGifts) {
      const state = balanceByAccountId.get(String(entry.sourceAccountId))
      if (state === undefined) {
        throw new Error('Committed QCD source left the balance ledger')
      }
      const amount = ledgerCentsToPlanDollars(entry.executedAmount)
      if (amount > state.balance) {
        // Unreachable while the opening snapshot above is truncated, and
        // asserted rather than assumed because the consequence of it being
        // wrong is a negative balance that survives every later year and
        // silently rolls back the year's exact-basis settlement.
        throw new Error('Committed QCD exceeds its live source balance')
      }
      const kind = 'namedQcd' as const
      // Four members. A gift names no destination -- it leaves the
      // household -- so the action and the allocation are the only two
      // members beyond the aggregate key, and they are what tell one
      // donor's two gifts from the same IRA in the same year apart.
      const producerOccurrenceKey = runtimeOccurrenceKey(
        kind,
        String(entry.sourceAccountId),
        String(entry.actionId),
        String(entry.allocationId),
      )
      const sourceBalanceBefore = state.balance
      state.balance = sourceBalanceBefore - amount
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: amount,
        ownerPersonId: state.account.ownerPersonId,
        sourceAccountId: state.account.id,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
      recordAnnualRetirementRuntimeApplication({
        applicationKind: 'debit',
        producerOccurrenceKey,
        simulatorPhase: 'namedQcdDistribution',
        ownerPersonId: state.account.ownerPersonId,
        sourceAccountId: state.account.id,
        sourceBalanceBeforePlanDollars: sourceBalanceBefore,
        appliedAmountPlanDollars: amount,
        sourceBalanceAfterPlanDollars: state.balance,
      })
      // No pro-rata split rides on this debit. IRC 408(d)(8)(D) deems the
      // gift to consist of otherwise-includible dollars notwithstanding
      // section 72, so it returns no basis and leaves the year's Form 8606
      // ratio for the other distributions -- which is exactly why the
      // commit gate only admits gifts that stayed inside the pool.
      namedQcdExecuted += amount
    }
    for (const entry of qcdActionExecution.evidence) {
      const donorId = String(entry.donorPersonId)
      namedQcdOffsetConsumedByDonor.set(
        donorId,
        (namedQcdOffsetConsumedByDonor.get(donorId) ?? 0) +
          entry.derivedFacts.deductibleContributionOffsetApplied,
      )
    }
    namedQcdRmdSatisfied = ledgerCentsToPlanDollars(
      qcdActionExecution.totalRmdSatisfiedAmount,
    )
    // Structurally zero today: the annual pass distributes the whole
    // required amount in cash before any named gift is sized, so the
    // executor publishes totalRmdSatisfiedAmount of zero on every current
    // shape (treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd). A cap
    // of `ownedIraRmdTotal - rmdNontaxable` used to sit here; that is the
    // requirement's taxable share, the pre-408(d)(8)(D) ceiling the
    // aggregate arm no longer uses, and it was removed so it cannot go
    // live wrong. The day the RMD-reserve slice makes this positive, the
    // offset must be capped by the donor's aggregate includible amount,
    // the measure the aggregate arm computes, not by the requirement's
    // taxable share. A checkpoint pin holds this equal to the executor's
    // published figure so that day forces the statutory-cap decision.
    namedQcdIncomeOffset = namedQcdRmdSatisfied
    qcd += namedQcdExecuted
  } else if (isStandIn && qcdActionExecution.issues.some((issue) =>
    issue.kind === 'postPassBlocked')) {
    // Keyed off the structural condition rather than the refusal's message
    // text: in a stand-in year the post-pass refuses before any other
    // question is reached, so `isStandIn` plus a post-pass block IS the
    // missing-limit case, and a wording change in the executor cannot
    // silently drop the warning.
    // The QCD block's first user-visible warning. The aggregate arm may
    // extrapolate its limit because it never claims an action executed;
    // the named arm claims exactly that, and the contract forbids general
    // plan inflation from turning a prior year's figure into legal
    // evidence. Naming the year matters because the household also loses
    // its scalar gift that year: a named request stands the aggregate arm
    // down whether or not the named gift can move.
    warnings.add(
      `A named QCD is scheduled for ${year}, but RetireGolden has no sourced QCD limit for that tax year yet, ` +
        'so the gift was not executed and the recurring QCD amount stood down for the year. ' +
        'Plan the gift in a year whose limit is published, or model it with the recurring QCD amount instead.',
    )
  }
}
let rothConversionActionExecution: ExecuteRothConversionsResult | undefined
/**
 * Dollars a named request actually converted this year. Held apart from
 * the aggregate strategy's `rothConversion` because the two are produced by
 * different authorities and reconciled against different evidence; they are
 * summed only where the year publishes one conversion figure.
 */
let namedRothConversionExecuted = 0
/**
 * The Form 8606 line-8 basis return riding on those dollars. It is the
 * settlement's figure whenever the assumption vector carries one for the
 * allocation, and the plan-dollar pro-rata approximation only on the seed
 * attempt that has no assumption to read — the same two-stage disposition
 * the aggregate conversion pass already uses for `conversionNontaxable`.
 */
let namedRothConversionNontaxable = 0
/**
 * Observation-only: pre-60 Roth withdrawals that drew into assumed-seeded
 * contribution basis this attempt (owner pool key → withdrawal amount;
 * employer key → account withdrawal amount).
 */
const ownedRothAssumedBasisConsequentialByOwner = new Map<string, number>()
const employerRothAssumedBasisConsequentialByAccount = new Map<string, number>()
let retirementActionExecution:
  AnnualOrdinaryWithdrawalBoundaryResult['execution']
let retirementActionCash = 0
let retirementActionEquityCompensation = 0
let retirementActionProceeds = 0
let retirementActionTaxableProceeds = 0
let retirementActionCapitalGainOrLoss = 0
if (currentYearOrdinaryExecutionActions.length > 0) {
  const ordinaryWithdrawalBoundary = annualOrdinaryWithdrawalBoundary({
    year,
    plan: passPlan,
    ordinaryActions: currentYearOrdinaryActions,
    executionRequests: currentYearOrdinaryExecutionActions,
    balances,
    taxUnit: annualActionTaxUnit,
    conversionLinkedWithdrawalGroups,
    actionPersonAliveEvidence,
  })
  retirementActionExecution = ordinaryWithdrawalBoundary.execution
  retirementActionCash = ordinaryWithdrawalBoundary.totals.cash
  retirementActionEquityCompensation =
    ordinaryWithdrawalBoundary.totals.equityCompensation
  retirementActionProceeds = ordinaryWithdrawalBoundary.totals.proceeds
  retirementActionTaxableProceeds =
    ordinaryWithdrawalBoundary.totals.taxableProceeds
  retirementActionCapitalGainOrLoss =
    ordinaryWithdrawalBoundary.totals.capitalGainOrLoss
  if (ordinaryWithdrawalBoundary.balanceOperations.length !== balances.length) {
    throw new Error('Ordinary-withdrawal balance operations lost cardinality')
  }
  for (const [index, operation] of
    ordinaryWithdrawalBoundary.balanceOperations.entries()) {
    if (operation.kind === 'none') continue
    const state = balances[index]
    if (state === undefined || state.account.id !== operation.accountId) {
      throw new Error('Ordinary-withdrawal balance operation lost its position')
    }
    if (operation.closingCostBasis !== null) {
      state.costBasis = operation.closingCostBasis
    }
    state.balance = operation.closingBalance
  }
}
const retirementActionOrdinaryIncome = retirementActionEquityCompensation

const rothConversionExecutionInput = annualRothConversionExecutionInput(Object.freeze({
  taxYear: year,
  plan: passPlan,
  requests: Object.freeze([...currentYearConversionActions]),
  mixedKindScheduleBlocked,
  people: Object.freeze(peopleStates.map((state) => Object.freeze({
    personId: state.personId,
    alive: state.alive,
  }))),
  balances: Object.freeze(balances.map((state) => Object.freeze({
    accountId: state.account.id,
    balancePlanDollars: state.balance,
  }))),
  ownerRmd: Object.freeze([...new Set(currentYearConversionActions.map((request) =>
    request.personId))].map((ownerPersonId) => Object.freeze({
      ownerPersonId,
      requiredPlanDollars: iraRmdRequiredByOwner.get(ownerPersonId) ?? 0,
      unsatisfiedPlanDollars:
        iraRmdUnsatisfiedByOwner.get(ownerPersonId) ?? 0,
    }))),
  ownerBasis: Object.freeze([...iraBasisByOwner].map(([
    ownerPersonId,
    basisPlanDollars,
  ]) => Object.freeze({ ownerPersonId, basisPlanDollars }))),
  observedLinkedWithdrawalGroups,
  linkedWithdrawalGroups: conversionLinkedWithdrawalGroups,
  ordinaryWithdrawalEvidence: Object.freeze(retirementActionExecution?.evidence.map(
    (evidence) => Object.freeze({
      actionId: evidence.actionId,
      requestedAmount: evidence.requestedAmount,
      readiness: evidence.readiness,
      outcome: evidence.disposition.outcome,
      executedAmount: evidence.disposition.executedAmount,
    }),
  ) ?? []),
}))
/**
 * The verdict as the rest of the year reads it, which is the released one
 * until the withdrawal leg fails to arrive. Keep it separate from the
 * pre-withdrawal verdict: that executor already answered to the earlier
 * assessment, while every later reader must share this narrowed result.
 */
const effectiveLinkedWithdrawalGroups =
  rothConversionExecutionInput.effectiveLinkedWithdrawalGroups
if (rothConversionExecutionInput.status === 'ready') {
  rothConversionActionExecution = executeRothConversions(
    rothConversionExecutionInput.executorInput,
  )

  if (rothConversionActionExecution.committed) {
    // Debits for every committed request first, then the destination
    // credits. The two simulator phases are ordered that way, and within
    // the debit phase the applications must retain controlling Plan
    // account order, so the moves are sorted rather than left in whichever
    // order the requests happened to arrive.
    const balanceByAccountId = new Map(
      balances.map((state) => [state.account.id, state] as const),
    )
    const accountOrder = new Map(
      plan.accounts.map((account, index) => [account.id, index] as const),
    )
    const committedConversions = rothConversionActionExecution.evidence
      .flatMap((evidence) => evidence.outcome === 'executed'
        ? evidence.allocations.map((allocation) => ({
          actionId: evidence.actionId,
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          destinationRothAccountId: evidence.destinationRothAccountId,
          amount: ledgerCentsToPlanDollars(asUsdCents(allocation.executedAmount)),
        }))
        : [])
      .sort((left, right) =>
        (accountOrder.get(left.sourceAccountId) ?? Number.MAX_SAFE_INTEGER) -
          (accountOrder.get(right.sourceAccountId) ?? Number.MAX_SAFE_INTEGER) ||
        compareUtf16CodeUnits(left.allocationId, right.allocationId))
    // One accumulator per action, appended to in the sorted debit pass, so
    // the credit pass reads each action's moves in the same controlling
    // order the debits were emitted in without re-scanning the batch.
    interface CommittedConversionAction {
      readonly destinationRothAccountId: string
      readonly debitKeys: string[]
      readonly debitOwners: (string | null)[]
      creditedAmountPlanDollars: number
      /** This action's own share of `namedRothConversionNontaxable`. */
      nontaxableAmountPlanDollars: number
    }
    const committedByActionId = new Map<string, CommittedConversionAction>()
    for (const move of committedConversions) {
      const state = balanceByAccountId.get(move.sourceAccountId)
      if (state === undefined) {
        throw new Error('Committed conversion source left the balance ledger')
      }
      const kind = 'namedRothConversion' as const
      // Five members. The action and allocation are what make this key
      // incapable of colliding with an aggregate conversion that merely
      // shares a source and a destination.
      const producerOccurrenceKey = runtimeOccurrenceKey(
        kind,
        move.sourceAccountId,
        move.destinationRothAccountId,
        move.actionId,
        move.allocationId,
      )
      let committedAction = committedByActionId.get(move.actionId)
      if (committedAction === undefined) {
        committedAction = {
          destinationRothAccountId: move.destinationRothAccountId,
          debitKeys: [],
          debitOwners: [],
          creditedAmountPlanDollars: 0,
          nontaxableAmountPlanDollars: 0,
        }
        committedByActionId.set(move.actionId, committedAction)
      }
      if (committedAction.destinationRothAccountId !== move.destinationRothAccountId) {
        throw new Error('Committed conversion allocations disagree about their destination')
      }
      committedAction.debitKeys.push(producerOccurrenceKey)
      committedAction.debitOwners.push(state.account.ownerPersonId)
      committedAction.creditedAmountPlanDollars += move.amount
      const sourceBalanceBefore = state.balance
      if (move.amount > sourceBalanceBefore) {
        // Unreachable while the opening snapshot above is truncated, and
        // asserted rather than assumed because the consequence of it being
        // wrong is a negative balance that survives every later year and
        // silently rolls back the year's exact-basis settlement.
        throw new Error('Committed conversion exceeds its live source balance')
      }
      state.balance = sourceBalanceBefore - move.amount
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: move.amount,
        ownerPersonId: state.account.ownerPersonId,
        sourceAccountId: state.account.id,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
      if (isAggregatedIra(state.account)) {
        const ownedIraApplication = recordAnnualRetirementRuntimeApplication({
          applicationKind: 'debit',
          producerOccurrenceKey,
          simulatorPhase: 'namedRothConversionDebit',
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          sourceBalanceBeforePlanDollars: sourceBalanceBefore,
          appliedAmountPlanDollars: move.amount,
          sourceBalanceAfterPlanDollars: state.balance,
        })
        // The executor authorised the movement without stating its
        // character; IRC 408(d)(2)/408A(d)(3)(A) apportion it by the
        // year's Form 8606 line-10 ratio, and the settlement is the only
        // place that ratio exists. Reading it back through the assumption
        // vector is what makes this the settlement's own figure rather
        // than a second, mid-year answer to the same owner-year question.
        //
        // `mutationOrdinal` is the load-bearing member: the replay derives
        // each line-8 allocation identity from the ordinal of this very
        // application, so it is taken from the recorded application rather
        // than predicted. A mismatched ordinal does not raise — it makes
        // `resolveAssumedCharacter` return null and silently fall back,
        // which is why the tests assert the nontaxable figure and not
        // merely that the conversion happened.
        const ownerId = state.account.ownerPersonId ?? primary.id
        const proRata = iraProRata.get(ownerId)
        if (ownedIraApplication.applicationKind === 'debit') {
          if (proRata !== undefined) {
            const split = splitWithAssumedCharacter(proRata, move.amount, {
              ownerPersonId: ownerId,
              calculationScope: 'form8606Line8NetConversions',
              occurrenceKind: kind,
              producerOccurrenceKey,
              sourceAccountId: state.account.id,
              mutationOrdinal: ownedIraApplication.mutationOrdinal,
            })
            iraProRata.set(ownerId, split.next)
            committedAction.nontaxableAmountPlanDollars += split.nontaxable
            namedRothConversionNontaxable += split.nontaxable
          } else {
            noteForm8606Taxable(ownerId, move.amount, 'conversions')
          }
        }
      }
    }
    for (const actionId of [...committedByActionId.keys()].sort(compareUtf16CodeUnits)) {
      const committedAction = committedByActionId.get(actionId)!
      const destinationId = committedAction.destinationRothAccountId
      const destination = balanceByAccountId.get(destinationId)
      if (destination === undefined || destination.account.type !== 'roth') {
        throw new Error('Committed conversion destination is not a Roth account')
      }
      const credited = committedAction.creditedAmountPlanDollars
      const destinationBalanceBefore = destination.balance
      destination.balance = destinationBalanceBefore + credited
      recordAnnualRetirementRuntimeApplication({
        applicationKind: 'namedRothDestinationCredit',
        simulatorPhase: 'namedRothConversionDestinationCredit',
        producerOccurrenceKey: null,
        ownerPersonId: null,
        sourceAccountId: null,
        sourceBalanceBeforePlanDollars: null,
        sourceBalanceAfterPlanDollars: null,
        actionId,
        producerOccurrenceKeys: committedAction.debitKeys,
        sourceOwnerPersonIds: committedAction.debitOwners,
        destinationRothAccountId: destination.account.id,
        destinationOwnerPersonId: destination.account.ownerPersonId,
        destinationBalanceBeforePlanDollars: destinationBalanceBefore,
        destinationCreditedAmountPlanDollars: credited,
        destinationBalanceAfterPlanDollars: destination.balance,
      })
      // IRC 408A(d)(3)(F) runs a 5-taxable-year clock from the year of
      // this conversion, and (F)(ii) limits the recapture to the portion
      // that was includible. At a proven-zero basis numerator that is the
      // whole layer; at a positive one the basis return rolled into the
      // Roth was never included in income, so it carries no recapture and
      // `taxableAmount` is strictly less than `amount`.
      const rb = rothBasis.get(rothPoolKey(destination.account))
      if (rb) {
        rb.conversionLayers.push({
          year,
          amount: credited,
          taxableAmount: Math.max(
            0,
            credited - committedAction.nontaxableAmountPlanDollars,
          ),
        })
      }
      namedRothConversionExecuted += credited
    }
  }
}
  return {
    rmdTotal,
    rmdNontaxable,
    ownedIraRmdTotal,
    seppTotal,
    seppNontaxable,
    inheritedTotal,
    inheritedOrdinaryIncome,
    inheritedRothForced,
    inheritedYearEvidenceDraft,
    rmdShortfallObligations,
    rmdShortfallExciseResults,
    rmdShortfallExciseTax,
    iraRmdRequiredByOwner,
    iraRmdUnsatisfiedByOwner,
    qcd,
    qcdIncomeOffset,
    qcdNonQualifiedOrdinaryIncome,
    qcdFromRmd,
    namedQcdExecuted,
    namedQcdRmdSatisfied,
    namedQcdIncomeOffset,
    annuityPaymentNontaxable,
    retirementActionExecution,
    retirementActionCash,
    retirementActionEquityCompensation,
    retirementActionProceeds,
    retirementActionTaxableProceeds,
    retirementActionCapitalGainOrLoss,
    retirementActionOrdinaryIncome,
    namedRothConversionExecuted,
    namedRothConversionNontaxable,
    rothConversionActionExecution,
    effectiveLinkedWithdrawalGroups,
    legacyQcdCharacterizations,
    qcdActionExecution,
    currentYearConversionActions,
    mixedKindScheduleBlocked,
    linkedGroupAssessmentRequests,
    observedLinkedWithdrawalGroups,
    conversionLinkedWithdrawalGroups,
    isAggregatedIraThisYear,
    rmdBalances,
    rmdObligationByAccount,
    rmdTakeByAccount,
    ownedIraRmdGrossByOwner,
    qcdFromRmdByOwner,
    qcdGrossByOwner,
    qcdQualifiedFromRmdByOwner,
    deferredLegacyQcdDistributions,
    qcdActionPrerequisiteResult,
    ownedRothAssumedBasisConsequentialByOwner,
    employerRothAssumedBasisConsequentialByAccount,
  }
}
