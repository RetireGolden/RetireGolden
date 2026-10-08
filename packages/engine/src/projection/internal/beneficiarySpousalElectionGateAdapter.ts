/**
 * Maps Plan inherited-beneficiary facts into the annual spousal-election gate
 * before beneficiary tax characterization. Reuses existing soleBeneficiary /
 * spouseUnlimitedWithdrawalRight fields (undefined → unknown, true → verified,
 * false → not). Preserves death-year decedent residual RMD.
 */
import {
  gateBeneficiarySpousalElectionForAnnualCoordinator,
  determineSection402c2j4CatchUp,
  type Section402c2j4Determination,
  type BeneficiaryElectionFactsForGate,
  type GateBeneficiarySpousalElectionResult,
  type VerifiedTriState,
  type SpousalElectionSimulationContext,
} from '../../actions/beneficiarySpousalElectionAnnualGate.js'
import { parseCivilIsoDate } from '../../actions/civilDate.js'
import { personIdSchema } from '../../actions/identity.js'
import { asUsdCents } from '../../actions/money.js'
import type { Account } from '../../model/plan.js'

function soleStatus(
  value: boolean | undefined,
): BeneficiaryElectionFactsForGate['soleBeneficiaryStatus'] {
  if (value === true) return 'verifiedSole'
  if (value === false) return 'verifiedNotSole'
  return 'unknown'
}

function unlimitedRight(value: boolean | undefined): VerifiedTriState {
  if (value === true) return 'verifiedYes'
  if (value === false) return 'verifiedNo'
  return 'unknown'
}

export function gateSpousalElectionFromInheritedAccount(input: {
  readonly account: Extract<Account, { type: 'traditional' | 'roth' }>
  readonly taxYear: number
  readonly determinationStage?: 'openingOfTaxYear' | 'endOfTaxYear'
  readonly deathYearDecedentResidualRmd?: number
  readonly simulationContext?: Readonly<SpousalElectionSimulationContext>
}): GateBeneficiarySpousalElectionResult | null {
  const inherited = input.account.inherited
  if (inherited === undefined || inherited.beneficiary === undefined) return null
  const beneficiary = inherited.beneficiary
  if (beneficiary.beneficiaryClass !== 'designated-individual') return null
  if (beneficiary.edbCategory !== 'surviving-spouse') return null
  const residual = asUsdCents(
    Math.round((input.deathYearDecedentResidualRmd ?? 0) * 100),
  )
  const beneficiaryIdentity = personIdSchema.safeParse(input.account.ownerPersonId)
  const decedentIdentity = personIdSchema.safeParse(inherited.decedentId)
  if (!beneficiaryIdentity.success || !decedentIdentity.success) return {
    status: 'missingFacts',
    missing: [
      ...(!beneficiaryIdentity.success ? ['beneficiaryPersonId'] : []),
      ...(!decedentIdentity.success ? ['decedentId'] : []),
    ],
    deathYearDecedentResidualRmdDue: residual,
  }
  const beneficiaryPersonId = beneficiaryIdentity.data
  const decedentPersonId = decedentIdentity.data

  const electionFactsBlock = beneficiary.spousalElectionFacts
  const stage = input.determinationStage ?? 'openingOfTaxYear'
  const opening = stage === 'openingOfTaxYear'
  const cutoffDate = `${input.taxYear}-${opening ? '01-01' : '12-31'}`
  // Year-only recommendations are not observed execution. A missing death
  // date likewise cannot become January 1 merely to pass the eligibility gate.
  if (inherited.ownerDeathDate === undefined) return {
    status: 'missingFacts', missing: ['ownerDeathDate'], deathYearDecedentResidualRmdDue: residual,
  }
  if (electionFactsBlock === undefined ||
      (electionFactsBlock.affirmativeElectionYear === undefined && electionFactsBlock.affirmativeElectionDate === undefined) ||
      electionFactsBlock.nonRolloverContributionYears === undefined) return {
    status: 'missingFacts', missing: ['explicit election and contribution history'], deathYearDecedentResidualRmdDue: residual,
  }
  const affirmativeDate = electionFactsBlock?.affirmativeElectionDate
  if (electionFactsBlock?.affirmativeElectionYear != null && affirmativeDate === undefined) return {
    status: 'missingFacts', missing: ['affirmativeElectionDate'], deathYearDecedentResidualRmdDue: residual,
  }
  if ((electionFactsBlock?.nonRolloverContributionYears?.length ?? 0) > 0 && electionFactsBlock?.nonRolloverContributionEvents === undefined) return {
    status: 'missingFacts', missing: ['nonRolloverContributionEvents'], deathYearDecedentResidualRmdDue: residual,
  }
  const observedContributions = electionFactsBlock?.nonRolloverContributionEvents ?? []
  const contributionEvidenceInvalid = observedContributions.some((event) =>
    parseCivilIsoDate(event.executionDate) === null || parseCivilIsoDate(event.observedAsOfDate) === null ||
    event.executionDate > event.observedAsOfDate || event.provenance.asOf < event.observedAsOfDate ||
    event.provenance.source.trim().length === 0,
  )
  if (contributionEvidenceInvalid) return {
    status: 'missingFacts', missing: ['nonRolloverContributionEvents chronology/provenance'], deathYearDecedentResidualRmdDue: residual,
  }
  // Only externally observed, completed rows are passed to the opening gate.
  // Projected annual recommendations remain execution data, never history.
  const history = (inherited.annualDistributionHistory ?? []).flatMap((row) =>
    row.observedAsOfDate === undefined || row.taxYear > input.taxYear - (opening ? 1 : 0) ||
    (opening ? row.observedAsOfDate >= cutoffDate : row.observedAsOfDate > cutoffDate) ||
    row.legalDistributionDeadline === undefined || row.observedAsOfDate < row.legalDistributionDeadline
      ? []
      : [{
          taxYear: row.taxYear,
          requiredAmount: asUsdCents(Math.round(row.requiredAmount * 100)),
          distributedAmount: asUsdCents(Math.round(row.distributedAmount * 100)),
          observedThrough: row.observedAsOfDate,
          legalDeadline: row.legalDistributionDeadline!,
          provenance: row.provenance.source,
        }],
  )
  const worksheet = electionFactsBlock?.section402c2j4Inputs
  const typedJ4: Section402c2j4Determination = worksheet === undefined
    ? { status: 'incomplete', reason: 'unknownDistributionMethod' }
    : determineSection402c2j4CatchUp({
        accountType: input.account.type,
        transaction: worksheet.transaction,
        preElectionDistributionMethod: electionFactsBlock?.preElectionDistributionMethod ?? 'unknown',
        spouseBirthDate: worksheet.spouseBirthDate,
        decedentBirthDate: worksheet.decedentBirthDate,
        distributionYear: worksheet.distributionYear,
        currentYearRmdReferenceBalance: worksheet.currentYearRmdReferenceBalance === 'unknown'
          ? 'unknown' : asUsdCents(Math.round(worksheet.currentYearRmdReferenceBalance * 100)),
        actualPriorYearDistributions: new Map(worksheet.actualPriorYearDistributions.map((row) =>
          [row.taxYear, asUsdCents(Math.round(row.amount * 100))])),
        actualPreElectionDistributionsCurrentYear: asUsdCents(Math.round(worksheet.actualPreElectionDistributionsCurrentYear * 100)),
        currentDistributionOrRemainingInterest: asUsdCents(Math.round(worksheet.currentDistributionOrRemainingInterest * 100)),
        factsAsOfDate: worksheet.provenance.asOf,
        provenance: worksheet.provenance.source,
      })

  return gateBeneficiarySpousalElectionForAnnualCoordinator({
    beneficiaryPersonId,
    decedentPersonId,
    relationship: 'survivingSpouse',
    simulationContext: input.simulationContext,
    deathDate: inherited.ownerDeathDate ?? `${inherited.ownerDeathYear}-01-01`,
    taxYear: input.taxYear,
    determinationStage: stage,
    electionFacts: {
      soleBeneficiaryStatus: soleStatus(beneficiary.soleBeneficiary),
      unlimitedWithdrawalRight: unlimitedRight(
        beneficiary.spouseUnlimitedWithdrawalRight,
      ),
      beneficiaryIsDirectSpouseNamedOnIra:
        electionFactsBlock?.directSpouseNamedOnIra ?? 'unknown',
      affirmativeRedesignation:
        affirmativeDate != null && affirmativeDate <= cutoffDate &&
        (electionFactsBlock?.provenance.asOf ?? '') >= affirmativeDate
          ? { executedOn: affirmativeDate, provenance: electionFactsBlock!.provenance.source } : null,
      nonRolloverContributions: observedContributions
        .filter((event) => event.executionDate <= cutoffDate && event.observedAsOfDate <= cutoffDate)
        .map((event) => ({ executedOn: event.executionDate, provenance: event.provenance.source })),
      postDeathRequiredDistributionHistory: history,
      factsAsOfDate:
        electionFactsBlock?.provenance.asOf ??
        inherited.ownerDeathDate ??
        `${inherited.ownerDeathYear}-01-01`,
      factsProvenance: electionFactsBlock?.provenance.source ?? '',
      section402c2j4: typedJ4,
    },
    deathYearDecedentResidualRmd: residual,
  })
}

/**
 * Accepted qualifying distributions already on the Plan for the election year.
 * Uses only observed current-year history and the j(4) pre-election actual
 * field — never invents undated transaction timing.
 */
export interface AcceptedElectionYearQualifyingDistributions {
  readonly amount: number
  /** The accepted source is carried into the final owner-obligation record. */
  readonly evidence:
    | 'none'
    | 'completed-current-year-beneficiary-history'
    | 'section402c2j4-actual-pre-election-distribution'
}

/** Completed, provenance-backed current-year history rows: distributions from this IRA itself. */
function acceptedCurrentYearHistory(
  account: Extract<Account, { type: 'traditional' | 'roth' }>,
  taxYear: number,
): { readonly rows: number; readonly amount: number } {
  const accepted = (account.inherited?.annualDistributionHistory ?? [])
    .filter((row) =>
      row.taxYear === taxYear &&
      parseCivilIsoDate(row.observedAsOfDate ?? '') !== null &&
      parseCivilIsoDate(row.legalDistributionDeadline ?? '') !== null &&
      parseCivilIsoDate(row.provenance.asOf) !== null &&
      row.observedAsOfDate! >= row.legalDistributionDeadline! &&
      row.provenance.asOf >= row.observedAsOfDate! &&
      row.provenance.source.trim().length > 0,
    )
  return {
    rows: accepted.length,
    amount: accepted.reduce((sum, row) => sum + Math.max(0, row.distributedAmount), 0),
  }
}

/** The evidenced j(4) pre-election actual for the year, or 0. */
function section402c2j4PreElectionActual(
  account: Extract<Account, { type: 'traditional' | 'roth' }>,
  taxYear: number,
): number {
  const electionFacts = account.inherited?.beneficiary?.spousalElectionFacts
  const worksheet = electionFacts?.section402c2j4Inputs
  const eventDate = electionFacts?.affirmativeElectionDate
  return worksheet !== undefined &&
    worksheet.distributionYear === taxYear &&
    parseCivilIsoDate(worksheet.provenance.asOf) !== null &&
    worksheet.provenance.source.trim().length > 0 &&
    (eventDate === null || eventDate === undefined || worksheet.provenance.asOf >= eventDate)
    ? Math.max(0, worksheet.actualPreElectionDistributionsCurrentYear)
    : 0
}

/**
 * The accepted amount for one IRA read on its own, as for an IRA alone in its
 * pool. The election-year phase reads every IRA through
 * electionYearQualifyingDistributionsInPool, which counts a pool's shared
 * j(4) figure once.
 */
export function acceptedElectionYearQualifyingDistributions(input: {
  readonly account: Extract<Account, { type: 'traditional' | 'roth' }>
  readonly taxYear: number
}): AcceptedElectionYearQualifyingDistributions {
  const inherited = input.account.inherited
  if (inherited === undefined || inherited.beneficiary === undefined) {
    return { amount: 0, evidence: 'none' }
  }
  const history = acceptedCurrentYearHistory(input.account, input.taxYear)
  if (history.rows > 0) {
    return {
      amount: history.amount,
      evidence: 'completed-current-year-beneficiary-history',
    }
  }
  const fromJ4 = section402c2j4PreElectionActual(input.account, input.taxYear)
  // Prefer an explicit current-year history row when present; otherwise the
  // independently proven j(4) pre-election actual is the only accepted amount.
  if (fromJ4 > 0) {
    return {
      amount: fromJ4,
      evidence: 'section402c2j4-actual-pre-election-distribution',
    }
  }
  return { amount: 0, evidence: 'none' }
}

interface ElectionYearPoolInput {
  readonly account: Extract<Account, { type: 'traditional' | 'roth' }>
  /** Every logical account this year, to find the account's pool. */
  readonly accounts: readonly Readonly<Account>[]
  readonly primaryPersonId: string
  readonly taxYear: number
}

/**
 * The other IRAs in this account's payee/decedent/type pool, the pool whose
 * members the plan checks require to carry identical beneficiary and
 * election facts (checkInheritedIraAggregationFacts). Logical account IDs are
 * compared, so compatible duplicate physical rows count once.
 */
function sameDecedentIraPoolMates(
  input: ElectionYearPoolInput,
): Extract<Account, { type: 'traditional' | 'roth' }>[] {
  const { account } = input
  const decedentId = account.inherited?.decedentId
  if (account.kind !== 'ira' || decedentId === undefined) return []
  const payee = account.ownerPersonId ?? input.primaryPersonId
  return input.accounts.flatMap((other) =>
    (other.type === 'traditional' || other.type === 'roth') &&
    other.type === account.type &&
    other.id !== account.id &&
    other.kind === 'ira' &&
    other.inherited?.decedentId === decedentId &&
    (other.ownerPersonId ?? input.primaryPersonId) === payee
      ? [other]
      : [],
  )
}

/** One IRA's accepted election-year distributions, read against its pool. */
export interface ElectionYearQualifyingDistributionsInPool
  extends AcceptedElectionYearQualifyingDistributions {
  /** The IRA is one of two or more in its payee/decedent/type pool. */
  readonly pooled: boolean
  /** The pool's one j(4) pre-election distribution, counted once per pool; 0 for a lone IRA. */
  readonly poolShared: number
}

/**
 * One IRA's accepted election-year distributions, read against its pool.
 *
 * Treas. Reg. 1.408-8(e)(1)(i) calculates each IRA's requirement separately
 * and lets the total be distributed from any one or more of the owner's
 * IRAs, so a distribution counts once toward the total, whichever IRA it came
 * from. A completed current-year history row names the IRA it came from and
 * is credited to that IRA (`amount`). The j(4) pre-election distribution is
 * one figure in the facts every IRA of a pool shares and names no IRA: for a
 * pooled IRA it is returned as `poolShared`, which the planner counts once
 * for the whole pool, never once per IRA. As for a lone IRA, completed
 * history is preferred to the j(4) figure: when any IRA of the pool has it,
 * the j(4) figure is not counted, so no dollar can be counted twice.
 */
export function electionYearQualifyingDistributionsInPool(
  input: ElectionYearPoolInput,
): ElectionYearQualifyingDistributionsInPool {
  const mates = sameDecedentIraPoolMates(input)
  if (mates.length === 0) {
    return { ...acceptedElectionYearQualifyingDistributions(input), pooled: false, poolShared: 0 }
  }
  if (input.account.inherited?.beneficiary === undefined) {
    return { amount: 0, evidence: 'none', pooled: true, poolShared: 0 }
  }
  const own = acceptedCurrentYearHistory(input.account, input.taxYear)
  const poolHasHistory = own.rows > 0 ||
    mates.some((mate) => acceptedCurrentYearHistory(mate, input.taxYear).rows > 0)
  if (poolHasHistory) {
    return {
      amount: own.amount,
      evidence: 'completed-current-year-beneficiary-history',
      pooled: true,
      poolShared: 0,
    }
  }
  const shared = section402c2j4PreElectionActual(input.account, input.taxYear)
  return {
    amount: 0,
    evidence: shared > 0 ? 'section402c2j4-actual-pre-election-distribution' : 'none',
    pooled: true,
    poolShared: shared,
  }
}

/**
 * The election-year planner's credit inputs for one IRA: its own accepted
 * distributions and, for a pooled IRA, the pool key and the pool's shared
 * j(4) figure, which planElectionYearOwnerRmdDraws counts once per pool.
 */
export function electionYearOwnerRmdCredits(input: ElectionYearPoolInput): {
  readonly alreadyDistributedQualifying: number
  readonly poolKey?: string
  readonly poolSharedQualifying: number
} {
  const accepted = electionYearQualifyingDistributionsInPool(input)
  if (!accepted.pooled) {
    return { alreadyDistributedQualifying: accepted.amount, poolSharedQualifying: 0 }
  }
  return {
    alreadyDistributedQualifying: accepted.amount,
    poolKey: JSON.stringify([
      input.account.ownerPersonId ?? input.primaryPersonId,
      input.account.inherited?.decedentId,
      input.account.type,
    ]),
    poolSharedQualifying: accepted.poolShared,
  }
}

/**
 * Prior December 31 balance for one IRA's election-year owner RMD, before the
 * planner adds back a pool's shared pre-election distribution.
 *
 * Treas. Reg. 1.408-8(c)(3) makes the election-year requirement the owner's
 * under section 401(a)(9)(A); 1.408-8(b)(2) substitutes the IRA's own balance
 * at the prior December 31 for the 1.401(a)(9)-5(b) account balance, and
 * 1.408-8(e)(1)(i) calculates the requirement separately for each IRA.
 *
 * The projection never debits an accepted pre-election distribution from the
 * balance (it is already paid), so a plan whose year-end balance is right
 * enters the balance after it, and the IRA's prior December 31 balance is
 * that opening balance plus the distributions taken from it this year. A lone
 * IRA prefers a positive explicit j(4) reference balance, its prior December
 * 31 balance as the custodian reports it. The reference is one IRA's balance
 * only while that IRA is alone in its payee/decedent/type pool: the plan
 * checks give every IRA in a pool identical election facts, so with two or
 * more IRAs each takes its own opening balance plus its own completed
 * current-year distributions, and the planner adds the pool's unnamed j(4)
 * pre-election distribution back once. Withdrawals still aggregate across the
 * owner's IRAs downstream; only the per-IRA requirement is set here.
 */
export function electionYearOwnerRmdReferenceBalance(input: ElectionYearPoolInput & {
  readonly startOfYearBalance: number
}): number {
  const opening = Math.max(0, input.startOfYearBalance)
  const accepted = electionYearQualifyingDistributionsInPool(input)
  if (accepted.pooled) return opening + accepted.amount
  const reference =
    input.account.inherited?.beneficiary?.spousalElectionFacts?.section402c2j4Inputs
      ?.currentYearRmdReferenceBalance
  // A positive explicit reference is the prior-Dec-31 / RMD base. Zero is the
  // life-expectancy placeholder used when j(4) is non-applicable and must not
  // collapse the owner requirement.
  if (typeof reference === 'number' && Number.isFinite(reference) && reference > 0) {
    return reference
  }
  return opening + accepted.amount
}
