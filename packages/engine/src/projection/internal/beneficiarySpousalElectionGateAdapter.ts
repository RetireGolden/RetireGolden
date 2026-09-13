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

export function acceptedElectionYearQualifyingDistributions(input: {
  readonly account: Extract<Account, { type: 'traditional' | 'roth' }>
  readonly taxYear: number
}): AcceptedElectionYearQualifyingDistributions {
  const inherited = input.account.inherited
  if (inherited === undefined || inherited.beneficiary === undefined) {
    return { amount: 0, evidence: 'none' }
  }
  const acceptedHistory = (inherited.annualDistributionHistory ?? [])
    .filter((row) =>
      row.taxYear === input.taxYear &&
      parseCivilIsoDate(row.observedAsOfDate ?? '') !== null &&
      parseCivilIsoDate(row.legalDistributionDeadline ?? '') !== null &&
      parseCivilIsoDate(row.provenance.asOf) !== null &&
      row.observedAsOfDate! >= row.legalDistributionDeadline! &&
      row.provenance.asOf >= row.observedAsOfDate! &&
      row.provenance.source.trim().length > 0,
    )
  const fromHistory = acceptedHistory
    .reduce((sum, row) => sum + Math.max(0, row.distributedAmount), 0)
  if (acceptedHistory.length > 0) {
    return {
      amount: fromHistory,
      evidence: 'completed-current-year-beneficiary-history',
    }
  }
  const electionFacts = inherited.beneficiary.spousalElectionFacts
  const worksheet = electionFacts?.section402c2j4Inputs
  const eventDate = electionFacts?.affirmativeElectionDate
  const fromJ4 = worksheet !== undefined &&
    worksheet.distributionYear === input.taxYear &&
    parseCivilIsoDate(worksheet.provenance.asOf) !== null &&
    worksheet.provenance.source.trim().length > 0 &&
    (eventDate === null || eventDate === undefined || worksheet.provenance.asOf >= eventDate)
    ? Math.max(0, worksheet.actualPreElectionDistributionsCurrentYear)
    : 0
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

/**
 * Prior-Dec-31 / current-year RMD reference balance for election-year owner
 * recalculation. Prefers the explicit j(4) reference balance when supplied so
 * a live opening balance that already nets pre-election distributions does not
 * silently understate the owner requirement.
 */
export function electionYearOwnerRmdReferenceBalance(input: {
  readonly account: Extract<Account, { type: 'traditional' | 'roth' }>
  readonly startOfYearBalance: number
}): number {
  const reference =
    input.account.inherited?.beneficiary?.spousalElectionFacts?.section402c2j4Inputs
      ?.currentYearRmdReferenceBalance
  // A positive explicit reference is the prior-Dec-31 / RMD base. Zero is the
  // life-expectancy placeholder used when j(4) is non-applicable and must not
  // collapse the owner requirement.
  if (typeof reference === 'number' && Number.isFinite(reference) && reference > 0) {
    return reference
  }
  return Math.max(0, input.startOfYearBalance)
}
