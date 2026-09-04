/**
 * Writable Plan v3 retirement-action eligibility evidence.
 *
 * Every record here is an assertion the household makes about its own
 * arrangement, so nothing in this module writes without an explicit caller
 * action, and an absent record always means "not stated" — never "none".
 *
 * ## Evidence-ID minting
 *
 * One function mints every UI-authored evidence ID, and it is a pure function
 * of the record's natural key. The same fact always mints the same ID, and two
 * different facts never mint the same one:
 *
 * | Record                  | Minted evidence ID                                              |
 * |-------------------------|-----------------------------------------------------------------|
 * | IRA classification      | `planner-eligibility-ira-classification:["<accountId>"]`         |
 * | SEP/SIMPLE activity     | `planner-eligibility-sep-simple-activity:["<accountId>",<year>]` |
 * | Deductible contribution | `planner-eligibility-deductible-contribution:["<personId>",<year>]` |
 *
 * Why the scheme cannot collide:
 *
 * - **Across roles.** The three namespaces differ in their first character
 *   after `planner-eligibility-` (`i`, `s`, `d`), so no namespace is a prefix
 *   of another and no two roles can produce the same string.
 * - **Within a role.** `JSON.stringify` over the key tuple is injective, and
 *   the Plan already rejects two records sharing a natural key (the
 *   duplicate-classification-source, duplicate-activity-source-and-year, and
 *   duplicate-contribution-donor-and-year refinements in
 *   `model/planCrossFieldChecks.ts`). Two live records therefore never share a
 *   key, and never share an ID.
 * - **Against runtime evidence.** The simulator mints `projection-*` IDs and
 *   the manual-review preview mints `planner-preview-*` IDs. A UI-authored plan
 *   consequently cannot trip the whole-batch `evidenceIdReused` refusal in
 *   `annualQcdExecutionPrerequisite`, which blocks an entire year of gifts when
 *   one evidence ID is claimed twice.
 * - **Against the rest of the Plan.** Account, person, action, allocation,
 *   charity, scenario, and Plan IDs are free-form strings, so an imported Plan
 *   could in principle already claim a minted ID. Rather than write a colliding
 *   record, `eligibilityEvidenceIdConflict` refuses and the editor says why.
 */

import { asUsdCents, type UsdCents } from '@retiregolden/engine/actions/money'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '@retiregolden/engine/actions/planBalanceAdapter'
import {
  retirementActionPlanReservedIdentifiers,
  type Account,
  type Plan,
  type RetirementActionDeductibleIraContribution,
  type RetirementActionEligibilityFacts,
  type RetirementActionIraClassification,
  type RetirementActionSepSimpleActivity,
} from '@retiregolden/engine/model/plan'

import { age70HalfThresholdYear } from './eligibilityFactActions'

export type IraSubtype = RetirementActionIraClassification['subtype']

export type EligibilityEvidenceClaim =
  | Readonly<{ role: 'iraClassification'; sourceAccountId: string }>
  | Readonly<{ role: 'sepSimpleActivity'; sourceAccountId: string; actionTaxYear: number }>
  | Readonly<{ role: 'deductibleContribution'; donorPersonId: string; taxYear: number }>

const EVIDENCE_ID_NAMESPACES = {
  iraClassification: 'planner-eligibility-ira-classification',
  sepSimpleActivity: 'planner-eligibility-sep-simple-activity',
  deductibleContribution: 'planner-eligibility-deductible-contribution',
} as const

export const ELIGIBILITY_EVIDENCE_ID_CONFLICT =
  'This fact cannot be recorded: another item in this plan already uses the ID RetireGolden files it under. Change the conflicting account, person, or action ID, then record the fact again.'

function evidenceClaimKey(claim: EligibilityEvidenceClaim): readonly (string | number)[] {
  if (claim.role === 'iraClassification') return [claim.sourceAccountId]
  if (claim.role === 'sepSimpleActivity') return [claim.sourceAccountId, claim.actionTaxYear]
  return [claim.donorPersonId, claim.taxYear]
}

/** The one place a UI-authored eligibility evidence ID is minted. */
export function mintEligibilityEvidenceId(claim: EligibilityEvidenceClaim): string {
  return `${EVIDENCE_ID_NAMESPACES[claim.role]}:${JSON.stringify(evidenceClaimKey(claim))}`
}

function evidenceIdsClaimedByOtherFacts(
  facts: Readonly<RetirementActionEligibilityFacts> | undefined,
  claim: EligibilityEvidenceClaim,
): readonly string[] {
  if (facts === undefined) return []
  const classifications = facts.iraClassifications
    .filter((record) => !(
      claim.role === 'iraClassification' &&
      record.sourceAccountId === claim.sourceAccountId
    ))
    .map((record) => record.evidenceId)
  const activities = facts.sepSimpleActivities
    .filter((record) => !(
      claim.role === 'sepSimpleActivity' &&
      record.sourceAccountId === claim.sourceAccountId &&
      record.actionTaxYear === claim.actionTaxYear
    ))
    .map((record) => record.evidenceId)
  const contributions = facts.deductibleIraContributions
    .filter((record) => !(
      claim.role === 'deductibleContribution' &&
      record.donorPersonId === claim.donorPersonId &&
      record.taxYear === claim.taxYear
    ))
    .map((record) => record.evidenceId)
  return [...classifications, ...activities, ...contributions]
}

/**
 * Refuse rather than write a record whose minted ID is already claimed. The
 * Plan's own identifier namespace is checked with the eligibility root removed,
 * so a record only ever conflicts with something outside itself.
 */
export function eligibilityEvidenceIdConflict(
  plan: Readonly<Plan>,
  claim: EligibilityEvidenceClaim,
): string | null {
  const evidenceId = mintEligibilityEvidenceId(claim)
  const outsideFacts = retirementActionPlanReservedIdentifiers({
    ...plan,
    retirementActionEligibilityFacts: undefined,
  })
  if (outsideFacts.has(evidenceId)) return ELIGIBILITY_EVIDENCE_ID_CONFLICT
  return evidenceIdsClaimedByOtherFacts(plan.retirementActionEligibilityFacts, claim)
    .includes(evidenceId)
    ? ELIGIBILITY_EVIDENCE_ID_CONFLICT
    : null
}

/**
 * The years a bulk contribution statement could not record. A statement that
 * covers many years is checked in full before any of it is written, so a single
 * claimed ID refuses the whole statement instead of leaving a partial history
 * the household never made.
 */
export function conflictingContributionYears(
  plan: Readonly<Plan>,
  donorPersonId: string,
  taxYears: readonly number[],
): readonly number[] {
  return taxYears.filter((taxYear) =>
    eligibilityEvidenceIdConflict(plan, {
      role: 'deductibleContribution',
      donorPersonId,
      taxYear,
    }) !== null)
}

function formatYearList(years: readonly number[]): string {
  if (years.length === 1) return String(years[0])
  if (years.length === 2) return `${years[0]} and ${years[1]}`
  return `${years.slice(0, -1).join(', ')}, and ${years[years.length - 1]}`
}

export function bulkContributionConflictMessage(taxYears: readonly number[]): string {
  return `No year was recorded: another item in this plan already uses the ID RetireGolden files ${formatYearList(taxYears)} under. Change the conflicting account, person, or action ID, then record these years again.`
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Create the durable root only when a caller is about to write to it. */
function factsRoot(plan: Plan): RetirementActionEligibilityFacts {
  const existing = plan.retirementActionEligibilityFacts
  if (existing !== undefined) return existing
  const created: RetirementActionEligibilityFacts = {
    iraClassifications: [],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  plan.retirementActionEligibilityFacts = created
  return created
}

export function recordIraClassification(
  plan: Plan,
  sourceAccountId: string,
  subtype: IraSubtype,
  simpleParticipationStartDate: string | null,
): void {
  const facts = factsRoot(plan)
  const evidenceId = mintEligibilityEvidenceId({ role: 'iraClassification', sourceAccountId })
  const provenance = { source: 'manual' as const }
  const record: RetirementActionIraClassification = subtype === 'simple'
    ? {
        evidenceId,
        provenance,
        sourceAccountId,
        subtype: 'simple',
        ...(simpleParticipationStartDate === null
          ? {}
          : { simpleParticipationStartDate }),
      }
    : { evidenceId, provenance, sourceAccountId, subtype }
  facts.iraClassifications = [
    ...facts.iraClassifications.filter((entry) => entry.sourceAccountId !== sourceAccountId),
    record,
  ].sort((left, right) => compareStrings(left.sourceAccountId, right.sourceAccountId))
  // A traditional classification cannot carry employer-contribution records:
  // the Plan requires every activity record to have a SEP or SIMPLE source.
  if (subtype === 'traditional') {
    facts.sepSimpleActivities = facts.sepSimpleActivities.filter(
      (entry) => entry.sourceAccountId !== sourceAccountId,
    )
  }
}

/** Removing a classification removes the activity records it carried. */
export function removeIraClassification(plan: Plan, sourceAccountId: string): void {
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  facts.iraClassifications = facts.iraClassifications.filter(
    (entry) => entry.sourceAccountId !== sourceAccountId,
  )
  facts.sepSimpleActivities = facts.sepSimpleActivities.filter(
    (entry) => entry.sourceAccountId !== sourceAccountId,
  )
}

export function recordSepSimpleActivity(
  plan: Plan,
  sourceAccountId: string,
  actionTaxYear: number,
  planYearEndDate: string,
  employerContributionMadeForPlanYear: boolean,
): void {
  const facts = factsRoot(plan)
  const record: RetirementActionSepSimpleActivity = {
    evidenceId: mintEligibilityEvidenceId({
      role: 'sepSimpleActivity',
      sourceAccountId,
      actionTaxYear,
    }),
    provenance: { source: 'manual' },
    sourceAccountId,
    actionTaxYear,
    planYearEndDate,
    employerContributionMadeForPlanYear,
  }
  facts.sepSimpleActivities = [
    ...facts.sepSimpleActivities.filter(
      (entry) => entry.sourceAccountId !== sourceAccountId ||
        entry.actionTaxYear !== actionTaxYear,
    ),
    record,
  ].sort((left, right) =>
    compareStrings(left.sourceAccountId, right.sourceAccountId) ||
    left.actionTaxYear - right.actionTaxYear)
}

export function removeSepSimpleActivity(
  plan: Plan,
  sourceAccountId: string,
  actionTaxYear: number,
): void {
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  facts.sepSimpleActivities = facts.sepSimpleActivities.filter(
    (entry) => entry.sourceAccountId !== sourceAccountId ||
      entry.actionTaxYear !== actionTaxYear,
  )
}

export function recordDeductibleContribution(
  plan: Plan,
  donorPersonId: string,
  taxYear: number,
  amountCents: UsdCents,
): void {
  const facts = factsRoot(plan)
  const record: RetirementActionDeductibleIraContribution = {
    evidenceId: mintEligibilityEvidenceId({
      role: 'deductibleContribution',
      donorPersonId,
      taxYear,
    }),
    provenance: { source: 'manual' },
    donorPersonId,
    taxYear,
    amountCents,
  }
  facts.deductibleIraContributions = [
    ...facts.deductibleIraContributions.filter(
      (entry) => entry.donorPersonId !== donorPersonId || entry.taxYear !== taxYear,
    ),
    record,
  ].sort((left, right) =>
    compareStrings(left.donorPersonId, right.donorPersonId) ||
    left.taxYear - right.taxYear)
}

export function removeDeductibleContribution(
  plan: Plan,
  donorPersonId: string,
  taxYear: number,
): void {
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  facts.deductibleIraContributions = facts.deductibleIraContributions.filter(
    (entry) => entry.donorPersonId !== donorPersonId || entry.taxYear !== taxYear,
  )
}

/**
 * One assertion covering N years writes N records with N distinct evidence
 * IDs. A stated zero is a record; an unstated year stays absent.
 */
export function recordDeductibleContributionZeros(
  plan: Plan,
  donorPersonId: string,
  taxYears: readonly number[],
): void {
  taxYears.forEach((taxYear) => {
    recordDeductibleContribution(plan, donorPersonId, taxYear, asUsdCents(0))
  })
}

/** Accounts the Plan accepts an IRA classification for. */
export function classifiableIraAccounts(plan: Readonly<Plan>): readonly Account[] {
  return plan.accounts
    .filter((account) =>
      account.type === 'traditional' &&
      account.kind === 'ira' &&
      account.ownerPersonId !== null &&
      account.inherited === undefined)
    .slice()
    .sort((left, right) => compareStrings(left.id, right.id))
}

/** Exactly-one semantics: a duplicated source is not a usable classification. */
export function iraClassificationFor(
  plan: Readonly<Plan>,
  sourceAccountId: string,
): RetirementActionIraClassification | null {
  const matches = (plan.retirementActionEligibilityFacts?.iraClassifications ?? []).filter(
    (record) => record.sourceAccountId === sourceAccountId,
  )
  return matches.length === 1 ? matches[0] : null
}

export function sepSimpleActivityFor(
  plan: Readonly<Plan>,
  sourceAccountId: string,
  actionTaxYear: number,
): RetirementActionSepSimpleActivity | null {
  const matches = (plan.retirementActionEligibilityFacts?.sepSimpleActivities ?? []).filter(
    (record) =>
      record.sourceAccountId === sourceAccountId && record.actionTaxYear === actionTaxYear,
  )
  return matches.length === 1 ? matches[0] : null
}

export function sepSimpleActivityYears(
  plan: Readonly<Plan>,
  sourceAccountId: string,
): readonly number[] {
  const stated = (plan.retirementActionEligibilityFacts?.sepSimpleActivities ?? [])
    .filter((record) => record.sourceAccountId === sourceAccountId)
    .map((record) => record.actionTaxYear)
  return [...new Set(stated)].sort((left, right) => left - right)
}

export function deductibleContributionFor(
  plan: Readonly<Plan>,
  donorPersonId: string,
  taxYear: number,
): RetirementActionDeductibleIraContribution | null {
  const matches = (plan.retirementActionEligibilityFacts?.deductibleIraContributions ?? [])
    .filter((record) => record.donorPersonId === donorPersonId && record.taxYear === taxYear)
  return matches.length === 1 ? matches[0] : null
}

/**
 * The tax years a donor's contribution history covers: their age-70½ threshold
 * year through `throughYear`. The range is derivable exactly; the answers are
 * not, and are never filled in here.
 */
export function deductibleContributionYears(
  dob: string,
  throughYear: number,
): readonly number[] {
  const thresholdYear = age70HalfThresholdYear(dob)
  if (thresholdYear === null || thresholdYear > throughYear) return []
  const years: number[] = []
  for (let year = thresholdYear; year <= throughYear; year++) years.push(year)
  return years
}

/** Exact-cent dollars, allowing a stated zero. */
export function nonnegativeDollarsToCents(value: number | null): UsdCents | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  try {
    const cents = planDollarsToLedgerCents(value)
    if (cents < 0 || ledgerCentsToPlanDollars(cents) !== value) return null
    return asUsdCents(cents)
  } catch {
    return null
  }
}

export interface ContributionDonor {
  readonly person: Plan['household']['people'][number]
  readonly years: readonly number[]
}

/**
 * The last tax year a donor's contribution history has to reach.
 *
 * The engine walks the donor's threshold year through the *action* year and
 * refuses a history with a gap anywhere in that range, so a gift scheduled
 * beyond the projection's first year needs the years between asked about. A
 * range that stopped at the current year would leave the household staring at
 * `qcd-contribution-history-unknown` with no row to answer.
 */
function contributionThroughYearFor(
  plan: Readonly<Plan>,
  donorPersonId: string,
  throughYear: number,
): number {
  const giftYears = plan.strategies.retirementActions
    .filter((action) => action.kind === 'qcd' && action.donorPersonId === donorPersonId)
    .map((action) => action.year)
  return Math.max(throughYear, ...giftYears)
}

/**
 * The household members whose contribution history the editor asks about: a
 * donor with a classifiable IRA or a record already on file, and at least one
 * tax year at or past their age-70½ threshold.
 */
export function contributionDonors(
  plan: Readonly<Plan>,
  throughYear: number,
): readonly ContributionDonor[] {
  const owners = new Set(
    classifiableIraAccounts(plan)
      .map((account) => account.ownerPersonId)
      .filter((ownerPersonId): ownerPersonId is string => ownerPersonId !== null),
  )
  const recorded = new Set(
    (plan.retirementActionEligibilityFacts?.deductibleIraContributions ?? [])
      .map((record) => record.donorPersonId),
  )
  return plan.household.people
    .map((person) => ({
      person,
      years: deductibleContributionYears(
        person.dob,
        contributionThroughYearFor(plan, person.id, throughYear),
      ),
    }))
    .filter((entry) =>
      entry.years.length > 0 &&
      (owners.has(entry.person.id) || recorded.has(entry.person.id)))
}

/**
 * Exact-cent Plan dollars for display in a money field. An imported amount that
 * no Plan dollar number can hold exactly is shown as unanswered rather than
 * rounded into something the household never stated.
 */
export function centsToPlanDollars(cents: UsdCents): number | null {
  try {
    return ledgerCentsToPlanDollars(cents)
  } catch {
    return null
  }
}

/**
 * Takes validated cents, so a raw number that was never parsed as an exact-cent
 * amount is a compile error rather than a runtime parse failure.
 */
export function formatUsdCents(cents: UsdCents): string {
  const value = BigInt(cents)
  const dollars = (value / 100n).toLocaleString('en-US')
  const fraction = String(value % 100n).padStart(2, '0')
  return `$${dollars}.${fraction}`
}
