/**
 * Authoring a named charitable gift from an IRA — the pure half.
 *
 * This is the first surface in the product that *creates* a retirement action
 * rather than reviewing one the migration left behind, so three rules bound it:
 *
 * 1. **Authoring is not review.** A draft goes to
 *    `allocateRetirementActionCandidateIdentity`, whose QCD arm mints the
 *    action and allocation IDs from the gift's own facts. It never goes to
 *    `reviewAndReplaceRetirementActionManually`, which exists to replace a
 *    migrated row and has no QCD arm by design.
 * 2. **The engine owns every refusal.** Nothing here paraphrases, softens, or
 *    predicts an action reason. The projection's typed reasons are carried out
 *    verbatim and the surface supplies only a frame around them.
 * 3. **Nothing is answered on the household's behalf.** The five charity
 *    statements start false and stay false until clicked, and a draft that is
 *    missing any of them is refused rather than saved with a supplied answer.
 *
 * ## Charity-designation ID minting
 *
 * A charity designation ID joins the Plan-wide identifier namespace
 * (`retirementActionPlanReservedIdentifiers` reads `charity.designationId`), so
 * it is minted the same way the eligibility-facts editor mints evidence IDs: a
 * pure function of the gift's natural key, with a refusal rather than a
 * suffix when the Plan already claims the result.
 *
 * | Record              | Minted ID                                                     |
 * |---------------------|---------------------------------------------------------------|
 * | Charity designation | `planner-qcd-charity:["<donorId>",<year>,"<date>",<sequence>]` |
 *
 * The key is the gift's execution slot, which the Plan already keeps unique:
 * `executionSlotAlreadyUsed` refuses a second action on the same date and
 * sequence, so two live gifts never share a key and never share an ID. The
 * namespace prefix keeps it clear of the `planner-eligibility-*` evidence IDs,
 * the simulator's `projection-*` IDs, and the review preview's
 * `planner-preview-*` IDs. The action and allocation IDs are not minted here at
 * all — the allocator derives them structurally and refuses a collision itself,
 * with `generatedIdentityCollision`.
 */

import type {
  QcdCharityDesignation,
  RetirementActionRequest,
} from '@retiregolden/engine/actions/contract'
import type { AccountId, PersonId } from '@retiregolden/engine/actions/identity'
import type {
  QcdCandidateIdentityIntent,
} from '@retiregolden/engine/actions/retirementActionCandidateIdentityAllocator'
import {
  retirementActionPlanReservedIdentifiers,
  type Account,
  type Plan,
} from '@retiregolden/engine/model/plan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { TaxCalculator } from '@retiregolden/engine/projection/types'

import {
  iraClassificationFor,
  sepSimpleActivityFor,
} from './retirementActionEligibilityFacts'
import {
  exactDateForYear,
  exactExecutionSequence,
  executionSlotAlreadyUsed,
  positiveDollarsToCents,
  retirementActionManualPersonSupportIssue,
} from './retirementActionManualEditor'
import { namedQcdActions } from './retirementActionQcdSchedule'

export type QcdDesignationKindChoice = '' | QcdCharityDesignation['designationKind']

/**
 * Every identity fact starts blank. The tax year is the one exception and is
 * seeded by the caller from the projection's start year: it is a schedule fact
 * for an action the household is creating from nothing, not an identity the
 * Plan could be misread as already holding, and it is shown in an editable
 * field and in the row title before anything is saved.
 */
export interface QcdAuthoringDraft {
  year: string
  donorPersonId: string
  sourceAccountId: string
  giftAmountDollars: number | null
  executionDate: string
  executionSequence: string
  charityName: string
  designationKind: QcdDesignationKindChoice
  directFromCustodianAttested: boolean
  eligibleOrganizationAttested: boolean
  notDonorAdvisedFundOrSupportingOrganizationAttested: boolean
  notSplitInterestEntityAttested: boolean
  entireDistributionOtherwiseDeductibleAttested: boolean
}

export function emptyQcdAuthoringDraft(year: number): QcdAuthoringDraft {
  return {
    year: String(year),
    donorPersonId: '',
    sourceAccountId: '',
    giftAmountDollars: null,
    executionDate: '',
    executionSequence: '',
    charityName: '',
    designationKind: '',
    directFromCustodianAttested: false,
    eligibleOrganizationAttested: false,
    notDonorAdvisedFundOrSupportingOrganizationAttested: false,
    notSplitInterestEntityAttested: false,
    entireDistributionOtherwiseDeductibleAttested: false,
  }
}

export interface QcdCharityAttestation {
  readonly key: keyof Pick<
    QcdAuthoringDraft,
    | 'directFromCustodianAttested'
    | 'eligibleOrganizationAttested'
    | 'notDonorAdvisedFundOrSupportingOrganizationAttested'
    | 'notSplitInterestEntityAttested'
    | 'entireDistributionOtherwiseDeductibleAttested'
  >
  readonly label: string
}

/**
 * The household's own statements about its own arrangement, in the first
 * person and with no rule cited at any of them. RetireGolden cannot check a
 * single one, which is exactly why each is a click rather than a default.
 */
export const QCD_CHARITY_ATTESTATIONS: readonly QcdCharityAttestation[] = [
  {
    key: 'directFromCustodianAttested',
    label: 'My IRA custodian will pay the charity directly. The money will not pass through my hands.',
  },
  {
    key: 'eligibleOrganizationAttested',
    label: 'The recipient is a charity that can accept tax-deductible gifts.',
  },
  {
    key: 'notDonorAdvisedFundOrSupportingOrganizationAttested',
    label: 'The recipient is not a donor-advised fund and not a supporting organization.',
  },
  {
    key: 'notSplitInterestEntityAttested',
    label: 'The recipient is not a charitable remainder trust and not a charitable gift annuity.',
  },
  {
    key: 'entireDistributionOtherwiseDeductibleAttested',
    label: 'I will get nothing back for this gift, and the whole amount would be deductible if I itemized.',
  },
]

/**
 * Every designation the contract accepts is offered, including the ones the
 * engine refuses. Hiding them would make this surface the author of an
 * eligibility claim; showing them lets the household state what it has and read
 * the engine's answer.
 */
export const QCD_DESIGNATION_KIND_OPTIONS: readonly {
  value: QcdCharityDesignation['designationKind']
  label: string
}[] = [
  { value: 'eligiblePublicCharity', label: 'Public charity' },
  { value: 'donorAdvisedFund', label: 'Donor-advised fund' },
  { value: 'supportingOrganization', label: 'Supporting organization' },
  { value: 'splitInterestEntity', label: 'Charitable remainder trust or gift annuity' },
  { value: 'unknown', label: 'Not sure' },
]

export const QCD_CHARITY_DESIGNATION_ID_CONFLICT =
  'This gift cannot be saved: another item in this plan already uses the ID RetireGolden files its charity under. Change the conflicting account, person, or action ID, then save the gift again.'

export interface QcdCharityDesignationClaim {
  readonly donorPersonId: string
  readonly year: number
  readonly executionDate: string
  readonly executionSequence: number
}

/** The one place a UI-authored charity designation ID is minted. */
export function mintQcdCharityDesignationId(claim: QcdCharityDesignationClaim): string {
  return `planner-qcd-charity:${JSON.stringify([
    claim.donorPersonId,
    claim.year,
    claim.executionDate,
    claim.executionSequence,
  ])}`
}

/** Refuse rather than write a designation whose minted ID the Plan already claims. */
export function qcdCharityDesignationIdConflict(
  plan: Readonly<Plan>,
  claim: QcdCharityDesignationClaim,
): string | null {
  return retirementActionPlanReservedIdentifiers(plan).has(mintQcdCharityDesignationId(claim))
    ? QCD_CHARITY_DESIGNATION_ID_CONFLICT
    : null
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Accounts a charitable gift could plausibly be asked to come from, so the
 * surface can say why an unsupported one is unsupported instead of dropping it
 * without a word. Cash, taxable, and HSA accounts are not candidates in either
 * direction and would only add noise.
 */
export type QcdSourceCandidateAccount = Extract<Account, { type: 'traditional' | 'roth' }>

export function qcdSourceCandidate(
  account: Readonly<Account>,
): account is Readonly<QcdSourceCandidateAccount> {
  return account.type === 'traditional' || account.type === 'roth'
}

export interface QcdSourceExclusion {
  readonly message: string
  /** True when recording a fact in the IRA-facts section is what clears it. */
  readonly resolvableInFacts: boolean
}

/**
 * Why a candidate account cannot fund this gift. These are statements about
 * which options the surface offers, not restatements of an engine refusal: a
 * saved gift's refusals come from the projection and are rendered verbatim.
 */
export function qcdSourceSupportIssue(
  plan: Readonly<Plan>,
  account: Readonly<Account>,
  donorPersonId: string,
  year: number,
): QcdSourceExclusion | null {
  if (account.ownerPersonId === null) {
    return {
      message: 'This jointly owned account does not record the individual owner a charitable gift needs.',
      resolvableInFacts: false,
    }
  }
  if (account.ownerPersonId !== donorPersonId) {
    return {
      message: 'This account is owned by a different household member than the selected donor.',
      resolvableInFacts: false,
    }
  }
  // The employer-plan test runs before the Roth one so a Roth employer
  // account draws the exclusion that is true of it -- it is not an IRA.
  if (account.kind !== 'ira') {
    return {
      message: 'RetireGolden models a charitable gift only from an IRA, not from an employer plan.',
      resolvableInFacts: false,
    }
  }
  if (account.type === 'roth') {
    return {
      message: 'RetireGolden does not model a charitable gift from a Roth IRA.',
      resolvableInFacts: false,
    }
  }
  if (account.type !== 'traditional') {
    return {
      message: 'RetireGolden models a charitable gift only from a traditional IRA.',
      resolvableInFacts: false,
    }
  }
  if (account.inherited !== undefined) {
    return {
      message: 'RetireGolden does not model a charitable gift from an inherited IRA.',
      resolvableInFacts: false,
    }
  }
  const classification = iraClassificationFor(plan, account.id)
  if (classification === null) {
    return {
      message: 'This IRA needs its type on record before it can fund a charitable gift.',
      resolvableInFacts: true,
    }
  }
  if (classification.subtype === 'traditional') return null
  const planLabel = classification.subtype === 'sep' ? 'SEP' : 'SIMPLE'
  const activity = sepSimpleActivityFor(plan, account.id, year)
  if (activity === null) {
    return {
      message: `This ${planLabel} IRA needs an employer-contribution answer for ${year} on record before it can fund a charitable gift.`,
      resolvableInFacts: true,
    }
  }
  return activity.employerContributionMadeForPlanYear
    ? {
        message: `An employer contribution is on record for ${year}, so this ${planLabel} IRA cannot fund a charitable gift that year.`,
        resolvableInFacts: false,
      }
    : null
}

function candidateSources(
  plan: Readonly<Plan>,
): readonly Readonly<QcdSourceCandidateAccount>[] {
  return plan.accounts
    .filter(qcdSourceCandidate)
    .slice()
    .sort((left, right) => compareStrings(left.id, right.id))
}

function sourceOptionLabel(account: Readonly<QcdSourceCandidateAccount>): string {
  return `${account.name} (${account.type}/${account.kind}; ID ${account.id})`
}

export function qcdSourceOptions(
  plan: Readonly<Plan>,
  donorPersonId: string,
  year: number | null,
): readonly { value: string; label: string }[] {
  if (donorPersonId === '' || year === null) return []
  return candidateSources(plan)
    .filter((account) => qcdSourceSupportIssue(plan, account, donorPersonId, year) === null)
    .map((account) => ({ value: account.id, label: sourceOptionLabel(account) }))
}

export interface QcdSourceBoundary {
  readonly issues: readonly string[]
  /** True when at least one exclusion is cleared by recording an IRA fact. */
  readonly resolvableInFacts: boolean
}

/** Every distinct reason a candidate source is not offered, never hidden. */
export function qcdSourceBoundaryIssues(
  plan: Readonly<Plan>,
  donorPersonId: string,
  year: number | null,
): QcdSourceBoundary {
  if (donorPersonId === '' || year === null) return { issues: [], resolvableInFacts: false }
  const exclusions = candidateSources(plan)
    .map((account) => qcdSourceSupportIssue(plan, account, donorPersonId, year))
    .filter((exclusion): exclusion is QcdSourceExclusion => exclusion !== null)
  const seen = new Set<string>()
  const issues: string[] = []
  let resolvableInFacts = false
  for (const exclusion of exclusions) {
    if (exclusion.resolvableInFacts) resolvableInFacts = true
    if (seen.has(exclusion.message)) continue
    seen.add(exclusion.message)
    issues.push(exclusion.message)
  }
  return { issues, resolvableInFacts }
}

export function exactActionYear(value: string): number | null {
  return /^\d{4}$/.test(value) ? Number(value) : null
}

export type BuildQcdAuthoringIntentResult =
  | Readonly<{ ok: true; intent: Readonly<QcdCandidateIdentityIntent> }>
  | Readonly<{ ok: false; issues: readonly string[] }>

/**
 * Builds the allocator input only from affirmatively completed controls. No
 * donor, account, date, sequence, charity, or attestation is chosen here from
 * Plan order, account category, or household position.
 */
export function buildQcdAuthoringIntent(
  draft: Readonly<QcdAuthoringDraft>,
  plan: Readonly<Plan>,
  preservedActions: readonly Readonly<RetirementActionRequest>[],
): BuildQcdAuthoringIntentResult {
  const issues: string[] = []
  const year = exactActionYear(draft.year)
  if (year === null) issues.push("Enter the gift's tax year as a four-digit year.")

  const donorSelected = draft.donorPersonId.trim() !== ''
  const donorMatches = donorSelected
    ? plan.household.people.filter((person) => person.id === draft.donorPersonId)
    : []
  if (!donorSelected) {
    issues.push('Choose the donor for this gift.')
  } else if (donorMatches.length === 0) {
    issues.push('The selected donor is no longer available in this Plan. Choose a current household member.')
  } else if (donorMatches.length !== 1) {
    issues.push('The selected donor ID is duplicated in this Plan. Choose a unique household member.')
  } else if (year !== null) {
    const donorIssue = retirementActionManualPersonSupportIssue(donorMatches[0]!, year)
    if (donorIssue !== null) issues.push(donorIssue)
  }

  const sourceSelected = draft.sourceAccountId.trim() !== ''
  const sourceMatches = sourceSelected
    ? plan.accounts.filter((account) => account.id === draft.sourceAccountId)
    : []
  if (!sourceSelected) {
    issues.push('Choose the source IRA for this gift.')
  } else if (sourceMatches.length === 0) {
    issues.push('The selected source IRA is no longer available in this Plan. Choose the source IRA again.')
  } else if (sourceMatches.length !== 1) {
    issues.push('The selected source IRA ID is duplicated in this Plan. Choose a unique source account.')
  } else if (year !== null && donorMatches.length === 1) {
    const exclusion = qcdSourceSupportIssue(plan, sourceMatches[0]!, draft.donorPersonId, year)
    if (exclusion !== null) issues.push(exclusion.message)
  }

  const requestedAmount = positiveDollarsToCents(draft.giftAmountDollars)
  if (requestedAmount === null) {
    issues.push('Enter the gift amount as an exact dollars-and-cents figure above $0.00.')
  }

  const dateInYear = year !== null && exactDateForYear(draft.executionDate, year)
  if (!dateInYear) {
    issues.push(
      year === null
        ? "Choose the gift date once the gift's tax year is entered."
        : `Choose a valid gift date in ${year}.`,
    )
  }
  const executionSequence = exactExecutionSequence(draft.executionSequence)
  if (executionSequence === null) {
    issues.push('Enter a positive whole-number execution sequence.')
  } else if (
    dateInYear &&
    // A gift being created has no action ID yet, and the Plan never holds a
    // blank one, so nothing in `preservedActions` is excluded from the check.
    executionSlotAlreadyUsed('', preservedActions, draft.executionDate, executionSequence)
  ) {
    issues.push(
      'Another retirement action already uses this execution date and sequence. Choose an unused sequence.',
    )
  }

  if (draft.charityName.trim() === '') issues.push("Enter the charity's name.")
  if (draft.designationKind === '') issues.push('Choose the charity type.')

  // Fail closed, one statement at a time: the engine models the exclusion only
  // when all five are true, so the surface refuses to create a gift carrying an
  // answer the household did not give.
  for (const attestation of QCD_CHARITY_ATTESTATIONS) {
    if (!draft[attestation.key]) {
      issues.push(`Confirm this statement before saving: ${attestation.label}`)
    }
  }

  if (
    year !== null &&
    executionSequence !== null &&
    dateInYear &&
    donorMatches.length === 1
  ) {
    const conflict = qcdCharityDesignationIdConflict(plan, {
      donorPersonId: draft.donorPersonId,
      year,
      executionDate: draft.executionDate,
      executionSequence,
    })
    if (conflict !== null) issues.push(conflict)
  }

  if (
    issues.length > 0 ||
    year === null ||
    executionSequence === null ||
    requestedAmount === null ||
    draft.designationKind === ''
  ) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    intent: {
      kind: 'qcd',
      year,
      executionDate: draft.executionDate,
      executionSequence,
      requestedAmount,
      donorPersonId: draft.donorPersonId as PersonId,
      provenance: { source: 'manual' },
      sourceAllocation: {
        sourceAccountId: draft.sourceAccountId as AccountId,
        requestedAmount,
      },
      charity: {
        designationId: mintQcdCharityDesignationId({
          donorPersonId: draft.donorPersonId,
          year,
          executionDate: draft.executionDate,
          executionSequence,
        }),
        name: draft.charityName.trim(),
        designationKind: draft.designationKind,
        directFromCustodianAttested: true,
        eligibleOrganizationAttested: true,
        notDonorAdvisedFundOrSupportingOrganizationAttested: true,
        notSplitInterestEntityAttested: true,
        entireDistributionOtherwiseDeductibleAttested: true,
      },
    },
  }
}

/**
 * The three frames a gift's outcome can carry, and the line between them.
 *
 * The refusal frame introduces a list, so it may only render when the engine
 * gave one. The other two exist so that a gift with nothing behind it is
 * described rather than dressed in a refusal it never received.
 *
 * The list it introduces holds two kinds of engine sentence — the publication
 * record's typed reasons and the QCD executor's movement-level blockers — and
 * either can be the only one present. So the frame says the projection
 * explains itself, and does not promise the particular kind of explanation
 * that happens to follow.
 */
export const QCD_REFUSAL_FRAME =
  'This gift is not modeled as executing. The projection says why:'

export function qcdNotEvaluatedFrame(year: number): string {
  return `This projection did not evaluate this gift for ${year}. Nothing moves for it, and the projection has no reasons to give about it.`
}

/**
 * The record exists and moved nothing, but carries no sentence. No engine path
 * is known to produce this, and the copy still has to hold if one appears: it
 * says what the record says and claims nothing the record does not.
 */
export const QCD_NO_REASON_GIVEN_FRAME =
  'This gift is not modeled as executing, and the projection gave no reason for it.'

export interface QcdGiftReason {
  readonly code: string
  readonly message: string
}

/**
 * `notEvaluated` is a state of the projection, not of the gift.
 *
 * A year can publish no record for a gift, and that is never a refusal: the
 * year's whole QCD prerequisite batch can refuse as one, in which case the year
 * publishes neither the QCD source nor its requests and every gift in it loses
 * its record; a projection can produce no row for the gift's year; and
 * `simulatePlan` can fail outright. In each case the engine has said nothing
 * about this gift, so the surface must not borrow the refusal frame and stand
 * it over an empty list.
 */
export type QcdGiftProjectionStatus =
  | 'executing'
  | 'notExecuting'
  | 'notEvaluated'
  | 'beforeProjectionStart'

export interface QcdGiftProjection {
  readonly status: QcdGiftProjectionStatus
  /** The engine's own reasons, in the engine's own order and words. */
  readonly reasons: readonly QcdGiftReason[]
  /** The engine's own movement-level blockers for the gift's year. */
  readonly executionIssues: readonly string[]
  readonly executedAmountCents: number
  readonly executedDate: string | null
  readonly age70HalfThresholdDate: string | null
  /**
   * The year's required distribution came out in cash before the gift was
   * sized, so the gift is modelled on top of it rather than inside it.
   */
  readonly beyondRequiredDistribution: boolean
}

/**
 * The only shape a gift with no published record may take: no reason, no
 * blocker, no amount. A reason attributed to a gift the year never evaluated
 * would be an invention, and a batch-level blocker attributed to a gift the
 * batch never reached would be a misattribution.
 */
const NOT_EVALUATED: QcdGiftProjection = {
  status: 'notEvaluated',
  reasons: [],
  executionIssues: [],
  executedAmountCents: 0,
  executedDate: null,
  age70HalfThresholdDate: null,
  beyondRequiredDistribution: false,
}

/**
 * One projection for every authored gift. The surface reads the year the gift
 * is scheduled in and reports what the engine published there — it never
 * decides whether a gift is eligible, and never states a reason of its own.
 */
export function projectNamedQcdGifts(
  plan: Readonly<Plan>,
  startYear: number,
  taxCalculator: TaxCalculator,
): ReadonlyMap<string, QcdGiftProjection> {
  const gifts = namedQcdActions(plan)
  const outcomes = new Map<string, QcdGiftProjection>()
  if (gifts.length === 0) return outcomes
  const horizonEndYear = Math.max(startYear, ...gifts.map((gift) => gift.year))
  let years: ReturnType<typeof simulatePlan>['years']
  try {
    years = simulatePlan(structuredClone(plan) as Plan, {
      startYear,
      horizonEndYear,
      taxCalculator,
    }).years
  } catch {
    for (const gift of gifts) outcomes.set(gift.actionId, NOT_EVALUATED)
    return outcomes
  }
  for (const gift of gifts) {
    if (gift.year < startYear) {
      outcomes.set(gift.actionId, { ...NOT_EVALUATED, status: 'beforeProjectionStart' })
      continue
    }
    const year = years.find((entry) => entry.year === gift.year)
    if (year === undefined) {
      outcomes.set(gift.actionId, NOT_EVALUATED)
      continue
    }
    const record = year.retirementActionPublication?.records.find(
      (entry) => entry.actionId === gift.actionId,
    )
    // No record is not a refusal. Everything below reads the record, so a year
    // that published nothing for this gift stops here rather than reporting an
    // executed amount of zero as though the engine had decided something.
    if (record === undefined) {
      outcomes.set(gift.actionId, NOT_EVALUATED)
      continue
    }
    const prerequisite = year.qcdActionPrerequisites?.find(
      (entry) => entry.actionId === gift.actionId,
    )
    const execution = year.qcdActionExecution
    const executionIssues = execution?.committed === true
      ? []
      : (execution?.issues ?? [])
          .filter((entry) => entry.actionId === null || entry.actionId === gift.actionId)
          .map((entry) => entry.detail)
    const executedAmountCents = record.executedAmount
    const rmdCoordination = execution?.committed === true
      ? execution.evidence.find((entry) => entry.actionId === gift.actionId)?.rmdCoordination
      : undefined
    outcomes.set(gift.actionId, {
      status: executedAmountCents > 0 ? 'executing' : 'notExecuting',
      reasons: record.reasons.map((reason) => ({
        code: reason.code,
        message: reason.message,
      })),
      executionIssues,
      executedAmountCents,
      executedDate: record.executedDate,
      age70HalfThresholdDate:
        prerequisite?.eligibility.donor.age70HalfThresholdDate ?? null,
      beyondRequiredDistribution:
        year.rmd > 0 &&
        rmdCoordination !== undefined &&
        rmdCoordination.rmdSatisfiedAmount === 0,
    })
  }
  return outcomes
}
